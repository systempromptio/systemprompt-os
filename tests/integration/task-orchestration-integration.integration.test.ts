/**
 * Task Orchestration Integration Tests
 * Tests the coordination between Task and Agent modules through the orchestrator
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TaskOrchestratorService } from '@/modules/core/orchestration/services/task-orchestrator.service';
import { TaskService } from '@/modules/core/tasks/services/task.service';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LoggerMode, LogOutput } from '@/modules/core/logger/types';
import { createTestId, waitForEvent } from './setup';
import type { ITask } from '@/modules/core/tasks/types/index';
import type { IAgent } from '@/modules/core/agents/types/agent.types';

describe('Task Orchestration Integration Test', () => {
  let orchestrator: TaskOrchestratorService;
  let taskService: TaskService;
  let agentService: AgentService;
  let eventBus: EventBusService;
  let dbService: DatabaseService;
  let logger: LoggerService;
  
  const testSessionId = `orchestration-${createTestId()}`;
  const testDir = `${process.cwd()}/.test-integration/${testSessionId}`;
  const testDbPath = `${testDir}/test.db`;

  beforeAll(async () => {
    console.log(`🚀 Setting up orchestration integration test (session: ${testSessionId})...`);
    
    // Create test directory
    const fs = require('fs');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Initialize logger first with proper config
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
    
    eventBus = EventBusService.getInstance();
    
    // Initialize database with proper config
    await DatabaseService.initialize({
      type: 'sqlite',
      sqlite: {
        filename: testDbPath
      }
    }, logger);
    dbService = DatabaseService.getInstance();
    
    // Create comprehensive test schema
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        instructions TEXT DEFAULT '',
        type TEXT NOT NULL,
        status TEXT DEFAULT 'stopped',
        config TEXT DEFAULT '{}',
        capabilities TEXT DEFAULT '[]',
        tools TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_tasks INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        failed_tasks INTEGER DEFAULT 0
      )
    `);
    
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        module_id TEXT NOT NULL,
        instructions TEXT DEFAULT '{}',
        priority INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending',
        assigned_agent_id TEXT,
        progress INTEGER DEFAULT 0,
        result TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (assigned_agent_id) REFERENCES agents(id)
      )
    `);
    
    // Initialize services with required dependencies
    const { TaskRepository } = await import('@/modules/core/tasks/repositories/task.repository');
    const { AgentRepository } = await import('@/modules/core/agents/repositories/agent.repository');
    
    const taskRepository = new TaskRepository(dbService);
    const agentRepository = new AgentRepository(dbService);
    
    // Initialize event bus before services
    eventBus = EventBusService.getInstance();
    
    taskService = TaskService.getInstance();
    await taskService.initialize(logger, taskRepository);
    
    agentService = AgentService.getInstance();
    agentService.initialize(agentRepository, logger);
    
    orchestrator = TaskOrchestratorService.getInstance();
    
    // Setup orchestrator with comprehensive APIs
    const taskAPI = {
      createTask: taskService.createTask.bind(taskService),
      getTask: taskService.getTaskById.bind(taskService),
      updateTask: taskService.updateTask.bind(taskService),
      deleteTask: taskService.deleteTask.bind(taskService),
      assignTaskToAgent: taskService.assignTaskToAgent.bind(taskService),
      unassignTask: taskService.unassignTask.bind(taskService),
      getTasksByAgent: taskService.getTasksByAgentId.bind(taskService),
      getTasksByStatus: taskService.getTasksByStatus.bind(taskService),
      getNextAvailableTask: taskService.getNextAvailableTask.bind(taskService),
      updateTaskStatus: taskService.updateTaskStatus.bind(taskService),
      updateTaskProgress: taskService.updateTaskProgress.bind(taskService),
      completeTask: taskService.completeTask.bind(taskService),
      failTask: taskService.failTask.bind(taskService)
    };
    
    const agentAPI = {
      createAgent: agentService.create.bind(agentService),
      getAgent: agentService.getById.bind(agentService),
      updateAgent: agentService.update.bind(agentService),
      deleteAgent: agentService.delete.bind(agentService),
      startAgent: agentService.start.bind(agentService),
      stopAgent: agentService.stop.bind(agentService),
      isAgentAvailable: agentService.isAvailable.bind(agentService),
      getAvailableAgents: agentService.getAvailable.bind(agentService),
      reportAgentBusy: agentService.reportBusy.bind(agentService),
      reportAgentIdle: agentService.reportIdle.bind(agentService),
      listAgents: agentService.list.bind(agentService),
      getAgentCapabilities: agentService.getCapabilities.bind(agentService)
    };
    
    orchestrator.initialize(taskAPI, agentAPI);
    
    console.log('✅ Orchestration integration test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up orchestration test (session: ${testSessionId})...`);
    
    eventBus.removeAllListeners();
    try {
      await dbService.disconnect();
    } catch (error) {
      // Ignore close errors during cleanup
    }
    
    // Clean up test files
    const fs = require('fs');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    console.log('✅ Cleanup complete!');
  });

  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  describe('Task Assignment Orchestration', () => {
    it('should assign next available task to agent', async () => {
      // Create agent with specific capabilities
      const agent = await agentService.create({
        id: `assign-agent-${createTestId()}`,
        name: 'Assignment Test Agent',
        type: 'processor',
        capabilities: ['data-processing', 'analysis']
      });
      
      // Create multiple tasks with different priorities
      const highPriorityTask = await taskService.createTask({
        type: 'data-processing',
        moduleId: 'analytics',
        instructions: { operation: 'analyze', dataset: 'sales' },
        priority: 10
      });
      
      const lowPriorityTask = await taskService.createTask({
        type: 'data-processing',
        moduleId: 'analytics',
        instructions: { operation: 'summarize', dataset: 'inventory' },
        priority: 3
      });
      
      // Start agent to make it available
      await agentService.start(agent.id);
      
      // Assign next available task
      const assignedTask = await orchestrator.assignNextAvailableTask(agent.id);
      
      expect(assignedTask).not.toBeNull();
      expect(assignedTask!.id).toBe(highPriorityTask.id); // Should pick highest priority
      expect(assignedTask!.assignedAgentId).toBe(agent.id);
      
      // Verify agent status changed
      const updatedAgent = await agentService.getById(agent.id);
      expect(updatedAgent!.status).toBe('busy');
    });

    it('should assign task to optimal agent based on capabilities', async () => {
      // Create agents with different capabilities
      const dataAgent = await agentService.create({
        id: `data-agent-${createTestId()}`,
        name: 'Data Processing Agent',
        type: 'specialist',
        capabilities: ['data-processing', 'statistics']
      });
      
      const webAgent = await agentService.create({
        id: `web-agent-${createTestId()}`,
        name: 'Web Scraping Agent',
        type: 'specialist',
        capabilities: ['web-scraping', 'parsing']
      });
      
      const generalAgent = await agentService.create({
        id: `general-agent-${createTestId()}`,
        name: 'General Purpose Agent',
        type: 'general',
        capabilities: ['general', 'utility']
      });
      
      // Start all agents
      await Promise.all([
        agentService.start(dataAgent.id),
        agentService.start(webAgent.id),
        agentService.start(generalAgent.id)
      ]);
      
      // Create task requiring specific capability
      const webTask = await taskService.createTask({
        type: 'web-scraping',
        moduleId: 'scraper',
        instructions: { url: 'https://example.com', selector: '.data' }
      });
      
      // Assign to optimal agent
      const assignedAgentId = await orchestrator.assignTaskToOptimalAgent(webTask.id!);
      
      expect(assignedAgentId).toBe(webAgent.id); // Should pick the specialist
      
      // Verify assignment
      const updatedTask = await taskService.getTaskById(webTask.id!);
      expect(updatedTask!.assignedAgentId).toBe(webAgent.id);
    });

    it('should handle no available agents gracefully', async () => {
      // Create task
      const task = await taskService.createTask({
        type: 'impossible-task',
        moduleId: 'test',
        instructions: { action: 'process' }
      });
      
      // Try to assign without any available agents
      const assignedAgentId = await orchestrator.assignTaskToOptimalAgent(task.id!);
      
      expect(assignedAgentId).toBeNull();
      
      // Task should remain unassigned
      const updatedTask = await taskService.getTaskById(task.id!);
      expect(updatedTask!.assignedAgentId).toBeNull();
    });

    it('should handle agent workload distribution', async () => {
      // Create multiple agents
      const agents = await Promise.all([
        agentService.create({
          id: `workload-agent-1-${createTestId()}`,
          name: 'Workload Agent 1',
          type: 'worker'
        }),
        agentService.create({
          id: `workload-agent-2-${createTestId()}`,
          name: 'Workload Agent 2',
          type: 'worker'
        }),
        agentService.create({
          id: `workload-agent-3-${createTestId()}`,
          name: 'Workload Agent 3',
          type: 'worker'
        })
      ]);
      
      // Start all agents
      await Promise.all(agents.map(agent => agentService.start(agent.id)));
      
      // Create and assign multiple tasks
      const tasks = [];
      for (let i = 0; i < 6; i++) {
        const task = await taskService.createTask({
          type: 'workload-test',
          moduleId: 'test',
          instructions: { index: i }
        });
        tasks.push(task);
      }
      
      // Assign tasks to agents
      for (const task of tasks) {
        await orchestrator.assignTaskToOptimalAgent(task.id!);
      }
      
      // Check workload distribution
      const workloads = await Promise.all(
        agents.map(agent => orchestrator.getAgentWorkload(agent.id))
      );
      
      expect(workloads.every(w => w >= 0)).toBe(true);
      expect(workloads.reduce((sum, w) => sum + w, 0)).toBeGreaterThan(0);
    });
  });

  describe('Task Execution Orchestration', () => {
    it('should execute task end-to-end with progress tracking', async () => {
      // Create agent and task
      const agent = await agentService.create({
        id: `exec-agent-${createTestId()}`,
        name: 'Execution Agent',
        type: 'executor'
      });
      
      const task = await taskService.createTask({
        type: 'execution-test',
        moduleId: 'test',
        instructions: { command: 'process', iterations: 5 }
      });
      
      await agentService.start(agent.id);
      await taskService.assignTaskToAgent(task.id!, agent.id);
      
      // Track progress updates
      const progressUpdates: number[] = [];
      eventBus.on('task.progress', ({ progress }) => {
        progressUpdates.push(progress);
      });
      
      // Execute task
      await orchestrator.executeTask(agent.id, task.id!);
      
      // Verify task completion
      const completedTask = await taskService.getTaskById(task.id!);
      expect(completedTask!.status).toBe('completed');
      expect(completedTask!.result).toBeDefined();
      expect(completedTask!.completedAt).toBeDefined();
      
      // Verify agent returned to available status
      const updatedAgent = await agentService.getById(agent.id);
      expect(updatedAgent!.status).toBe('active');
    });

    it('should handle task execution failures', async () => {
      // Create agent and task that will fail
      const agent = await agentService.create({
        id: `fail-agent-${createTestId()}`,
        name: 'Failure Test Agent',
        type: 'executor'
      });
      
      const task = await taskService.createTask({
        type: 'failing-task',
        moduleId: 'test',
        instructions: { shouldFail: true }
      });
      
      await agentService.start(agent.id);
      await taskService.assignTaskToAgent(task.id!, agent.id);
      
      // Mock task service to fail
      const originalCompleteTask = taskService.completeTask;
      taskService.completeTask = async () => {
        throw new Error('Simulated task execution failure');
      };
      
      try {
        await orchestrator.executeTask(agent.id, task.id!);
        expect.fail('Task execution should have failed');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      
      // Restore original method
      taskService.completeTask = originalCompleteTask;
      
      // Verify task is marked as failed
      const failedTask = await taskService.getTaskById(task.id!);
      expect(failedTask!.status).toBe('failed');
      expect(failedTask!.error).toBeDefined();
    });

    it('should retry failed tasks', async () => {
      // Create agent and task
      const agent = await agentService.create({
        id: `retry-agent-${createTestId()}`,
        name: 'Retry Test Agent',
        type: 'executor'
      });
      
      const task = await taskService.createTask({
        type: 'retry-test',
        moduleId: 'test',
        instructions: { retryable: true }
      });
      
      await agentService.start(agent.id);
      
      // Manually set task to failed state
      await taskService.updateTaskStatus(task.id!, 'failed' as any);
      await taskService.failTask(task.id!, 'Initial failure for retry test');
      
      // Retry the task
      await orchestrator.retryFailedTask(task.id!);
      
      // Verify task is back to pending
      const retriedTask = await taskService.getTaskById(task.id!);
      expect(retriedTask!.status).toBe('pending');
    });

    it('should handle concurrent task execution', async () => {
      // Create multiple agents
      const agents = await Promise.all([
        agentService.create({
          id: `concurrent-agent-1-${createTestId()}`,
          name: 'Concurrent Agent 1',
          type: 'executor'
        }),
        agentService.create({
          id: `concurrent-agent-2-${createTestId()}`,
          name: 'Concurrent Agent 2',
          type: 'executor'
        }),
        agentService.create({
          id: `concurrent-agent-3-${createTestId()}`,
          name: 'Concurrent Agent 3',
          type: 'executor'
        })
      ]);
      
      // Create multiple tasks
      const tasks = await Promise.all([
        taskService.createTask({
          type: 'concurrent-task-1',
          moduleId: 'test',
          instructions: { duration: 100 }
        }),
        taskService.createTask({
          type: 'concurrent-task-2',
          moduleId: 'test',
          instructions: { duration: 150 }
        }),
        taskService.createTask({
          type: 'concurrent-task-3',
          moduleId: 'test',
          instructions: { duration: 200 }
        })
      ]);
      
      // Start all agents
      await Promise.all(agents.map(agent => agentService.start(agent.id)));
      
      // Assign tasks to agents
      for (let i = 0; i < tasks.length; i++) {
        await taskService.assignTaskToAgent(tasks[i].id!, agents[i].id);
      }
      
      // Execute all tasks concurrently
      const executions = agents.map((agent, i) => 
        orchestrator.executeTask(agent.id, tasks[i].id!)
      );
      
      await Promise.all(executions);
      
      // Verify all tasks completed
      const completedTasks = await Promise.all(
        tasks.map(task => taskService.getTaskById(task.id!))
      );
      
      completedTasks.forEach(task => {
        expect(task!.status).toBe('completed');
      });
    });
  });

  describe('Orchestration Monitoring and Metrics', () => {
    it('should provide accurate task queue status', async () => {
      // Create tasks in different states
      const pendingTask = await taskService.createTask({
        type: 'pending-task',
        moduleId: 'test'
      });
      
      const runningTask = await taskService.createTask({
        type: 'running-task',
        moduleId: 'test'
      });
      await taskService.updateTaskStatus(runningTask.id!, 'in_progress' as any);
      
      const completedTask = await taskService.createTask({
        type: 'completed-task',
        moduleId: 'test'
      });
      await taskService.updateTaskStatus(completedTask.id!, 'completed' as any);
      
      // Get queue status
      const queueStatus = await orchestrator.getTaskQueueStatus();
      
      expect(queueStatus.pending).toBeGreaterThanOrEqual(1);
      expect(queueStatus.running).toBeGreaterThanOrEqual(1);
      expect(queueStatus.completed).toBeGreaterThanOrEqual(1);
    });

    it('should track agent workload accurately', async () => {
      // Create agent with known workload
      const agent = await agentService.create({
        id: `workload-track-agent-${createTestId()}`,
        name: 'Workload Tracking Agent',
        type: 'worker'
      });
      
      await agentService.start(agent.id);
      
      // Create and assign multiple tasks
      const tasks = [];
      for (let i = 0; i < 3; i++) {
        const task = await taskService.createTask({
          type: 'workload-task',
          moduleId: 'test',
          instructions: { index: i }
        });
        await taskService.assignTaskToAgent(task.id!, agent.id);
        await taskService.updateTaskStatus(task.id!, 'in_progress' as any);
        tasks.push(task);
      }
      
      // Check workload
      const workload = await orchestrator.getAgentWorkload(agent.id);
      expect(workload).toBe(3);
      
      // Complete one task
      await taskService.updateTaskStatus(tasks[0].id!, 'completed' as any);
      
      // Check updated workload
      const updatedWorkload = await orchestrator.getAgentWorkload(agent.id);
      expect(updatedWorkload).toBe(2);
    });

    it('should handle orchestration edge cases', async () => {
      // Test with non-existent agent
      const nonExistentWorkload = await orchestrator.getAgentWorkload('non-existent-agent');
      expect(nonExistentWorkload).toBe(0);
      
      // Test assignment to non-existent agent
      const task = await taskService.createTask({
        type: 'edge-case-task',
        moduleId: 'test'
      });
      
      const assignment = await orchestrator.assignNextAvailableTask('non-existent-agent');
      expect(assignment).toBeNull();
      
      // Test retry of non-existent task
      try {
        await orchestrator.retryFailedTask(999999);
        expect.fail('Should have thrown error for non-existent task');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Integration with Event System', () => {
    it('should coordinate orchestration through events', async () => {
      const orchestrationEvents: string[] = [];
      
      // Track orchestration-related events
      eventBus.on('orchestration.task.assigned', () => {
        orchestrationEvents.push('task.assigned');
      });
      
      eventBus.on('orchestration.task.executed', () => {
        orchestrationEvents.push('task.executed');
      });
      
      eventBus.on('orchestration.agent.busy', () => {
        orchestrationEvents.push('agent.busy');
      });
      
      // Create agent and task
      const agent = await agentService.create({
        id: `event-coord-agent-${createTestId()}`,
        name: 'Event Coordination Agent',
        type: 'coordinator'
      });
      
      const task = await taskService.createTask({
        type: 'coordination-test',
        moduleId: 'test',
        instructions: { coordinate: true }
      });
      
      await agentService.start(agent.id);
      
      // Trigger orchestration events
      eventBus.emit('orchestration.task.assigned', { taskId: task.id, agentId: agent.id });
      eventBus.emit('orchestration.agent.busy', { agentId: agent.id });
      eventBus.emit('orchestration.task.executed', { taskId: task.id });
      
      await waitForEvent(100);
      
      expect(orchestrationEvents).toEqual([
        'task.assigned',
        'agent.busy',
        'task.executed'
      ]);
    });

    it('should handle event-driven task assignment', async () => {
      let autoAssignmentCount = 0;
      
      // Setup auto-assignment handler
      eventBus.on('orchestration.auto.assign', async ({ agentId }) => {
        const task = await orchestrator.assignNextAvailableTask(agentId);
        if (task) {
          autoAssignmentCount++;
        }
      });
      
      // Create agent and tasks
      const agent = await agentService.create({
        id: `auto-assign-agent-${createTestId()}`,
        name: 'Auto Assignment Agent',
        type: 'auto'
      });
      
      await agentService.start(agent.id);
      
      const tasks = await Promise.all([
        taskService.createTask({ type: 'auto-task-1', moduleId: 'test' }),
        taskService.createTask({ type: 'auto-task-2', moduleId: 'test' }),
        taskService.createTask({ type: 'auto-task-3', moduleId: 'test' })
      ]);
      
      // Trigger auto-assignment events
      for (let i = 0; i < 3; i++) {
        eventBus.emit('orchestration.auto.assign', { agentId: agent.id });
        await waitForEvent(50);
      }
      
      expect(autoAssignmentCount).toBe(3);
    });
  });
});