/**
 * Agent-Task Integration Tests
 * 
 * Tests the interaction between Agent and Task modules:
 * - Clean module separation and event-driven communication
 * - Task assignment and execution workflows
 * - Agent-task lifecycle coordination
 * - Direct service integration testing
 * 
 * Coverage targets:
 * - Agent-Task service interactions
 * - Event-based communication patterns
 * - Task orchestration and assignment logic
 * - Cross-module integration workflows
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { EventNames } from '@/modules/core/events/types/index';
import { TaskService } from '@/modules/core/tasks/services/task.service';
import { TaskRepository } from '@/modules/core/tasks/repositories/task.repository';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { AgentRepository } from '@/modules/core/agents/repositories/agent.repository';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LoggerMode, LogOutput } from '@/modules/core/logger/types/index';
import type { IAgent } from '@/modules/core/agents/types/agent.types';
import type { ITask } from '@/modules/core/tasks/types/index';
import { TaskStatusEnum } from '@/modules/core/tasks/types/index';
import { AgentsStatus } from '@/modules/core/agents/types/database.generated';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('Agent-Task Integration Tests', () => {
  let bootstrap: Bootstrap;
  let eventBus: EventBusService;
  let taskService: TaskService;
  let taskRepository: TaskRepository;
  let agentService: AgentService;
  let agentRepository: AgentRepository;
  let dbService: DatabaseService;
  let logger: LoggerService;
  
  const testSessionId = `agent-task-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  // Shared state for cross-test data
  const testState = {
    createdAgent: null as IAgent | null,
    createdTask: null as ITask | null
  };
  
  // Track events for testing
  const capturedEvents: Array<{ event: string; data: any }> = [];

  beforeAll(async () => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path
    process.env.DATABASE_PATH = testDbPath;
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services from modules
    const agentsModule = modules.get('agents');
    const tasksModule = modules.get('tasks');
    const dbModule = modules.get('database');
    const eventsModule = modules.get('events');
    
    if (!agentsModule || !('exports' in agentsModule) || !agentsModule.exports) {
      throw new Error('Agents module not loaded');
    }
    
    if (!tasksModule || !('exports' in tasksModule) || !tasksModule.exports) {
      throw new Error('Tasks module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    if (!eventsModule || !('exports' in eventsModule) || !eventsModule.exports) {
      throw new Error('Events module not loaded');
    }
    
    // Extract services
    dbService = dbModule.exports.service();
    
    if ('service' in agentsModule.exports && typeof agentsModule.exports.service === 'function') {
      agentService = agentsModule.exports.service();
    } else {
      throw new Error('Agent service not available');
    }
    
    if ('service' in tasksModule.exports && typeof tasksModule.exports.service === 'function') {
      taskService = tasksModule.exports.service();
    } else {
      throw new Error('Task service not available');
    }
    
    if ('eventBus' in eventsModule.exports) {
      eventBus = eventsModule.exports.eventBus;
    } else {
      throw new Error('Event bus service not available');
    }

    // Initialize logger for clean test environment
    logger = LoggerService.getInstance();
    logger.initialize({
      stateDir: testDir,
      logLevel: 'error',
      mode: LoggerMode.CLI,
      maxSize: '10MB',
      maxFiles: 3,
      outputs: [LogOutput.CONSOLE],
      files: {
        system: 'system.log',
        error: 'error.log',
        access: 'access.log'
      }
    });

    // Get repositories
    taskRepository = new TaskRepository(dbService);
    agentRepository = AgentRepository.getInstance();

    // Capture all events for testing
    Object.values(EventNames).forEach(eventName => {
      eventBus.on(eventName, (data: any) => {
        capturedEvents.push({ event: eventName, data });
      });
    });
  });

  afterAll(async () => {
    // Shutdown bootstrap
    if (bootstrap) {
      await bootstrap.shutdown();
    }
    
    // Clean up singletons
    try {
      const { DatabaseService } = await import('@/modules/core/database/services/database.service');
      await DatabaseService.reset();
    } catch (error) {
      // Service might not be loaded
    }

    try {
      const { AgentService } = await import('@/modules/core/agents/services/agent.service');
      await AgentService.reset();
    } catch (error) {
      // Service might not be loaded
    }

    try {
      const { TaskService } = await import('@/modules/core/tasks/services/task.service');
      await TaskService.reset();
    } catch (error) {
      // Service might not be loaded
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    // Force garbage collection
    if (typeof global.gc === 'function') {
      global.gc();
    }
  });

  beforeEach(async () => {
    // Clear event history
    capturedEvents.length = 0;
    
    // Clear agent and task data before each test - order matters for foreign keys
    try {
      await dbService.execute('DELETE FROM agent_config');
      await dbService.execute('DELETE FROM agent_tools');
      await dbService.execute('DELETE FROM agent_capabilities');
      await dbService.execute('DELETE FROM agent_logs');
      await dbService.execute('DELETE FROM agents');
      await dbService.execute('DELETE FROM task');
      
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.warn('Failed to clear tables in beforeEach:', error);
    }
  });

  describe('Clean Module Separation', () => {
    it('should create agent without task knowledge', async () => {
      testState.createdAgent = await agentService.createAgent({
        name: 'separation-agent',
        description: 'Test agent for module separation',
        instructions: 'Process tasks independently',
        type: 'worker',
        capabilities: ['data-processing', 'report-generation']
      });

      expect(testState.createdAgent).toBeDefined();
      expect(testState.createdAgent.id).toBeDefined();
      expect(testState.createdAgent.assigned_tasks).toBe(0);
      expect(testState.createdAgent.completed_tasks).toBe(0);
      expect(testState.createdAgent.failed_tasks).toBe(0);
      
      // Check event
      const event = capturedEvents.find(e => e.event === EventNames.AGENT_CREATED);
      expect(event).toBeDefined();
      expect(event?.data.agentId).toBe(testState.createdAgent.id);
    });

    it('should create task without agent knowledge', async () => {
      testState.createdTask = await taskService.addTask({
        type: 'data-processing',
        moduleId: 'analytics',
        instructions: { process: 'aggregate', dataset: 'sales' },
        priority: 8,
        status: TaskStatusEnum.PENDING
      });

      expect(testState.createdTask).toBeDefined();
      expect(testState.createdTask.id).toBeDefined();
      expect(testState.createdTask.assignedAgentId).toBeUndefined();
      expect(testState.createdTask.status).toBe(TaskStatusEnum.PENDING);
      
      // Check event
      const event = capturedEvents.find(e => 
        e.event === EventNames.TASK_CREATED && 
        e.data.taskId === testState.createdTask!.id
      );
      expect(event).toBeDefined();
    });

    it('should coordinate task assignment through event system', async () => {
      if (!testState.createdAgent?.id || !testState.createdTask?.id) {
        throw new Error('Created agent or task is not available - previous tests may have failed');
      }

      // Clear events to focus on assignment flow
      capturedEvents.length = 0;
      
      // Start agent (makes it available)
      await agentService.updateAgentStatus(testState.createdAgent.id, AgentsStatus.ACTIVE);
      
      // Assign task to agent
      await taskService.assignTaskToAgent(testState.createdTask.id, testState.createdAgent.id);
      
      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check task was assigned
      const updatedTask = await taskService.getTask(testState.createdTask.id);
      expect(updatedTask?.assignedAgentId).toBe(testState.createdAgent.id);
      expect(updatedTask?.status).toBe(TaskStatusEnum.ASSIGNED);

      // Check events were emitted
      const assignedEvent = capturedEvents.find(e => e.event === EventNames.TASK_ASSIGNED);
      expect(assignedEvent).toBeDefined();
      expect(assignedEvent?.data.taskId).toBe(testState.createdTask.id);
      expect(assignedEvent?.data.agentId).toBe(testState.createdAgent.id);
    });

    it('should handle task execution with clean interfaces', async () => {
      if (!testState.createdAgent?.id || !testState.createdTask?.id) {
        throw new Error('Created agent or task is not available - previous tests may have failed');
      }

      // Clear events
      capturedEvents.length = 0;
      
      // Report agent as busy with task
      await agentService.reportAgentBusy(testState.createdAgent.id, testState.createdTask.id);
      
      // Complete task
      await taskService.completeTask(testState.createdTask.id, 'Task completed successfully');
      
      // Report agent as idle
      await agentService.reportAgentIdle(testState.createdAgent.id, true);

      // Verify task completion
      const completedTask = await taskService.getTask(testState.createdTask.id);
      expect(completedTask?.status).toBe(TaskStatusEnum.COMPLETED);
      expect(completedTask?.result).toContain('completed successfully');

      // Check events
      const busyEvent = capturedEvents.find(e => e.event === EventNames.AGENT_BUSY);
      expect(busyEvent).toBeDefined();
      
      const completedEvent = capturedEvents.find(e => e.event === EventNames.TASK_COMPLETED);
      expect(completedEvent).toBeDefined();
      
      const idleEvent = capturedEvents.find(e => e.event === EventNames.AGENT_IDLE);
      expect(idleEvent).toBeDefined();
    });

    it('should handle multiple agents and tasks independently', async () => {
      // Create multiple agents
      const agents = await Promise.all([
        agentService.createAgent({ name: 'multi-1', type: 'worker', description: 'Multi agent 1', instructions: 'Test' }),
        agentService.createAgent({ name: 'multi-2', type: 'worker', description: 'Multi agent 2', instructions: 'Test' }),
        agentService.createAgent({ name: 'multi-3', type: 'worker', description: 'Multi agent 3', instructions: 'Test' })
      ]);

      // Create multiple tasks
      const tasks = await Promise.all([
        taskService.addTask({ type: 'task-1', moduleId: 'test', priority: 1 }),
        taskService.addTask({ type: 'task-2', moduleId: 'test', priority: 2 }),
        taskService.addTask({ type: 'task-3', moduleId: 'test', priority: 3 })
      ]);

      // Activate all agents
      await Promise.all(
        agents.map(agent => agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE))
      );

      // Assign tasks to agents (round-robin)
      for (let i = 0; i < tasks.length; i++) {
        const agent = agents[i % agents.length];
        await taskService.assignTaskToAgent(tasks[i].id!, agent.id);
      }

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all tasks are assigned
      const assignedTasks = await Promise.all(
        tasks.map(task => taskService.getTask(task.id!))
      );

      assignedTasks.forEach(task => {
        expect(task?.assignedAgentId).toBeDefined();
        expect(task?.status).toBe(TaskStatusEnum.ASSIGNED);
      });

      // Verify agents can handle tasks independently
      for (const agent of agents) {
        const agentTasks = await taskService.getTasksByAgent(agent.id);
        expect(agentTasks.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Event-Based Communication', () => {
    it('should communicate through events without direct coupling', async () => {
      const events: string[] = [];
      
      // Track specific events
      ['task.created', 'task.assigned', 'agent.created', 'agent.status.changed'].forEach(event => {
        eventBus.on(event, () => events.push(event));
      });

      const agent = await agentService.createAgent({ 
        name: 'event-test', 
        type: 'worker',
        description: 'Event test agent',
        instructions: 'Test events'
      });
      
      const task = await taskService.addTask({ 
        type: 'event-task', 
        moduleId: 'test',
        priority: 5
      });

      await agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE);
      await taskService.assignTaskToAgent(task.id!, agent.id);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event flow (using captured events from our global listener)
      expect(capturedEvents.some(e => e.event === EventNames.AGENT_CREATED)).toBe(true);
      expect(capturedEvents.some(e => e.event === EventNames.TASK_CREATED)).toBe(true);
      expect(capturedEvents.some(e => e.event === EventNames.TASK_ASSIGNED)).toBe(true);
    });

    it('should handle task failure events', async () => {
      const agent = await agentService.createAgent({
        name: 'failure-test',
        type: 'worker',
        description: 'Failure test agent',
        instructions: 'Test failure handling'
      });

      const failingTask = await taskService.addTask({
        type: 'failing-task',
        moduleId: 'test',
        priority: 10
      });

      await taskService.assignTaskToAgent(failingTask.id!, agent.id);
      
      // Clear events to focus on failure
      capturedEvents.length = 0;
      
      await taskService.failTask(failingTask.id!, 'Test failure simulation');

      const task = await taskService.getTask(failingTask.id!);
      expect(task?.status).toBe(TaskStatusEnum.FAILED);
      expect(task?.error).toBe('Test failure simulation');
      
      // Check failure event was emitted
      const failedEvent = capturedEvents.find(e => e.event === EventNames.TASK_FAILED);
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.data.error).toBe('Test failure simulation');
    });
  });

  describe('Task Assignment and Agent Availability', () => {
    it('should track available agents for task assignment', async () => {
      // Create agent with specific capabilities
      const agent = await agentService.createAgent({
        name: 'capability-agent',
        type: 'worker',
        description: 'Agent with specific capabilities',
        instructions: 'Handle specific task types',
        capabilities: ['data-processing', 'report-generation']
      });

      // Activate agent
      await agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE);

      // Get available agents
      const availableAgents = await agentService.getAvailableAgents();
      expect(availableAgents).toHaveLength(1);
      expect(availableAgents[0].id).toBe(agent.id);
      expect(availableAgents[0].status).toBe(AgentsStatus.ACTIVE);
    });

    it('should filter tasks by agent assignment', async () => {
      const agent = await agentService.createAgent({
        name: 'filter-agent',
        type: 'worker',
        description: 'Agent for filtering test',
        instructions: 'Handle assigned tasks'
      });

      const tasks = await Promise.all([
        taskService.addTask({ type: 'filter-task-1', moduleId: 'test', priority: 1 }),
        taskService.addTask({ type: 'filter-task-2', moduleId: 'test', priority: 2 }),
        taskService.addTask({ type: 'filter-task-3', moduleId: 'test', priority: 3 })
      ]);

      // Assign some tasks to the agent
      await taskService.assignTaskToAgent(tasks[0].id!, agent.id);
      await taskService.assignTaskToAgent(tasks[2].id!, agent.id);

      // Get tasks assigned to this agent
      const agentTasks = await taskService.getTasksByAgent(agent.id);
      expect(agentTasks).toHaveLength(2);
      expect(agentTasks.some(t => t.id === tasks[0].id)).toBe(true);
      expect(agentTasks.some(t => t.id === tasks[2].id)).toBe(true);
    });
  });

  describe('Agent-Task Lifecycle Integration', () => {
    it('should demonstrate complete agent-task workflow', async () => {
      // 1. Create agent
      const agent = await agentService.createAgent({
        name: 'workflow-agent',
        type: 'worker',
        description: 'Complete workflow test agent',
        instructions: 'Handle complete task lifecycle',
        capabilities: ['workflow-processing']
      });

      // 2. Create task
      const task = await taskService.addTask({
        type: 'workflow-processing',
        moduleId: 'workflow',
        instructions: { process: 'complete-workflow' },
        priority: 10
      });

      // 3. Start agent
      await agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE);

      // 4. Assign task
      await taskService.assignTaskToAgent(task.id!, agent.id);

      // 5. Report agent busy
      await agentService.reportAgentBusy(agent.id, task.id!);

      // 6. Complete task
      await taskService.completeTask(task.id!, { result: 'workflow completed', metrics: { duration: 150 } });

      // 7. Report agent idle
      await agentService.reportAgentIdle(agent.id, true);

      // Verify final state
      const finalTask = await taskService.getTask(task.id!);
      expect(finalTask?.status).toBe(TaskStatusEnum.COMPLETED);
      expect(finalTask?.assignedAgentId).toBe(agent.id);

      const finalAgent = await agentService.getAgent(agent.id);
      expect(finalAgent?.status).toBe(AgentsStatus.ACTIVE);

      // Verify event sequence
      const eventTypes = capturedEvents.map(e => e.event);
      expect(eventTypes).toContain(EventNames.AGENT_CREATED);
      expect(eventTypes).toContain(EventNames.TASK_CREATED);
      expect(eventTypes).toContain(EventNames.TASK_ASSIGNED);
      expect(eventTypes).toContain(EventNames.AGENT_BUSY);
      expect(eventTypes).toContain(EventNames.TASK_COMPLETED);
      expect(eventTypes).toContain(EventNames.AGENT_IDLE);
    });
  });
});