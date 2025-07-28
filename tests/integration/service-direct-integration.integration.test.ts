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

describe('Agent-Task Simple Integration Test', () => {
  let eventBus: EventBusService;
  let taskService: TaskService;
  let taskRepository: TaskRepository;
  let agentService: AgentService;
  let agentRepository: AgentRepository;
  let database: DatabaseService;
  let logger: LoggerService;
  
  let createdAgent: IAgent;
  let createdTask: ITask;
  
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

    // Initialize logger first
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
          config TEXT DEFAULT '{}',
          capabilities TEXT DEFAULT '[]',
          tools TEXT DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          assigned_tasks INTEGER DEFAULT 0,
          completed_tasks INTEGER DEFAULT 0,
          failed_tasks INTEGER DEFAULT 0,
          last_heartbeat TIMESTAMP
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

  describe('Clean Module Separation', () => {
    it('should create agent without task knowledge', async () => {
      createdAgent = await agentService.createAgent({
        name: 'test-agent',
        description: 'Test agent for integration testing',
        instructions: 'Process tasks and report results',
        type: 'worker',
        capabilities: ['data-processing']
      });

      expect(createdAgent).toBeDefined();
      expect(createdAgent.id).toBeDefined();
      expect(createdAgent.status).toBe('stopped');
      
      // Check event
      const event = capturedEvents.find(e => e.event === EventNames.AGENT_CREATED);
      expect(event).toBeDefined();
      expect(event?.data.agentId).toBe(createdAgent.id);
    });

    it('should create task without agent knowledge', async () => {
      createdTask = await taskService.addTask({
        type: 'test-task',
        moduleId: 'test',
        priority: 5,
        status: TaskStatusEnum.PENDING
      });

      expect(createdTask).toBeDefined();
      expect(createdTask.id).toBeDefined();
      expect(createdTask.assignedAgentId).toBeUndefined();
      
      // Check event
      const event = capturedEvents.find(e => 
        e.event === EventNames.TASK_CREATED && 
        e.data.taskId === createdTask.id
      );
      expect(event).toBeDefined();
    });

    it('should start agent and emit availability', async () => {
      await agentService.startAgent(createdAgent.id);
      
      const agent = await agentService.getAgent(createdAgent.id);
      expect(agent?.status).toBe('active');
      
      // Check events
      const startedEvent = capturedEvents.find(e => 
        e.event === EventNames.AGENT_STARTED && 
        e.data.agentId === createdAgent.id
      );
      expect(startedEvent).toBeDefined();
      
      const availableEvent = capturedEvents.find(e => 
        e.event === EventNames.AGENT_AVAILABLE && 
        e.data.agentId === createdAgent.id
      );
      expect(availableEvent).toBeDefined();
    });

    it('should assign task to agent through task service', async () => {
      capturedEvents.length = 0; // Clear events
      
      await taskService.assignTaskToAgent(createdTask.id!, createdAgent.id);
      
      const task = await taskService.getTask(createdTask.id!);
      expect(task?.assignedAgentId).toBe(createdAgent.id);
      expect(task?.status).toBe(TaskStatusEnum.ASSIGNED);
      
      // Check event
      const assignedEvent = capturedEvents.find(e => e.event === EventNames.TASK_ASSIGNED);
      expect(assignedEvent).toBeDefined();
      expect(assignedEvent?.data.taskId).toBe(createdTask.id);
      expect(assignedEvent?.data.agentId).toBe(createdAgent.id);
    });

    it('should report agent as busy', async () => {
      capturedEvents.length = 0;
      
      await agentService.reportAgentBusy(createdAgent.id, createdTask.id!);
      
      // Check event
      const busyEvent = capturedEvents.find(e => e.event === EventNames.AGENT_BUSY);
      expect(busyEvent).toBeDefined();
      expect(busyEvent?.data.agentId).toBe(createdAgent.id);
      expect(busyEvent?.data.taskId).toBe(createdTask.id);
    });

    it('should complete task and emit event', async () => {
      capturedEvents.length = 0;
      
      await taskService.completeTask(createdTask.id!, 'Task completed successfully');
      
      const task = await taskService.getTask(createdTask.id!);
      expect(task?.status).toBe(TaskStatusEnum.COMPLETED);
      expect(task?.result).toContain('completed successfully');
      
      // Check event
      const completedEvent = capturedEvents.find(e => e.event === EventNames.TASK_COMPLETED);
      expect(completedEvent).toBeDefined();
      expect(completedEvent?.data.taskId).toBe(createdTask.id);
    });

    it('should report agent as idle', async () => {
      capturedEvents.length = 0;
      
      await agentService.reportAgentIdle(createdAgent.id, true);
      
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

      await taskService.assignTaskToAgent(failingTask.id!, createdAgent.id);
      
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
      const availableAgents = await agentService.getAvailableAgents();
      expect(availableAgents).toHaveLength(1);
      expect(availableAgents[0].id).toBe(createdAgent.id);
    });

    it('should filter tasks by agent', async () => {
      const agentTasks = await taskService.getTasksByAgent(createdAgent.id);
      expect(agentTasks.length).toBeGreaterThan(0);
      expect(agentTasks.some(t => t.id === createdTask.id)).toBe(true);
    });
  });
});