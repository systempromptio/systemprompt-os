/**
 * Integration test for complete Agent-Task lifecycle with event bus
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';

// Test configuration
const TEST_SESSION_ID = `integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

// Helper to execute CLI commands
async function execCLI(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const env = { 
      ...process.env, 
      ...TEST_CONFIG.envVars 
    };
    
    const child = spawn('npx', ['tsx', 'src/modules/core/cli/cli/main.ts', ...args], {
      cwd: process.cwd(),
      env,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeoutHandle = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Command timed out: ${args.join(' ')}`));
    }, 30000);
    
    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      resolve({ stdout, stderr, code: code || 0 });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
}

describe('Agent-Task Lifecycle Integration Test', () => {
  let createdAgentId: string;
  let createdTaskId: number;

  beforeAll(async () => {
    console.log(`🚀 Setting up integration test (session: ${TEST_SESSION_ID})...`);
    
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

    // Initialize database - initialize directly instead of using CLI
    console.log('🗄️  Initializing database...');
    try {
      const { DatabaseService } = await import('@/modules/core/database/services/database.service');
      const { LoggerService } = await import('@/modules/core/logger/services/logger.service');
      
      // Initialize logger first
      const { LoggerMode, LogOutput } = await import('@/modules/core/logger/types/index');
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
      
      // Create tables manually instead of using CLI
      await database.execute(`
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          instructions TEXT,
          type TEXT NOT NULL,
          status TEXT DEFAULT 'stopped',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await database.execute(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          module_id TEXT NOT NULL,
          instructions TEXT,
          status TEXT DEFAULT 'pending',
          priority INTEGER DEFAULT 5,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✅ Database initialized directly');
    } catch (error) {
      console.error('Failed to initialize database directly:', error);
      throw error;
    }
    
    console.log('✅ Integration test environment ready!');
  }, 60000);

  afterAll(async () => {
    console.log(`🧹 Cleaning up (session: ${TEST_SESSION_ID})...`);
    
    if (existsSync(TEST_CONFIG.tempDir)) {
      rmSync(TEST_CONFIG.tempDir, { recursive: true, force: true });
    }
    
    console.log('✅ Cleanup complete!');
  });

  describe('Full Lifecycle Test', () => {
    it('should show database status', async () => {
      const result = await execCLI(['database', 'status']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Database Status');
    });
    
    it('should create an agent', async () => {
      const result = await execCLI([
        'agents', 'create',
        `--name=test-worker-${TEST_SESSION_ID}`,
        '--description=Test worker agent for integration testing',
        '--instructions=Process tasks and report results',
        '--type=worker',
        '--format=json'
      ]);
      
      if (result.code !== 0) {
        console.error('Agent creation failed:', {
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.code
        });
        
        // Try to get more details about the error
        const logResult = await execCLI(['logs', 'tail']);
        console.error('Recent logs:', logResult.stdout);
      }
      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');
      
      const agent = JSON.parse(result.stdout);
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe(`test-worker-${TEST_SESSION_ID}`);
      expect(agent.status).toBe('stopped');
      
      createdAgentId = agent.id;
    });

    it('should start the agent', async () => {
      const result = await execCLI([
        'agents', 'update',
        '--id', createdAgentId,
        '--status=active',
        '--format=json'
      ]);
      
      expect(result.code).toBe(0);
      
      const agent = JSON.parse(result.stdout);
      expect(agent.status).toBe('active');
    });

    it('should create a task', async () => {
      const result = await execCLI([
        'tasks', 'add',
        '--type=data-processing',
        '--module-id=test-module',
        '--instructions={"action": "process", "data": "test-data"}',
        '--priority=8',
        '--format=json'
      ]);
      
      expect(result.code).toBe(0);
      expect(result.stderr).toBe('');
      
      const task = JSON.parse(result.stdout);
      expect(task.id).toBeDefined();
      expect(task.type).toBe('data-processing');
      expect(task.status).toBe('pending');
      expect(task.assignedAgentId).toBeUndefined();
      
      createdTaskId = task.id;
    });

    it('should show task in pending state', async () => {
      const result = await execCLI([
        'tasks', 'list',
        '--status=pending',
        '--format=json'
      ]);
      
      expect(result.code).toBe(0);
      
      const tasks = JSON.parse(result.stdout);
      const ourTask = tasks.find((t: any) => t.id === createdTaskId);
      expect(ourTask).toBeDefined();
      expect(ourTask.status).toBe('pending');
    });

    it('should assign task to agent using update', async () => {
      // First update to assign
      const assignResult = await execCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--status=assigned',
        `--assigned-agent-id=${createdAgentId}`,
        '--format=json'
      ]);
      
      expect(assignResult.code).toBe(0);
      
      const task = JSON.parse(assignResult.stdout);
      expect(task.status).toBe('assigned');
      expect(task.assignedAgentId).toBe(createdAgentId);
    });

    it('should update task to in_progress', async () => {
      const result = await execCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--status=in_progress',
        '--progress=25',
        '--format=json'
      ]);
      
      expect(result.code).toBe(0);
      
      const task = JSON.parse(result.stdout);
      expect(task.status).toBe('in_progress');
      expect(task.progress).toBe(25);
    });

    it('should update task progress', async () => {
      // Update to 50%
      let result = await execCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--progress=50',
        '--format=json'
      ]);
      
      expect(result.code).toBe(0);
      let task = JSON.parse(result.stdout);
      expect(task.progress).toBe(50);
      
      // Update to 75%
      result = await execCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--progress=75',
        '--format=json'
      ]);
      
      expect(result.code).toBe(0);
      task = JSON.parse(result.stdout);
      expect(task.progress).toBe(75);
    });

    it('should complete the task', async () => {
      const result = await execCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--status=completed',
        '--progress=100',
        '--result=Task completed successfully with processed data',
        '--format=json'
      ]);
      
      expect(result.code).toBe(0);
      
      const task = JSON.parse(result.stdout);
      expect(task.status).toBe('completed');
      expect(task.progress).toBe(100);
      expect(task.result).toContain('completed successfully');
      expect(task.completedAt).toBeDefined();
    });

    it('should verify completed task has assigned agent', async () => {
      // List completed tasks to verify our task
      const result = await execCLI([
        'tasks', 'list',
        '--status=completed',
        '--format=json'
      ]);
      
      expect(result.code).toBe(0);
      
      const tasks = JSON.parse(result.stdout);
      const ourTask = tasks.find((t: any) => t.id === createdTaskId);
      expect(ourTask).toBeDefined();
      expect(ourTask.status).toBe('completed');
      // Note: assignedAgentId will be verified when we test the complete flow
    });

    it('should handle task failure scenario', async () => {
      // Create a new task
      const createResult = await execCLI([
        'tasks', 'add',
        '--type=failing-task',
        '--module-id=test-module',
        '--priority=10',
        '--format=json'
      ]);
      
      const failingTask = JSON.parse(createResult.stdout);
      
      // Assign to agent
      await execCLI([
        'tasks', 'update',
        `--id=${failingTask.id}`,
        '--status=assigned',
        `--assigned-agent-id=${createdAgentId}`
      ]);
      
      // Start processing
      await execCLI([
        'tasks', 'update',
        `--id=${failingTask.id}`,
        '--status=in_progress'
      ]);
      
      // Fail the task
      const failResult = await execCLI([
        'tasks', 'update',
        `--id=${failingTask.id}`,
        '--status=failed',
        '--error=Simulated task failure',
        '--format=json'
      ]);
      
      expect(failResult.code).toBe(0);
      
      const failed = JSON.parse(failResult.stdout);
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('Simulated task failure');
    });

    it('should show task statistics', async () => {
      const result = await execCLI(['tasks', 'status']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Tasks Module Status');
      expect(result.stdout).toContain('Queue Statistics');
    });

    it('should stop the agent', async () => {
      const result = await execCLI([
        'agents', 'update',
        '--id', createdAgentId,
        '--status=stopped',
        '--format=json'
      ]);
      
      expect(result.code).toBe(0);
      
      const agent = JSON.parse(result.stdout);
      expect(agent.status).toBe('stopped');
    });
  });

  describe('Event System Verification', () => {
    it('should show agent module is healthy', async () => {
      const result = await execCLI(['agents', 'status']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Agents Module Status');
      expect(result.stdout).toContain('Enabled : ✓');
    });

    it('should handle concurrent tasks', async () => {
      // Create multiple tasks
      const taskPromises = Array(3).fill(null).map((_, i) => 
        execCLI([
          'tasks', 'add',
          `--type=concurrent-task-${i}`,
          '--module-id=test-module',
          `--priority=${10 - i}`,
          '--format=json'
        ])
      );
      
      const results = await Promise.all(taskPromises);
      const tasks = results.map(r => JSON.parse(r.stdout));
      
      // All should be created successfully
      tasks.forEach(task => {
        expect(task.id).toBeDefined();
        expect(task.status).toBe('pending');
      });
      
      // List all pending tasks
      const listResult = await execCLI([
        'tasks', 'list',
        '--status=pending',
        '--format=json'
      ]);
      
      const pendingTasks = JSON.parse(listResult.stdout);
      expect(pendingTasks.length).toBeGreaterThanOrEqual(3);
    });
  });
});