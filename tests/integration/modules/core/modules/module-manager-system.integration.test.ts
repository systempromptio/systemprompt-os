/**
 * Integration test for the actual module system implementation
 * 
 * This test demonstrates the actual ModuleManagerService functionality
 * for module registration, discovery, and database operations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';
import { AgentsModule } from '@/modules/core/agents/index';
import { TasksModule } from '@/modules/core/tasks/index';
import type { IAgent } from '@/modules/core/agents/types/agent.types';
import type { ITask } from '@/modules/core/tasks/types/index';
import { TaskStatusEnum } from '@/modules/core/tasks/types/index';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';

// Test configuration
const TEST_SESSION_ID = `integration-clean-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const TEST_CONFIG = {
  tempDir: join(process.cwd(), '.test-integration', TEST_SESSION_ID),
  dbPath: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'test.db'),
  envVars: {
    NODE_ENV: 'test',
    DATABASE_FILE: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'test.db'),
    STATE_PATH: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'state'),
    PROJECTS_PATH: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'projects'),
    CONFIG_PATH: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'config'),
    LOG_LEVEL: 'error',
    JWT_SECRET: 'test-secret-key',
    PORT: '0',
    DISABLE_SERVER: 'true',
    TEST_SESSION_ID,
  }
};

describe('Module System Integration Test', () => {
  let moduleManager: ModuleManagerService;
  let agentsModule: AgentsModule;
  let tasksModule: TasksModule;
  let createdAgent: IAgent;
  let createdTask: ITask;

  beforeAll(async () => {
    // Setup test environment
    console.log(`🚀 Setting up module system integration test (session: ${TEST_SESSION_ID})...`);
    
    // Create test directories
    [
      TEST_CONFIG.tempDir,
      TEST_CONFIG.envVars.STATE_PATH,
      TEST_CONFIG.envVars.PROJECTS_PATH,
      TEST_CONFIG.envVars.CONFIG_PATH,
      join(TEST_CONFIG.envVars.STATE_PATH, 'auth', 'keys'),
      join(TEST_CONFIG.envVars.STATE_PATH, 'logs'),
    ].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });

    // Set environment variables
    Object.entries(TEST_CONFIG.envVars).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Initialize services
    const LoggerService = (await import('@/modules/core/logger/services/logger.service')).LoggerService;
    const DatabaseService = (await import('@/modules/core/database/services/database.service')).DatabaseService;
    const { LoggerMode, LogOutput } = await import('@/modules/core/logger/types/index');
    
    // Initialize logger
    const logger = LoggerService.getInstance();
    logger.initialize({
      stateDir: TEST_CONFIG.envVars.STATE_PATH,
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
    
    // Initialize database
    const dbConfig = {
      type: 'sqlite' as const,
      sqlite: {
        filename: TEST_CONFIG.dbPath
      }
    };
    await DatabaseService.initialize(dbConfig, logger);
    const database = DatabaseService.getInstance();
    
    // Create database schema
    await database.execute(`
      CREATE TABLE IF NOT EXISTS modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        version TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        path TEXT,
        dependencies TEXT,
        config TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
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
    
    // Create module manager config  
    const moduleConfig = {
      injectablePath: join(TEST_CONFIG.tempDir, 'modules'),
      autoLoad: true
    };
    
    // Create module manager repository with database service
    const { ModuleManagerRepository } = await import('@/modules/core/modules/repositories/module-manager.repository');
    const moduleRepository = ModuleManagerRepository.getInstance(database);
    
    // Initialize module manager with actual method parameters
    moduleManager = ModuleManagerService.getInstance(moduleConfig, logger, moduleRepository);
    moduleManager.initialize();
    
    // Create and initialize individual modules
    agentsModule = new AgentsModule();
    await agentsModule.initialize();
    await agentsModule.start();
    
    tasksModule = new TasksModule();
    await tasksModule.initialize();
    await tasksModule.start();

    console.log('✅ Module system integration test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up integration test environment (session: ${TEST_SESSION_ID})...`);
    
    // Stop individual modules
    if (agentsModule) {
      await agentsModule.stop();
    }
    if (tasksModule) {
      await tasksModule.stop();
    }

    // Clean up test directories
    if (existsSync(TEST_CONFIG.tempDir)) {
      rmSync(TEST_CONFIG.tempDir, { recursive: true, force: true });
    }
  });

  describe('ModuleManagerService Functionality', () => {
    it('should register core modules in database', async () => {
      await moduleManager.registerCoreModule('agents', '/src/modules/core/agents', ['database', 'logger']);
      await moduleManager.registerCoreModule('tasks', '/src/modules/core/tasks', ['database', 'logger']);
      
      const modules = await moduleManager.getAllModules();
      expect(modules.length).toBeGreaterThanOrEqual(2);
      
      const agentsModuleInfo = modules.find(m => m.name === 'agents');
      const tasksModuleInfo = modules.find(m => m.name === 'tasks');
      
      expect(agentsModuleInfo).toBeDefined();
      expect(tasksModuleInfo).toBeDefined();
    });

    it('should enable and disable modules', async () => {
      await moduleManager.enableModule('agents');
      await moduleManager.enableModule('tasks');
      
      const enabledModules = await moduleManager.getEnabledModules();
      expect(enabledModules.some(m => m.name === 'agents')).toBe(true);
      expect(enabledModules.some(m => m.name === 'tasks')).toBe(true);
      
      await moduleManager.disableModule('agents');
      
      const afterDisable = await moduleManager.getEnabledModules();
      expect(afterDisable.some(m => m.name === 'agents')).toBe(false);
    });

    it('should get specific module information', async () => {
      const tasksModule = await moduleManager.getModule('tasks');
      expect(tasksModule).toBeDefined();
      expect(tasksModule?.name).toBe('tasks');
      expect(tasksModule?.enabled).toBe(true);
    });

    it('should scan for injectable modules', async () => {
      // Create a mock injectable module directory
      const injectablePath = join(TEST_CONFIG.tempDir, 'modules', 'test-module');
      mkdirSync(injectablePath, { recursive: true });
      
      // Create a module.yaml file
      const fs = await import('fs');
      fs.writeFileSync(join(injectablePath, 'module.yaml'), `
name: test-module
version: 1.0.0
dependencies:
  - database
  - logger
config:
  enabled: true
metadata:
  description: Test injectable module
`);
      
      const scannedModules = await moduleManager.scanForModules();
      expect(scannedModules.length).toBeGreaterThanOrEqual(1);
      
      const testModule = scannedModules.find(m => m.name === 'test-module');
      expect(testModule).toBeDefined();
      expect(testModule?.version).toBe('1.0.0');
    });
  });

  describe('Individual Module Functionality', () => {
    it('should create agent using AgentsModule', async () => {
      const agentService = agentsModule.exports.service();
      
      createdAgent = await agentService.createAgent({
        name: 'test-agent',
        description: 'Test agent for module system testing',
        instructions: 'Process tasks and report results',
        type: 'worker',
        capabilities: ['data-processing']
      });

      expect(createdAgent).toBeDefined();
      expect(createdAgent.id).toBeDefined();
      expect(createdAgent.status).toBe('stopped');
      expect(createdAgent.name).toBe('test-agent');
    });

    it('should create task using TasksModule', async () => {
      const taskService = tasksModule.exports.service();
      
      createdTask = await taskService.addTask({
        type: 'data-processing',
        moduleId: 'test-module',
        instructions: { process: 'test-data' },
        priority: 5,
        status: TaskStatusEnum.PENDING
      });

      expect(createdTask).toBeDefined();
      expect(createdTask.id).toBeDefined();
      expect(createdTask.status).toBe(TaskStatusEnum.PENDING);
      expect(createdTask.assignedAgentId).toBeUndefined();
    });

    it('should start and stop agent through module', async () => {
      const agentService = agentsModule.exports.service();
      
      await agentService.startAgent(createdAgent.id);
      
      let agent = await agentService.getAgent(createdAgent.id);
      expect(agent?.status).toBe('active');
      
      await agentService.stopAgent(createdAgent.id);
      
      agent = await agentService.getAgent(createdAgent.id);
      expect(agent?.status).toBe('stopped');
    });

    it('should assign task to agent', async () => {
      const taskService = tasksModule.exports.service();
      const agentService = agentsModule.exports.service();
      
      // Start agent first
      await agentService.startAgent(createdAgent.id);
      
      await taskService.assignTaskToAgent(createdTask.id!, createdAgent.id);
      
      const task = await taskService.getTask(createdTask.id!);
      expect(task?.assignedAgentId).toBe(createdAgent.id);
      expect(task?.status).toBe(TaskStatusEnum.ASSIGNED);
    });

    it('should complete task and update status', async () => {
      const taskService = tasksModule.exports.service();
      
      await taskService.completeTask(createdTask.id!, 'Task completed successfully');
      
      const task = await taskService.getTask(createdTask.id!);
      expect(task?.status).toBe(TaskStatusEnum.COMPLETED);
      expect(task?.result).toContain('completed successfully');
      expect(task?.completedAt).toBeDefined();
    });

    it('should check module health status', async () => {
      const agentsHealth = await agentsModule.healthCheck();
      const tasksHealth = await tasksModule.healthCheck();
      
      expect(agentsHealth.healthy).toBe(true);
      expect(tasksHealth.healthy).toBe(true);
    });
  });
});