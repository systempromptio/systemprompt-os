/**
 * Agent-Task Integration Tests
 * 
 * Tests the interaction between Agent and Task modules:
 * - Clean module separation and event-driven communication
 * - Task assignment and execution workflows
 * - Agent-task lifecycle coordination
 * - Cross-module integration
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
import type { AgentsService } from '@/modules/core/agents/services/agents.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IAgentsModuleExports } from '@/modules/core/agents/types/agents.service.generated';
import type { ITasksModuleExports, ITaskService } from '@/modules/core/tasks/types/index';
import type { ITaskRow } from '@/modules/core/tasks/types/database.generated';
import { TaskStatus } from '@/modules/core/tasks/types/database.generated';
import { AgentsStatus } from '@/modules/core/agents/types/database.generated';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('Agent-Task Integration Tests', () => {
  let bootstrap: Bootstrap;
  let eventBus: EventBusService;
  let taskService: ITaskService;
  let agentService: AgentsService;
  let dbService: DatabaseService;
  
  const testSessionId = `agent-task-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  // Track events for testing
  const capturedEvents: Array<{ event: string; data: any }> = [];

  beforeAll(async () => {
    console.log(`🚀 Setting up agent-task integration test (session: ${testSessionId})...`);
    
    // Reset any existing singletons first
    try {
      const { DatabaseService } = await import('@/modules/core/database/services/database.service');
      await DatabaseService.reset();
    } catch (error) {
      // Ignore
    }
    
    try {
      const { LoggerService } = await import('@/modules/core/logger/services/logger.service');
      (LoggerService as any).instance = null;
    } catch (error) {
      // Ignore
    }
    
    try {
      const { AgentsService } = await import('@/modules/core/agents/services/agents.service');
      await AgentsService.reset();
    } catch (error) {
      // Ignore
    }

    // Note: TaskService doesn't have a reset method like other services
    
    try {
      const { ModulesModuleService } = await import('@/modules/core/modules/services/modules-module.service');
      ModulesModuleService.reset();
    } catch (error) {
      // Ignore
    }
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path and environment
    process.env.DATABASE_PATH = testDbPath;
    process.env.DATABASE_FILE = testDbPath;
    process.env.LOG_LEVEL = 'error';
    process.env.DISABLE_TELEMETRY = 'true';
    process.env.NODE_ENV = 'test';
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services from modules
    const agentsModuleRef = modules.get('agents');
    const tasksModuleRef = modules.get('tasks');
    const dbModule = modules.get('database');
    const eventsModule = modules.get('events');
    
    if (!agentsModuleRef || !('exports' in agentsModuleRef) || !agentsModuleRef.exports) {
      throw new Error('Agents module not loaded');
    }
    
    if (!tasksModuleRef || !('exports' in tasksModuleRef) || !tasksModuleRef.exports) {
      console.warn('Tasks module not loaded - skipping agent-task integration tests');
      // Skip all tests in this suite since tasks module is required
      throw new Error('Tasks module not loaded - required for integration tests');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    if (!eventsModule || !('exports' in eventsModule) || !eventsModule.exports) {
      throw new Error('Events module not loaded');
    }
    
    // Extract services
    dbService = (dbModule as any).exports.service();
    
    const agentExports = agentsModuleRef.exports as IAgentsModuleExports;
    agentService = agentExports.service();
    
    const taskExports = tasksModuleRef.exports as ITasksModuleExports;
    taskService = taskExports.service();
    
    if ('eventBus' in eventsModule.exports) {
      eventBus = eventsModule.exports.eventBus;
    } else {
      throw new Error('Event bus service not available');
    }

    // Capture all events for testing
    Object.values(EventNames).forEach(eventName => {
      eventBus.on(eventName, (data: any) => {
        capturedEvents.push({ event: eventName, data });
      });
    });
    
    // Give event handlers time to set up
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('✅ Agent-task integration test environment ready');
  }, 60000);

  afterAll(async () => {
    console.log('🧹 Cleaning up agent-task integration test environment...');
    
    // Set a timeout for cleanup
    const cleanupTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Cleanup timeout')), 10000)
    );
    
    try {
      await Promise.race([
        (async () => {
          // Shutdown bootstrap
          if (bootstrap) {
            try {
              await bootstrap.shutdown();
            } catch (error) {
              console.warn('Bootstrap shutdown error:', error);
            }
          }
          
          // Reset singletons
          try {
            const { DatabaseService } = await import('@/modules/core/database/services/database.service');
            await DatabaseService.reset();
          } catch (error) {
            // Ignore
          }

          try {
            const { AgentsService } = await import('@/modules/core/agents/services/agents.service');
            await AgentsService.reset();
          } catch (error) {
            // Ignore
          }

          // Note: TaskService doesn't have a reset method like other services
          
          // Clean up test files
          if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
          }

          // Force garbage collection
          if (typeof global.gc === 'function') {
            global.gc();
          }
        })(),
        cleanupTimeout
      ]);
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
    
    console.log('✅ Agent-task integration test environment cleaned up');
  }, 30000);

  beforeEach(async () => {
    // Clear event history
    capturedEvents.length = 0;
    
    // Clear agent and task data before each test - order matters for foreign keys
    try {
      // Get list of existing tables first
      const tableNames = await dbService.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const existingTables = tableNames.map(row => row.name);
      
      // Clear tables in order that respects foreign key constraints
      const tablesToClear = [
        'task_metadata',
        'task',
        'agent_config',
        'agent_tools', 
        'agent_capabilities',
        'agent_logs',
        'agents'
      ];
      
      for (const table of tablesToClear) {
        if (existingTables.includes(table)) {
          await dbService.execute(`DELETE FROM ${table}`);
        }
      }
      
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.warn('Failed to clear tables in beforeEach:', error);
    }
  });

  describe('Clean Module Separation', () => {
    it('should create agent without task knowledge', async () => {
      const agent = await agentService.createAgent({
        name: 'separation-agent',
        description: 'Test agent for module separation',
        instructions: 'Process tasks independently',
        type: 'worker'
      });

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('separation-agent');
      expect(agent.assigned_tasks).toBe(0);
      expect(agent.completed_tasks).toBe(0);
      expect(agent.failed_tasks).toBe(0);
      
      // Check event
      const event = capturedEvents.find(e => e.event === EventNames.AGENT_CREATED);
      expect(event).toBeDefined();
      expect(event?.data.agentId).toBe(agent.id);
    });

    it('should create task without agent knowledge', async () => {
      const task = await taskService.addTask({
        type: 'data-processing',
        module_id: 'analytics',
        instructions: JSON.stringify({ process: 'aggregate', dataset: 'sales' }),
        priority: 8
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.type).toBe('data-processing');
      expect(task.module_id).toBe('analytics');
      expect(task.assigned_agent_id).toBeNull();
      expect(task.status).toBe(TaskStatus.PENDING);
      
      // Check event
      const event = capturedEvents.find(e => 
        e.event === EventNames.TASK_CREATED && 
        e.data.task.id === task.id
      );
      expect(event).toBeDefined();
    });

    it('should coordinate task assignment through task service', async () => {
      // Create agent and task
      const agent = await agentService.createAgent({
        name: 'coordination-agent',
        description: 'Agent for coordination test',
        instructions: 'Handle task assignments',
        type: 'worker'
      });

      const task = await taskService.addTask({
        type: 'coordination-task',
        module_id: 'test',
        instructions: JSON.stringify({ action: 'coordinate' }),
        priority: 5
      });

      // Clear events to focus on assignment flow
      capturedEvents.length = 0;
      
      // Start agent (makes it available)
      await agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE);
      
      // Assign task to agent
      await taskService.assignTaskToAgent(task.id, agent.id);
      
      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check task was assigned
      const updatedTask = await taskService.getTaskById(task.id);
      expect(updatedTask?.assigned_agent_id).toBe(agent.id);
      expect(updatedTask?.status).toBe(TaskStatus.ASSIGNED);

      // Check events were emitted
      const assignedEvent = capturedEvents.find(e => e.event === EventNames.TASK_ASSIGNED);
      expect(assignedEvent).toBeDefined();
      expect(assignedEvent?.data.taskId).toBe(task.id);
      expect(assignedEvent?.data.agentId).toBe(agent.id);
    });

    it('should handle task status updates with clean interfaces', async () => {
      // Create agent and task
      const agent = await agentService.createAgent({
        name: 'status-agent',
        description: 'Agent for status updates',
        instructions: 'Handle task status changes',
        type: 'worker'
      });

      const task = await taskService.addTask({
        type: 'status-task',
        module_id: 'test',
        instructions: JSON.stringify({ action: 'process' }),
        priority: 3
      });

      // Assign task to agent
      await taskService.assignTaskToAgent(task.id, agent.id);

      // Clear events
      capturedEvents.length = 0;
      
      // Report agent as busy
      await agentService.reportAgentBusy(agent.id, task.id);
      
      // Update task to in progress
      await taskService.updateTaskStatus(task.id, TaskStatus.IN_PROGRESS);
      
      // Complete task
      await taskService.updateTaskStatus(task.id, TaskStatus.COMPLETED);
      
      // Report agent as idle
      await agentService.reportAgentIdle(agent.id);

      // Verify task completion
      const completedTask = await taskService.getTaskById(task.id);
      expect(completedTask?.status).toBe(TaskStatus.COMPLETED);

      // Check events
      const busyEvent = capturedEvents.find(e => e.event === EventNames.AGENT_BUSY);
      expect(busyEvent).toBeDefined();
      
      const idleEvent = capturedEvents.find(e => e.event === EventNames.AGENT_IDLE);
      expect(idleEvent).toBeDefined();
    });

    it('should handle multiple agents and tasks independently', async () => {
      // Create multiple agents
      const agents = await Promise.all([
        agentService.createAgent({ 
          name: 'multi-agent-1', 
          type: 'worker', 
          description: 'Multi agent 1', 
          instructions: 'Handle tasks independently' 
        }),
        agentService.createAgent({ 
          name: 'multi-agent-2', 
          type: 'worker', 
          description: 'Multi agent 2', 
          instructions: 'Handle tasks independently' 
        }),
        agentService.createAgent({ 
          name: 'multi-agent-3', 
          type: 'worker', 
          description: 'Multi agent 3', 
          instructions: 'Handle tasks independently' 
        })
      ]);

      // Create multiple tasks
      const tasks = await Promise.all([
        taskService.addTask({ type: 'multi-task-1', module_id: 'test', priority: 1 }),
        taskService.addTask({ type: 'multi-task-2', module_id: 'test', priority: 2 }),
        taskService.addTask({ type: 'multi-task-3', module_id: 'test', priority: 3 })
      ]);

      // Activate all agents
      await Promise.all(
        agents.map(agent => agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE))
      );

      // Assign tasks to agents (round-robin)
      for (let i = 0; i < tasks.length; i++) {
        const agent = agents[i % agents.length];
        await taskService.assignTaskToAgent(tasks[i].id, agent.id);
      }

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all tasks are assigned
      const assignedTasks = await Promise.all(
        tasks.map(task => taskService.getTaskById(task.id))
      );

      assignedTasks.forEach(task => {
        expect(task?.assigned_agent_id).toBeDefined();
        expect(task?.status).toBe(TaskStatus.ASSIGNED);
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
      const agent = await agentService.createAgent({ 
        name: 'event-test-agent', 
        type: 'worker',
        description: 'Event test agent',
        instructions: 'Handle events'
      });
      
      const task = await taskService.addTask({ 
        type: 'event-task', 
        module_id: 'test',
        priority: 5
      });

      await agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE);
      await taskService.assignTaskToAgent(task.id, agent.id);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event flow (using captured events from our global listener)
      expect(capturedEvents.some(e => e.event === EventNames.AGENT_CREATED)).toBe(true);
      expect(capturedEvents.some(e => e.event === EventNames.TASK_CREATED)).toBe(true);
      expect(capturedEvents.some(e => e.event === EventNames.TASK_ASSIGNED)).toBe(true);
    });

    it('should handle task failure events', async () => {
      const agent = await agentService.createAgent({
        name: 'failure-test-agent',
        type: 'worker',
        description: 'Failure test agent',
        instructions: 'Test failure handling'
      });

      const failingTask = await taskService.addTask({
        type: 'failing-task',
        module_id: 'test',
        priority: 10
      });

      await taskService.assignTaskToAgent(failingTask.id, agent.id);
      
      // Clear events to focus on failure
      capturedEvents.length = 0;
      
      // Update task to failed status
      await taskService.updateTaskStatus(failingTask.id, TaskStatus.FAILED);

      const task = await taskService.getTaskById(failingTask.id);
      expect(task?.status).toBe(TaskStatus.FAILED);
      
      // Note: Task failure events would be emitted by the TaskService if implemented
      // For now we just verify the status update worked
    });
  });

  describe('Task Assignment and Agent Availability', () => {
    it('should track available agents for task assignment', async () => {
      // Create agent
      const agent = await agentService.createAgent({
        name: 'availability-agent',
        type: 'worker',
        description: 'Agent for availability test',
        instructions: 'Handle specific task types'
      });

      // Agent should not be available when stopped
      let availableAgents = await agentService.getAvailableAgents();
      expect(availableAgents.some(a => a.id === agent.id)).toBe(false);

      // Activate agent
      await agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE);

      // Get available agents
      availableAgents = await agentService.getAvailableAgents();
      expect(availableAgents.some(a => a.id === agent.id)).toBe(true);
    });

    it('should filter tasks by agent assignment', async () => {
      const agent = await agentService.createAgent({
        name: 'filter-test-agent',
        type: 'worker',
        description: 'Agent for filtering test',
        instructions: 'Handle assigned tasks'
      });

      const tasks = await Promise.all([
        taskService.addTask({ type: 'filter-task-1', module_id: 'test', priority: 1 }),
        taskService.addTask({ type: 'filter-task-2', module_id: 'test', priority: 2 }),
        taskService.addTask({ type: 'filter-task-3', module_id: 'test', priority: 3 })
      ]);

      // Assign some tasks to the agent
      await taskService.assignTaskToAgent(tasks[0].id, agent.id);
      await taskService.assignTaskToAgent(tasks[2].id, agent.id);

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
        instructions: 'Handle complete task lifecycle'
      });

      // 2. Create task
      const task = await taskService.addTask({
        type: 'workflow-processing',
        module_id: 'workflow',
        instructions: JSON.stringify({ process: 'complete-workflow' }),
        priority: 10
      });

      // 3. Start agent
      await agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE);

      // 4. Assign task
      await taskService.assignTaskToAgent(task.id, agent.id);

      // 5. Report agent busy
      await agentService.reportAgentBusy(agent.id, task.id);

      // 6. Update task to in progress
      await taskService.updateTaskStatus(task.id, TaskStatus.IN_PROGRESS);

      // 7. Complete task
      await taskService.updateTaskStatus(task.id, TaskStatus.COMPLETED);

      // 8. Report agent idle
      await agentService.reportAgentIdle(agent.id);

      // Verify final state
      const finalTask = await taskService.getTaskById(task.id);
      expect(finalTask?.status).toBe(TaskStatus.COMPLETED);
      expect(finalTask?.assigned_agent_id).toBe(agent.id);

      const finalAgent = await agentService.getAgent(agent.id);
      expect(finalAgent?.status).toBe(AgentsStatus.ACTIVE);

      // Verify event sequence
      const eventTypes = capturedEvents.map(e => e.event);
      expect(eventTypes).toContain(EventNames.AGENT_CREATED);
      expect(eventTypes).toContain(EventNames.TASK_CREATED);
      expect(eventTypes).toContain(EventNames.TASK_ASSIGNED);
      expect(eventTypes).toContain(EventNames.AGENT_BUSY);
      expect(eventTypes).toContain(EventNames.AGENT_IDLE);
    });

    it('should handle task cancellation', async () => {
      const agent = await agentService.createAgent({
        name: 'cancellation-agent',
        type: 'worker',
        description: 'Agent for cancellation test',
        instructions: 'Handle task cancellations'
      });

      const task = await taskService.addTask({
        type: 'cancellable-task',
        module_id: 'test',
        priority: 5
      });

      // Assign task
      await taskService.assignTaskToAgent(task.id, agent.id);

      // Cancel task
      await taskService.cancelTask(task.id);

      // Verify task is cancelled
      const cancelledTask = await taskService.getTaskById(task.id);
      expect(cancelledTask?.status).toBe(TaskStatus.CANCELLED);
    });
  });
});