import { describe, it, expect } from 'vitest';
import { execLocalCLI, expectCLISuccess, expectCLIFailure } from '../../shared/bootstrap.js';

/**
 * Local E2E: Tasks Module Functionality
 * 
 * Tests the functionality of the tasks module including:
 * - Creating tasks with custom parameters
 * - Listing and filtering tasks
 * - Updating task status and other fields
 * - Task persistence across operations
 * - Error handling and validation
 */
describe('Local E2E: Tasks Module Functionality', () => {
  describe('Database Setup', () => {
    it('should rebuild the database with task schema', async () => {
      const { stdout, stderr } = await execLocalCLI(['database', 'rebuild', '--force']);
      // Stderr may contain warnings about dropping non-existent tables, which is normal
      expect(stderr).toMatch(/^$|warning|failed to drop/i);
      // Database rebuild doesn't output anything on success
    });
  });

  describe('Task Creation and Management', () => {
    let createdTaskId: number;

    it('should create a task to write a unit test', async () => {
      const { stdout, stderr } = await execLocalCLI([
        'tasks', 'add',
        '--type=write-unit-test',
        '--module-id=cli',
        '--instructions={"target": "auth.service.ts", "coverage": "80%"}',
        '--priority=5',
        '--status=stopped',
        '--max-executions=5',
        '--format=json'
      ]);
      
      expect(stderr).toBe('');
      const task = JSON.parse(stdout);
      
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.type).toBe('write-unit-test');
      expect(task.moduleId).toBe('cli');
      expect(task.instructions).toEqual({ target: 'auth.service.ts', coverage: '80%' });
      expect(task.priority).toBe(5); // CLI returns number values
      expect(task.status).toBe('stopped');
      expect(task.maxExecutions).toBe(5); // CLI returns number values
      
      createdTaskId = task.id;
    });

    it('should list tasks including the created task', async () => {
      const { stdout, stderr } = await execLocalCLI(['tasks', 'list', '--format=json']);
      
      expect(stderr).toBe('');
      const tasks = JSON.parse(stdout);
      
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      
      const createdTask = tasks.find((t: any) => t.id == createdTaskId); // Use == for loose comparison
      expect(createdTask).toBeDefined();
      expect(createdTask.type).toBe('write-unit-test');
      expect(createdTask.status).toBe('stopped');
    });

    it('should update task status to pending', async () => {
      const { stdout, stderr } = await execLocalCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--status=pending',
        '--format=json'
      ]);
      
      expect(stderr).toBe('');
      const task = JSON.parse(stdout);
      
      expect(task).toBeDefined();
      expect(task.id).toBe(createdTaskId);
      expect(task.status).toBe('pending');
    });

    it('should update task with result and completion status', async () => {
      const { stdout, stderr } = await execLocalCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--status=completed',
        '--result=Unit test created successfully with 85% coverage',
        '--format=json'
      ]);
      
      expect(stderr).toBe('');
      const task = JSON.parse(stdout);
      
      expect(task).toBeDefined();
      expect(task.id).toBe(createdTaskId);
      expect(task.status).toBe('completed');
      expect(task.result).toBe('Unit test created successfully with 85% coverage');
    });

    it('should verify task updates are persisted', async () => {
      const { stdout, stderr } = await execLocalCLI([
        'tasks', 'list',
        '--status=completed',
        '--format=json'
      ]);
      
      expect(stderr).toBe('');
      const tasks = JSON.parse(stdout);
      
      const completedTask = tasks.find((t: any) => t.id == createdTaskId); // Use == for loose comparison
      expect(completedTask).toBeDefined();
      expect(completedTask.status).toBe('completed');
      expect(completedTask.result).toBe('Unit test created successfully with 85% coverage');
    });

    it('should show task module status', async () => {
      const { stdout, stderr } = await execLocalCLI(['tasks', 'status']);
      
      expect(stderr).toBe('');
      expect(stdout).toContain('Tasks Module Status');
      expect(stdout).toContain('Enabled: ✓');
      expect(stdout).toContain('Healthy: ✓');
      expect(stdout).toContain('Queue Statistics');
    });
  });

  describe('Advanced Task Operations', () => {
    it('should update task with max_time constraint', async () => {
      const { stdout: createOut } = await execLocalCLI([
        'tasks', 'add',
        '--type=long-running',
        '--module-id=processor',
        '--format=json'
      ]);
      const task = JSON.parse(createOut);
      
      const { stdout: updateOut } = await execLocalCLI([
        'tasks', 'update',
        `--id=${task.id}`,
        '--max-time=300',
        '--format=json'
      ]);
      const updated = JSON.parse(updateOut);
      
      expect(updated.maxTime).toBe(300);
    });

    it('should cancel a task', async () => {
      const { stdout: createOut } = await execLocalCLI([
        'tasks', 'add',
        '--type=cancellable',
        '--module-id=test',
        '--format=json'
      ]);
      const task = JSON.parse(createOut);
      
      const { stdout, stderr } = await execLocalCLI([
        'tasks', 'cancel',
        `--id=${task.id}`
      ]);
      
      expect(stderr).toBe('');
      expect(stdout).toContain('cancelled');
      
      // Verify cancellation
      const { stdout: listOut } = await execLocalCLI(['tasks', 'list', '--status=cancelled', '--format=json']);
      const tasks = JSON.parse(listOut);
      const cancelled = tasks.find((t: any) => t.id == task.id); // Use == for loose comparison
      expect(cancelled).toBeDefined();
      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid task ID for update', async () => {
      try {
        await execLocalCLI([
          'tasks', 'update',
          '--id=999999',
          '--status=completed'
        ]);
        expect.fail('Expected command to fail');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('not found');
      }
    });

    it('should handle invalid JSON instructions', async () => {
      try {
        await execLocalCLI([
          'tasks', 'add',
          '--type=test',
          '--module-id=test',
          '--instructions=not valid json'
        ]);
        expect.fail('Expected command to fail');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('must be valid JSON');
      }
    });

    it('should require both type and module-id for task creation', async () => {
      try {
        await execLocalCLI(['tasks', 'add', '--type=test']);
        expect.fail('Expected command to fail');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('--module-id');
        expect(error.stderr || error.stdout).toContain('not specified');
      }
    });
  });

  describe('Task Filtering and Listing', () => {
    it('should filter tasks by status', async () => {
      // Create tasks with different statuses
      await execLocalCLI([
        'tasks', 'add',
        '--type=filter-test-1',
        '--module-id=test',
        '--status=pending'
      ]);
      await execLocalCLI([
        'tasks', 'add',
        '--type=filter-test-2',
        '--module-id=test',
        '--status=completed'
      ]);
      
      const { stdout } = await execLocalCLI([
        'tasks', 'list',
        '--status=pending',
        '--format=json'
      ]);
      const tasks = JSON.parse(stdout);
      
      expect(tasks.every((t: any) => t.status === 'pending')).toBe(true);
    });

    it('should limit number of tasks returned', async () => {
      const { stdout } = await execLocalCLI([
        'tasks', 'list',
        '--limit=2',
        '--format=json'
      ]);
      const tasks = JSON.parse(stdout);
      
      expect(tasks.length).toBeLessThanOrEqual(2);
    });
  });
});