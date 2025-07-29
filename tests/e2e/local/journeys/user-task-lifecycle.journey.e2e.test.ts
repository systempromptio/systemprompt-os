/**
 * User Journey: Task Lifecycle Management
 * 
 * Tests the complete user journey for managing tasks:
 * - Creating tasks with different types and configurations
 * - Monitoring task progress and status
 * - Updating task parameters and results
 * - Task completion and result handling
 * - Task history and analytics
 * 
 * This test simulates real user workflows for task management
 * from creation to completion.
 */

import { describe, it, expect } from 'vitest';
import { execLocalCLI, expectCLISuccess, expectCLIFailure } from '../shared/bootstrap.js';

describe('User Journey: Task Lifecycle Management', () => {
  let createdTaskId: number;

  describe('Task Creation Journey', () => {
    it('should walk through creating different types of tasks', async () => {
      // Step 1: User creates a unit test writing task
      const { stdout, stderr } = await execLocalCLI([
        'tasks', 'add',
        '--type=write-unit-test',
        '--module-id=auth',
        '--instructions={"target": "auth.service.ts", "coverage": "85%", "framework": "vitest"}',
        '--priority=8',
        '--status=pending',
        '--max-executions=3',
        '--format=json'
      ]);
      
      expect(stderr).toBe('');
      const task = JSON.parse(stdout);
      
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.type).toBe('write-unit-test');
      expect(task.moduleId).toBe('auth');
      expect(task.instructions).toEqual({
        target: 'auth.service.ts',
        coverage: '85%',
        framework: 'vitest'
      });
      expect(task.priority).toBe(8);
      expect(task.status).toBe('pending');
      
      createdTaskId = task.id;
    });

    it('should create a data processing task with complex instructions', async () => {
      // Step 2: User creates a more complex data processing task
      const { stdout, stderr } = await execLocalCLI([
        'tasks', 'add',
        '--type=data-processing',
        '--module-id=analytics',
        '--instructions={"source": "user_events", "aggregation": "daily", "metrics": ["count", "unique_users"], "output_format": "json"}',
        '--priority=5',
        '--status=stopped',
        '--format=json'
      ]);
      
      expect(stderr).toBe('');
      const task = JSON.parse(stdout);
      
      expect(task.type).toBe('data-processing');
      expect(task.moduleId).toBe('analytics');
      expect(task.instructions.source).toBe('user_events');
      expect(task.instructions.metrics).toEqual(['count', 'unique_users']);
    });
  });

  describe('Task Monitoring Journey', () => {
    it('should walk through monitoring task progress', async () => {
      // Step 1: User checks all their tasks
      const { stdout, stderr } = await execLocalCLI(['tasks', 'list', '--format=json']);
      
      expect(stderr).toBe('');
      const tasks = JSON.parse(stdout);
      
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      
      // Step 2: User finds their specific task
      const unitTestTask = tasks.find((t: any) => t.id === createdTaskId);
      expect(unitTestTask).toBeDefined();
      expect(unitTestTask.status).toBe('pending');

      // Step 3: User checks task details in table format
      const { stdout: tableResult } = await execLocalCLI(['tasks', 'list']);
      expect(tableResult).toContain('write-unit-test');
      expect(tableResult).toContain('pending');
    });

    it('should filter tasks by status and type', async () => {
      // User wants to see only pending tasks
      const { stdout } = await execLocalCLI(['tasks', 'list', '--format=json']);
      const allTasks = JSON.parse(stdout);
      
      const pendingTasks = allTasks.filter((t: any) => t.status === 'pending');
      expect(pendingTasks.length).toBeGreaterThan(0);
      
      // User looks for specific task types
      const unitTestTasks = allTasks.filter((t: any) => t.type === 'write-unit-test');
      expect(unitTestTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Task Execution Journey', () => {
    it('should walk through task status transitions', async () => {
      // Step 1: User starts the task (pending -> running)
      const { stdout, stderr } = await execLocalCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--status=running',
        '--format=json'
      ]);
      
      expect(stderr).toBe('');
      const runningTask = JSON.parse(stdout);
      
      expect(runningTask.id).toBe(createdTaskId);
      expect(runningTask.status).toBe('running');

      // Step 2: User updates task progress
      const { stdout: progressResult } = await execLocalCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--status=running',
        '--progress=50',
        '--format=json'
      ]);
      
      const progressTask = JSON.parse(progressResult);
      expect(progressTask.progress).toBe(50);
    });

    it('should handle task completion with results', async () => {
      // User completes the task with results
      const completionResult = 'Unit tests created successfully. Coverage: 87% (2% above target). Total tests: 15. All tests passing.';
      
      const { stdout, stderr } = await execLocalCLI([
        'tasks', 'update',
        `--id=${createdTaskId}`,
        '--status=completed',
        `--result=${completionResult}`,
        '--format=json'
      ]);
      
      expect(stderr).toBe('');
      const completedTask = JSON.parse(stdout);
      
      expect(completedTask.id).toBe(createdTaskId);
      expect(completedTask.status).toBe('completed');
      expect(completedTask.result).toBe(completionResult);
      expect(completedTask.completedAt).toBeDefined();
    });
  });

  describe('Task Analysis Journey', () => {
    it('should help user analyze task performance', async () => {
      // Step 1: User reviews completed tasks
      const { stdout } = await execLocalCLI(['tasks', 'list', '--format=json']);
      const allTasks = JSON.parse(stdout);
      
      const completedTasks = allTasks.filter((t: any) => t.status === 'completed');
      expect(completedTasks.length).toBeGreaterThan(0);
      
      // Step 2: User examines task results
      const unitTestTask = completedTasks.find((t: any) => t.type === 'write-unit-test');
      expect(unitTestTask).toBeDefined();
      expect(unitTestTask.result).toContain('Coverage: 87%');
      expect(unitTestTask.result).toContain('All tests passing');

      // Step 3: User checks task execution time
      if (unitTestTask.completedAt && unitTestTask.createdAt) {
        const executionTime = new Date(unitTestTask.completedAt).getTime() - new Date(unitTestTask.createdAt).getTime();
        expect(executionTime).toBeGreaterThan(0);
      }
    });
  });

  describe('Task Error Handling Journey', () => {
    it('should handle task failures gracefully', async () => {
      // Step 1: Create a task that will fail
      const { stdout } = await execLocalCLI([
        'tasks', 'add',
        '--type=failing-task',
        '--module-id=test',
        '--instructions={"shouldFail": true}',
        '--priority=1',
        '--format=json'
      ]);
      
      const failingTask = JSON.parse(stdout);
      
      // Step 2: Simulate task failure
      const errorMessage = 'Task failed due to missing dependencies: module "nonexistent" not found';
      
      const { stdout: failureResult } = await execLocalCLI([
        'tasks', 'update',
        `--id=${failingTask.id}`,
        '--status=failed',
        `--error=${errorMessage}`,
        '--format=json'
      ]);
      
      const failedTask = JSON.parse(failureResult);
      expect(failedTask.status).toBe('failed');
      expect(failedTask.error).toBe(errorMessage);
    });

    it('should handle task retry scenarios', async () => {
      // User retries a failed task
      const { stdout } = await execLocalCLI([
        'tasks', 'add',
        '--type=retry-task',
        '--module-id=test',
        '--instructions={"retryable": true}',
        '--max-executions=3',
        '--format=json'
      ]);
      
      const retryTask = JSON.parse(stdout);
      
      // First attempt fails
      await execLocalCLI([
        'tasks', 'update',
        `--id=${retryTask.id}`,
        '--status=failed',
        '--error=Temporary network error',
        '--format=json'
      ]);
      
      // User retries the task
      const { stdout: retryResult } = await execLocalCLI([
        'tasks', 'update',
        `--id=${retryTask.id}`,
        '--status=pending',
        '--format=json'
      ]);
      
      const retriedTask = JSON.parse(retryResult);
      expect(retriedTask.status).toBe('pending');
      expect(retriedTask.maxExecutions).toBe(3);
    });
  });

  describe('Task Bulk Operations Journey', () => {
    it('should handle multiple task operations', async () => {
      // User creates multiple related tasks
      const taskTypes = ['validation', 'processing', 'reporting'];
      const createdTasks = [];
      
      for (const type of taskTypes) {
        const { stdout } = await execLocalCLI([
          'tasks', 'add',
          `--type=${type}`,
          '--module-id=bulk-test',
          `--instructions={"step": "${type}"}`,
          '--priority=3',
          '--format=json'
        ]);
        
        const task = JSON.parse(stdout);
        createdTasks.push(task);
        expect(task.type).toBe(type);
      }
      
      expect(createdTasks.length).toBe(3);
      
      // User checks all created tasks
      const { stdout: allTasksResult } = await execLocalCLI(['tasks', 'list', '--format=json']);
      const allTasks = JSON.parse(allTasksResult);
      
      const bulkTasks = allTasks.filter((t: any) => t.moduleId === 'bulk-test');
      expect(bulkTasks.length).toBe(3);
    });
  });
});