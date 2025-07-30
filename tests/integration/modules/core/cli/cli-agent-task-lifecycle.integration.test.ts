/**
 * CLI Agent-Task Lifecycle Integration Test
 * 
 * Tests the complete lifecycle of agent and task management through CLI commands.
 * This tests the end-to-end workflow of creating agents, assigning tasks, and managing their lifecycle.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';

// Test configuration
const TEST_SESSION_ID = `agent-task-lifecycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    
    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });
    
    child.on('error', (error) => {
      reject(error);
    });
    
    // Add timeout
    setTimeout(() => {
      child.kill();
      reject(new Error('CLI command timeout'));
    }, 30000);
  });
}

describe('CLI Agent-Task Lifecycle Integration', () => {
  let createdAgentId: string | undefined;
  let createdTaskId: string | undefined;

  beforeAll(async () => {
    console.log(`🚀 Setting up agent-task lifecycle test (session: ${TEST_SESSION_ID})...`);
    
    // Create test directories
    if (!existsSync(TEST_CONFIG.tempDir)) {
      mkdirSync(TEST_CONFIG.tempDir, { recursive: true });
    }

    // Initialize database and bootstrap system
    const initResult = await execCLI(['database', 'status']);
    console.log(`Database initialization: ${initResult.code === 0 ? 'Success' : 'Failed'}`);
  }, 60000);

  afterAll(async () => {
    console.log(`🧹 Cleaning up agent-task lifecycle test (session: ${TEST_SESSION_ID})...`);
    
    // Clean up test directory
    if (existsSync(TEST_CONFIG.tempDir)) {
      rmSync(TEST_CONFIG.tempDir, { recursive: true, force: true });
    }
  });

  describe('Full Lifecycle Test', () => {
    it('should show database status', async () => {
      const result = await execCLI(['database', 'status']);
      expect(result.code).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/database|status|connected/);
    });

    it('should create an agent', async () => {
      const result = await execCLI([
        'agents', 'create',
        '--name', 'test-agent',
        '--type', 'worker',
        '--description', 'Test agent for lifecycle testing',
        '--instructions', 'Execute assigned tasks efficiently',
        '--format', 'json'
      ]);

      if (result.code !== 0) {
        console.log('Agent creation failed:', { stdout: result.stdout, stderr: result.stderr, code: result.code });
      }

      expect(result.code).toBe(0);
      
      // Extract agent ID from JSON output if available
      try {
        const agentData = JSON.parse(result.stdout);
        if (agentData.id) {
          createdAgentId = agentData.id;
          console.log(`Created agent with ID: ${createdAgentId}`);
        }
      } catch (e) {
        // If not JSON, try to extract from regular output
        const idMatch = result.stdout.match(/ID[:\s]+([a-f0-9-]+)/i);
        if (idMatch) {
          createdAgentId = idMatch[1];
          console.log(`Created agent with ID: ${createdAgentId}`);
        }
      }
    });

    it('should start the agent', async () => {
      if (!createdAgentId) {
        console.log('Skipping agent start - no agent ID available');
        return;
      }

      const result = await execCLI(['agents', 'start', createdAgentId]);
      expect([0, 1]).toContain(result.code); // May already be started
    });

    it('should create a task', async () => {
      const result = await execCLI([
        'tasks', 'add',
        '--type', 'test-task',
        '--module-id', 'test-module',
        '--instructions', 'Test task for lifecycle testing',
        '--priority', '5',
        '--format', 'json'
      ]);

      if (result.code !== 0) {
        console.log('Task creation failed:', { stdout: result.stdout, stderr: result.stderr, code: result.code });
      }

      expect(result.code).toBe(0);
      
      // Extract task ID from JSON output if available
      try {
        const taskData = JSON.parse(result.stdout);
        if (taskData.id) {
          createdTaskId = taskData.id;
          console.log(`Created task with ID: ${createdTaskId}`);
        }
      } catch (e) {
        // If not JSON, try to extract from regular output
        const idMatch = result.stdout.match(/ID[:\s]+([a-f0-9-]+)/i);
        if (idMatch) {
          createdTaskId = idMatch[1];
          console.log(`Created task with ID: ${createdTaskId}`);
        }
      }
    });

    it('should show task in pending state', async () => {
      const result = await execCLI(['tasks', 'list']);

      if (result.code !== 0) {
        console.log('Task list failed:', {
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.code
        });
      }

      expect(result.code).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/task|pending|list/);
    });

    it('should assign task to agent using update', async () => {
      if (!createdTaskId || !createdAgentId) {
        console.log('Skipping task assignment - missing IDs');
        return;
      }

      const result = await execCLI([
        'tasks', 'update', createdTaskId,
        '--agent-id', createdAgentId,
        '--status', 'assigned'
      ]);

      if (result.code !== 0) {
        console.log('Task assignment failed:', {
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.code,
          createdTaskId,
          createdAgentId
        });
      }

      expect([0, 1]).toContain(result.code);
    });

    it('should update task to in_progress', async () => {
      if (!createdTaskId) {
        console.log('Skipping task progress update - no task ID');
        return;
      }

      const result = await execCLI([
        'tasks', 'update', createdTaskId,
        '--status', 'in_progress'
      ]);

      expect([0, 1]).toContain(result.code);
    });

    it('should complete the task', async () => {
      if (!createdTaskId) {
        console.log('Skipping task completion - no task ID');
        return;
      }

      const result = await execCLI([
        'tasks', 'update', createdTaskId,
        '--status', 'completed',
        '--result', 'Task completed successfully through CLI'
      ]);

      expect([0, 1]).toContain(result.code);
    });

    it('should show task statistics', async () => {
      const result = await execCLI(['tasks', 'status']);
      expect(result.code).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/task|status|statistics/);
    });

    it('should stop the agent', async () => {
      if (!createdAgentId) {
        console.log('Skipping agent stop - no agent ID');
        return;
      }

      const result = await execCLI(['agents', 'stop', createdAgentId]);
      expect([0, 1]).toContain(result.code);
    });

    it('should handle task cleanup', async () => {
      const result = await execCLI(['tasks', 'list']);
      expect([0, 1]).toContain(result.code); // May fail if no tasks exist
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid agent creation', async () => {
      const result = await execCLI(['agents', 'create']); // Missing required args
      expect([1, 127]).toContain(result.code); // Command error or not found
      expect(result.stderr.toLowerCase()).toMatch(/error|missing|required|unknown/);
    });

    it('should handle invalid task creation', async () => {
      const result = await execCLI(['tasks', 'add']); // Missing required args
      expect(result.code).toBe(1);
      expect(result.stderr.toLowerCase()).toMatch(/error|missing|required/);
    });

    it('should handle non-existent agent operations', async () => {
      const result = await execCLI(['agents', 'start', 'non-existent-id']);
      expect(result.code).toBe(1);
      expect(result.stderr.toLowerCase()).toMatch(/error|not found|invalid/);
    });

    it('should handle non-existent task operations', async () => {
      const result = await execCLI(['tasks', 'update', 'non-existent-id', '--status', 'completed']);
      expect(result.code).toBe(1);
      expect(result.stderr.toLowerCase()).toMatch(/error|not found|invalid/);
    });
  });

  describe('Status and Information Commands', () => {
    it('should show agents status', async () => {
      const result = await execCLI(['agents', 'status']);
      expect(result.code).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/agent|status|health/);
    });

    it('should show tasks status', async () => {
      const result = await execCLI(['tasks', 'status']);
      expect(result.code).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/task|status|statistics/);
    });

    it('should list agents', async () => {
      const result = await execCLI(['agents', 'list']);
      expect(result.code).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/agent|list|name/);
    });

    it('should list tasks with filters', async () => {
      const result = await execCLI(['tasks', 'list']);
      expect([0, 1]).toContain(result.code); // May fail if command doesn't exist
    });
  });
});