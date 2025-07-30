/**
 * Simple integration test for Agent-Task separation
 * Uses direct module initialization without ModuleManager
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { execSync } from 'child_process';

// Test configuration
const TEST_SESSION_ID = `integration-simple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const TEST_CONFIG = {
  tempDir: join(process.cwd(), '.test-integration', TEST_SESSION_ID),
  dbPath: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'test.db'),
};

describe.sequential('Agent-Task Simple Integration Test', () => {
  let eventBus: EventBusService;
  let taskService: TaskService;
  let taskRepository: TaskRepository;
  let agentService: AgentService;
  let agentRepository: AgentRepository;
  let database: DatabaseService;
  let logger: LoggerService;
  
  // Shared state container that persists across tests
  const testState = {
    createdAgent: null as IAgent | null,
    createdTask: null as ITask | null
  };
  
  // Track events
  const capturedEvents: Array<{ event: string; data: any }> = [];

  beforeAll(async () => {
    console.log(`🚀 Setting up simple integration test (session: ${TEST_SESSION_ID})...`);
    
    // Create test directory
    if (!existsSync(TEST_CONFIG.tempDir)) {
      mkdirSync(TEST_CONFIG.tempDir, { recursive: true });
    }

    // Set environment
    process.env.DATABASE_FILE = TEST_CONFIG.dbPath;
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';

    // Initialize logger service for test environment
    const { LoggerMode, LogOutput } = await import('@/modules/core/logger/types/index');
    logger = LoggerService.getInstance();
    logger.initialize({
      stateDir: TEST_CONFIG.tempDir,
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
    
    // Initialize database with proper config
    const dbConfig = {
      type: 'sqlite' as const,
      sqlite: {
        filename: TEST_CONFIG.dbPath
      }
    };
    
    // Initialize database service
    await DatabaseService.initialize(dbConfig, logger);
    database = DatabaseService.getInstance();
    
    // Create necessary database schema manually
    try {
      console.log(`Creating database schema at: ${TEST_CONFIG.dbPath}`);
      
      // Create agents table
      await database.execute(`
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL,
          instructions TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('worker', 'monitor', 'coordinator')),
          status TEXT NOT NULL DEFAULT 'stopped' CHECK(status IN ('idle', 'active', 'stopped', 'error')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          assigned_tasks INTEGER DEFAULT 0,
          completed_tasks INTEGER DEFAULT 0,
          failed_tasks INTEGER DEFAULT 0
        );
      `);
      
      // Create agent_capabilities table
      await database.execute(`
        CREATE TABLE IF NOT EXISTS agent_capabilities (
          agent_id TEXT NOT NULL,
          capability TEXT NOT NULL,
          PRIMARY KEY (agent_id, capability),
          FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
        );
      `);
      
      // Create agent_tools table
      await database.execute(`
        CREATE TABLE IF NOT EXISTS agent_tools (
          agent_id TEXT NOT NULL,
          tool TEXT NOT NULL,
          PRIMARY KEY (agent_id, tool),
          FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
        );
      `);
      
      // Create agent_config table
      await database.execute(`
        CREATE TABLE IF NOT EXISTS agent_config (
          agent_id TEXT NOT NULL,
          config_key TEXT NOT NULL,
          config_value TEXT NOT NULL,
          PRIMARY KEY (agent_id, config_key),
          FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
        );
      `);
      
      // Create task table
      await database.execute(`
        CREATE TABLE IF NOT EXISTS task (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type VARCHAR(100) NOT NULL,
          module_id VARCHAR(100) NOT NULL,
          instructions JSON,
          priority INTEGER DEFAULT 0,
          status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled', 'stopped')),
          retry_count INTEGER DEFAULT 0,
          max_executions INTEGER DEFAULT 3,
          max_time INTEGER,
          result TEXT,
          error TEXT,
          progress INTEGER,
          assigned_agent_id VARCHAR(255),
          scheduled_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          created_by VARCHAR(255),
          metadata JSON
        );
      `);
      
      // Create indexes
      await database.execute('CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);');
      await database.execute('CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);');
      await database.execute('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);');
      await database.execute('CREATE INDEX IF NOT EXISTS idx_task_status ON task(status);');
      await database.execute('CREATE INDEX IF NOT EXISTS idx_task_type ON task(type);');
      
      console.log('Database schema created successfully');
    } catch (error) {
      console.error('Failed to create database schema:', error);
      throw error;
    }

    // Initialize event bus
    eventBus = EventBusService.getInstance();

    // Initialize repositories
    taskRepository = new TaskRepository(database);
    agentRepository = AgentRepository.getInstance();

    // Initialize services
    taskService = TaskService.getInstance();
    taskService.initialize(logger, taskRepository);

    agentService = AgentService.getInstance();

    // Capture all events
    Object.values(EventNames).forEach(eventName => {
      eventBus.on(eventName, (data: any) => {
        capturedEvents.push({ event: eventName, data });
      });
    });

    console.log('✅ Simple integration test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up test (session: ${TEST_SESSION_ID})...`);
    
    if (existsSync(TEST_CONFIG.tempDir)) {
      rmSync(TEST_CONFIG.tempDir, { recursive: true, force: true });
    }

    console.log('✅ Cleanup complete!');
  });

  describe.sequential('Clean Module Separation', () => {
    it('should create agent without task knowledge', async () => {
      try {
        testState.createdAgent = await agentService.createAgent({
          name: 'test-agent',
          description: 'Test agent for integration testing',
          instructions: 'Process tasks and report results',
          type: 'worker',
          capabilities: ['data-processing']
        });

        console.log('Created agent:', { id: testState.createdAgent?.id, name: testState.createdAgent?.name, status: testState.createdAgent?.status });

        expect(testState.createdAgent).toBeDefined();
        expect(testState.createdAgent.id).toBeDefined();
        expect(testState.createdAgent.status).toBe('stopped');
        
        // Check event
        const event = capturedEvents.find(e => e.event === EventNames.AGENT_CREATED);
        expect(event).toBeDefined();
        expect(event?.data.agentId).toBe(testState.createdAgent.id);
      } catch (error) {
        console.error('Failed to create agent:', error);
        throw error;
      }
    });

    it('should create task without agent knowledge', async () => {
      testState.createdTask = await taskService.addTask({
        type: 'test-task',
        moduleId: 'test',
        priority: 5,
        status: TaskStatusEnum.PENDING
      });

      expect(testState.createdTask).toBeDefined();
      expect(testState.createdTask.id).toBeDefined();
      expect(testState.createdTask.assignedAgentId).toBeUndefined();
      
      // Check event
      const event = capturedEvents.find(e => 
        e.event === EventNames.TASK_CREATED && 
        e.data.taskId === testState.createdTask!.id
      );
      expect(event).toBeDefined();
    });

    it('should start agent and emit availability', async () => {
      console.log('Starting agent test, createdAgent:', { id: testState.createdAgent?.id, status: testState.createdAgent?.status });
      
      if (!testState.createdAgent?.id) {
        throw new Error('Created agent is not available - previous test may have failed');
      }
      
      await agentService.startAgent(testState.createdAgent.id);
      
      const agent = await agentService.getAgent(testState.createdAgent.id);
      expect(agent?.status).toBe('active');
      
      // Check events
      const startedEvent = capturedEvents.find(e => 
        e.event === EventNames.AGENT_STARTED && 
        e.data.agentId === testState.createdAgent!.id
      );
      expect(startedEvent).toBeDefined();
      
      const availableEvent = capturedEvents.find(e => 
        e.event === EventNames.AGENT_AVAILABLE && 
        e.data.agentId === testState.createdAgent!.id
      );
      expect(availableEvent).toBeDefined();
    });

    it('should assign task to agent through task service', async () => {
      if (!testState.createdAgent?.id || !testState.createdTask?.id) {
        throw new Error('Created agent or task is not available - previous tests may have failed');
      }
      
      capturedEvents.length = 0; // Clear events
      
      await taskService.assignTaskToAgent(testState.createdTask.id!, testState.createdAgent.id);
      
      const task = await taskService.getTask(testState.createdTask.id!);
      expect(task?.assignedAgentId).toBe(testState.createdAgent.id);
      expect(task?.status).toBe(TaskStatusEnum.ASSIGNED);
      
      // Check event
      const assignedEvent = capturedEvents.find(e => e.event === EventNames.TASK_ASSIGNED);
      expect(assignedEvent).toBeDefined();
      expect(assignedEvent?.data.taskId).toBe(testState.createdTask.id);
      expect(assignedEvent?.data.agentId).toBe(testState.createdAgent.id);
    });

    it('should report agent as busy', async () => {
      capturedEvents.length = 0;
      
      if (!testState.createdAgent?.id || !testState.createdTask?.id) {
        throw new Error('Created agent or task is not available - previous tests may have failed');
      }
      
      await agentService.reportAgentBusy(testState.createdAgent.id, testState.createdTask.id!);
      
      // Check event
      const busyEvent = capturedEvents.find(e => e.event === EventNames.AGENT_BUSY);
      expect(busyEvent).toBeDefined();
      expect(busyEvent?.data.agentId).toBe(testState.createdAgent.id);
      expect(busyEvent?.data.taskId).toBe(testState.createdTask.id);
    });

    it('should complete task and emit event', async () => {
      capturedEvents.length = 0;
      
      await taskService.completeTask(testState.createdTask!.id!, 'Task completed successfully');
      
      const task = await taskService.getTask(testState.createdTask!.id!);
      expect(task?.status).toBe(TaskStatusEnum.COMPLETED);
      expect(task?.result).toContain('completed successfully');
      
      // Check event
      const completedEvent = capturedEvents.find(e => e.event === EventNames.TASK_COMPLETED);
      expect(completedEvent).toBeDefined();
      expect(completedEvent?.data.taskId).toBe(testState.createdTask!.id);
    });

    it('should report agent as idle', async () => {
      capturedEvents.length = 0;
      
      if (!testState.createdAgent?.id) {
        throw new Error('Created agent is not available - previous tests may have failed');
      }
      
      await agentService.reportAgentIdle(testState.createdAgent.id, true);
      
      // Check events
      const idleEvent = capturedEvents.find(e => e.event === EventNames.AGENT_IDLE);
      expect(idleEvent).toBeDefined();
      
      const availableEvent = capturedEvents.find(e => e.event === EventNames.AGENT_AVAILABLE);
      expect(availableEvent).toBeDefined();
    });

    it('should handle task failure', async () => {
      const failingTask = await taskService.addTask({
        type: 'failing-task',
        moduleId: 'test',
        priority: 10
      });

      await taskService.assignTaskToAgent(failingTask.id!, testState.createdAgent!.id);
      
      capturedEvents.length = 0;
      
      await taskService.failTask(failingTask.id!, 'Test failure');
      
      const task = await taskService.getTask(failingTask.id!);
      expect(task?.status).toBe(TaskStatusEnum.FAILED);
      expect(task?.error).toBe('Test failure');
      
      // Check event
      const failedEvent = capturedEvents.find(e => e.event === EventNames.TASK_FAILED);
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.data.error).toBe('Test failure');
    });

    it('should get available agents', async () => {
      // Debug: Check the agent status before checking availability
      const currentAgent = await agentService.getAgent(testState.createdAgent!.id);
      console.log('Current agent status before getAvailableAgents:', currentAgent?.status);
      
      const availableAgents = await agentService.getAvailableAgents();
      console.log('Available agents found:', availableAgents.length);
      
      expect(availableAgents).toHaveLength(1);
      expect(availableAgents[0].id).toBe(testState.createdAgent!.id);
    });

    it('should filter tasks by agent', async () => {
      const agentTasks = await taskService.getTasksByAgent(testState.createdAgent!.id);
      expect(agentTasks.length).toBeGreaterThan(0);
      expect(agentTasks.some(t => t.id === testState.createdTask!.id)).toBe(true);
    });
  });
});