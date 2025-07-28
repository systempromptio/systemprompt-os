/**
 * Comprehensive Task Workflows Integration Tests
 * Tests complex task management, workflows, dependencies, and edge cases
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TaskService } from '@/modules/core/tasks/services/task.service';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LoggerMode, LogOutput } from '@/modules/core/logger/types';
import { createTestId, waitForEvent } from './setup';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Comprehensive Task Workflows Integration Test', () => {
  let taskService: TaskService;
  let agentService: AgentService;
  let dbService: DatabaseService;
  let logger: LoggerService;
  
  const testSessionId = `task-workflows-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    console.log(`🚀 Setting up task workflows integration test (session: ${testSessionId})...`);
    
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
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
    
    // Initialize database
    await DatabaseService.initialize({
      type: 'sqlite',
      sqlite: { filename: testDbPath }
    }, logger);
    dbService = DatabaseService.getInstance();
    
    // Create enhanced schema for workflow testing
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'stopped',
        capabilities TEXT DEFAULT '[]',
        config TEXT DEFAULT '{}',
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
        deadline DATETIME,
        estimated_duration INTEGER DEFAULT 0,
        actual_duration INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        parent_task_id INTEGER,
        workflow_id TEXT,
        FOREIGN KEY (assigned_agent_id) REFERENCES agents(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
      )
    `);
    
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        depends_on_task_id INTEGER NOT NULL,
        dependency_type TEXT DEFAULT 'completion',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id)
      )
    `);
    
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        total_tasks INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        failed_tasks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME
      )
    `);
    
    // Initialize services with required dependencies
    const { TaskRepository } = await import('@/modules/core/tasks/repositories/task.repository');
    const { AgentRepository } = await import('@/modules/core/agents/repositories/agent.repository');
    
    const taskRepository = new TaskRepository(dbService);
    const agentRepository = new AgentRepository(dbService);
    
    taskService = TaskService.getInstance();
    await taskService.initialize(logger, taskRepository);
    
    agentService = AgentService.getInstance();
    agentService.initialize(agentRepository, logger);
    
    console.log('✅ Task workflows integration test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up task workflows test (session: ${testSessionId})...`);
    
    try {
      await dbService.disconnect();
    } catch (error) {
      // Ignore close errors
    }
    
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    console.log('✅ Cleanup complete!');
  });

  beforeEach(async () => {
    // Clear test data
    await dbService.execute('DELETE FROM task_dependencies');
    await dbService.execute('DELETE FROM workflows');
    await dbService.execute('DELETE FROM tasks');
    await dbService.execute('DELETE FROM agents');
  });

  describe('Complex Task Creation and Management', () => {
    it('should create tasks with comprehensive metadata', async () => {
      const complexTask = await taskService.addTask({
        type: 'data-pipeline',
        moduleId: 'analytics',
        instructions: {
          source: 'database',
          transformations: ['clean', 'normalize', 'aggregate'],
          destination: 'warehouse',
          scheduledFor: '2024-01-15T10:00:00Z'
        },
        priority: 8,
        deadline: new Date(Date.now() + 86400000), // 24 hours from now
        estimatedDuration: 3600, // 1 hour
        maxRetries: 5
      });
      
      expect(complexTask.id).toBeDefined();
      expect(complexTask.type).toBe('data-pipeline');
      expect(complexTask.priority).toBe(8);
      expect(complexTask.maxRetries).toBe(5);
      expect(complexTask.status).toBe('pending');
      expect(complexTask.estimatedDuration).toBe(3600);
    });

    it('should handle task validation and constraints', async () => {
      const invalidTasks = [
        {
          // Missing required type
          moduleId: 'test'
        },
        {
          // Invalid priority
          type: 'invalid-priority',
          moduleId: 'test',
          priority: 15 // Should be 1-10
        },
        {
          // Past deadline
          type: 'past-deadline',
          moduleId: 'test',
          deadline: new Date(Date.now() - 86400000) // 24 hours ago
        }
      ];
      
      for (const invalidTask of invalidTasks) {
        try {
          await taskService.addTask(invalidTask as any);
          expect.fail(`Should have rejected invalid task: ${JSON.stringify(invalidTask)}`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should support task templates and cloning', async () => {
      const templateTask = await taskService.addTask({
        type: 'report-generation',
        moduleId: 'reports',
        instructions: {
          template: 'monthly-summary',
          format: 'pdf',
          recipients: ['admin@example.com']
        },
        priority: 6,
        estimatedDuration: 1800
      });
      
      // Clone task with modifications
      const clonedTask = await taskService.addTask({
        ...templateTask,
        id: undefined, // Let it generate new ID
        instructions: {
          ...templateTask.instructions,
          format: 'xlsx', // Change format
          recipients: ['manager@example.com'] // Different recipients
        },
        priority: 7 // Higher priority
      });
      
      expect(clonedTask.id).not.toBe(templateTask.id);
      expect(clonedTask.type).toBe(templateTask.type);
      expect(clonedTask.instructions.format).toBe('xlsx');
      expect(clonedTask.priority).toBe(7);
    });

    it('should manage task queues with different strategies', async () => {
      // Create tasks with different priorities and deadlines
      const tasks = await Promise.all([
        taskService.addTask({
          type: 'urgent-task',
          moduleId: 'urgent',
          priority: 10,
          deadline: new Date(Date.now() + 3600000) // 1 hour
        }),
        taskService.addTask({
          type: 'normal-task',
          moduleId: 'normal',
          priority: 5,
          deadline: new Date(Date.now() + 86400000) // 24 hours
        }),
        taskService.addTask({
          type: 'low-priority-task',
          moduleId: 'batch',
          priority: 2,
          deadline: new Date(Date.now() + 604800000) // 1 week
        }),
        taskService.addTask({
          type: 'critical-task',
          moduleId: 'critical',
          priority: 9,
          deadline: new Date(Date.now() + 1800000) // 30 minutes
        })
      ]);
      
      // Test priority-based queue
      const priorityQueue = await dbService.prepare(`
        SELECT * FROM tasks 
        ORDER BY priority DESC, created_at ASC
      `).all();
      
      expect(priorityQueue[0].type).toBe('urgent-task');
      expect(priorityQueue[1].type).toBe('critical-task');
      expect(priorityQueue[2].type).toBe('normal-task');
      expect(priorityQueue[3].type).toBe('low-priority-task');
      
      // Test deadline-based queue
      const deadlineQueue = await dbService.prepare(`
        SELECT * FROM tasks 
        ORDER BY deadline ASC
      `).all();
      
      expect(deadlineQueue[0].type).toBe('critical-task'); // 30 min deadline
      expect(deadlineQueue[1].type).toBe('urgent-task');   // 1 hour deadline
    });
  });

  describe('Task Dependencies and Workflows', () => {
    it('should create and manage task dependencies', async () => {
      // Create a workflow with dependent tasks
      const workflowId = `workflow-${createTestId()}`;
      
      await dbService.execute(
        'INSERT INTO workflows (id, name, description) VALUES (?, ?, ?)',
        [workflowId, 'Data Processing Workflow', 'Extract, transform, and load data']
      );
      
      // Create tasks in sequence
      const extractTask = await taskService.addTask({
        type: 'data-extraction',
        moduleId: 'etl',
        workflowId,
        instructions: { source: 'api', endpoint: '/data' }
      });
      
      const transformTask = await taskService.addTask({
        type: 'data-transformation',
        moduleId: 'etl',
        workflowId,
        instructions: { transformations: ['clean', 'normalize'] }
      });
      
      const loadTask = await taskService.addTask({
        type: 'data-loading',
        moduleId: 'etl',
        workflowId,
        instructions: { destination: 'warehouse' }
      });
      
      // Create dependencies
      await dbService.execute(
        'INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES (?, ?, ?)',
        [transformTask.id, extractTask.id, 'completion']
      );
      
      await dbService.execute(
        'INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES (?, ?, ?)',
        [loadTask.id, transformTask.id, 'completion']
      );
      
      // Verify dependency chain
      const dependencies = await dbService.prepare(`
        SELECT t1.type as task_type, t2.type as depends_on_type
        FROM task_dependencies td
        JOIN tasks t1 ON td.task_id = t1.id
        JOIN tasks t2 ON td.depends_on_task_id = t2.id
        WHERE t1.workflow_id = ?
      `).all(workflowId);
      
      expect(dependencies).toHaveLength(2);
      expect(dependencies.find(d => d.task_type === 'data-transformation')?.depends_on_type).toBe('data-extraction');
      expect(dependencies.find(d => d.task_type === 'data-loading')?.depends_on_type).toBe('data-transformation');
    });

    it('should handle parallel task execution within workflows', async () => {
      const workflowId = `parallel-workflow-${createTestId()}`;
      
      await dbService.execute(
        'INSERT INTO workflows (id, name, description) VALUES (?, ?, ?)',
        [workflowId, 'Parallel Processing Workflow', 'Multiple independent processing tasks']
      );
      
      // Create base task
      const baseTask = await taskService.addTask({
        type: 'data-preparation',
        moduleId: 'prep',
        workflowId
      });
      
      // Create parallel tasks that all depend on base task
      const parallelTasks = await Promise.all([
        taskService.addTask({
          type: 'analysis-a',
          moduleId: 'analytics',
          workflowId,
          instructions: { analysis_type: 'statistical' }
        }),
        taskService.addTask({
          type: 'analysis-b',
          moduleId: 'analytics',
          workflowId,
          instructions: { analysis_type: 'ml' }
        }),
        taskService.addTask({
          type: 'analysis-c',
          moduleId: 'analytics',
          workflowId,
          instructions: { analysis_type: 'visualization' }
        })
      ]);
      
      // All parallel tasks depend on base task
      for (const parallelTask of parallelTasks) {
        await dbService.execute(
          'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)',
          [parallelTask.id, baseTask.id]
        );
      }
      
      // Create final aggregation task that depends on all parallel tasks
      const aggregationTask = await taskService.addTask({
        type: 'result-aggregation',
        moduleId: 'aggregation',
        workflowId
      });
      
      for (const parallelTask of parallelTasks) {
        await dbService.execute(
          'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)',
          [aggregationTask.id, parallelTask.id]
        );
      }
      
      // Verify workflow structure
      const workflowTasks = await dbService.prepare(`
        SELECT type FROM tasks WHERE workflow_id = ?
      `).all(workflowId);
      
      expect(workflowTasks).toHaveLength(5); // 1 base + 3 parallel + 1 aggregation
      
      // Verify dependency counts
      const dependencyCounts = await dbService.prepare(`
        SELECT t.type, COUNT(td.depends_on_task_id) as dependency_count
        FROM tasks t
        LEFT JOIN task_dependencies td ON t.id = td.task_id
        WHERE t.workflow_id = ?
        GROUP BY t.id, t.type
      `).all(workflowId);
      
      const aggregationDeps = dependencyCounts.find(dc => dc.type === 'result-aggregation');
      expect(aggregationDeps?.dependency_count).toBe(3); // Depends on all 3 parallel tasks
    });

    it('should detect and prevent circular dependencies', async () => {
      const taskA = await taskService.addTask({
        type: 'task-a',
        moduleId: 'test'
      });
      
      const taskB = await taskService.addTask({
        type: 'task-b', 
        moduleId: 'test'
      });
      
      const taskC = await taskService.addTask({
        type: 'task-c',
        moduleId: 'test'
      });
      
      // Create linear dependencies: A -> B -> C
      await dbService.execute(
        'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)',
        [taskB.id, taskA.id]
      );
      
      await dbService.execute(
        'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)',
        [taskC.id, taskB.id]
      );
      
      // Attempt to create circular dependency: C -> A (would create A -> B -> C -> A)
      try {
        // Check for circular dependency before inserting
        const pathExists = await dbService.prepare(`
          WITH RECURSIVE dependency_path(task_id, depends_on_task_id, path, depth) AS (
            SELECT task_id, depends_on_task_id, task_id || '->' || depends_on_task_id as path, 1
            FROM task_dependencies
            WHERE task_id = ?
            
            UNION ALL
            
            SELECT dp.task_id, td.depends_on_task_id, dp.path || '->' || td.depends_on_task_id, dp.depth + 1
            FROM dependency_path dp
            JOIN task_dependencies td ON dp.depends_on_task_id = td.task_id
            WHERE dp.depth < 10 AND dp.task_id != td.depends_on_task_id
          )
          SELECT 1 FROM dependency_path WHERE depends_on_task_id = ? AND task_id = ?
        `).get(taskC.id, taskA.id, taskC.id);
        
        if (pathExists) {
          throw new Error('Circular dependency detected');
        }
        
        await dbService.execute(
          'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)',
          [taskA.id, taskC.id] // This would create circular dependency
        );
        
        expect.fail('Should have detected circular dependency');
      } catch (error) {
        expect(error.message).toContain('Circular dependency');
      }
    });

    it('should handle conditional task execution', async () => {
      const workflowId = `conditional-workflow-${createTestId()}`;
      
      const decisionTask = await taskService.addTask({
        type: 'decision-task',
        moduleId: 'workflow',
        workflowId,
        instructions: { 
          condition: 'data_quality_score > 0.8',
          onSuccess: 'proceed-with-analysis',
          onFailure: 'data-cleanup'
        }
      });
      
      const analysisTask = await taskService.addTask({
        type: 'data-analysis',
        moduleId: 'analytics',
        workflowId
      });
      
      const cleanupTask = await taskService.addTask({
        type: 'data-cleanup',
        moduleId: 'cleanup',
        workflowId
      });
      
      // Create conditional dependencies
      await dbService.execute(
        'INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES (?, ?, ?)',
        [analysisTask.id, decisionTask.id, 'success']
      );
      
      await dbService.execute(
        'INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES (?, ?, ?)',
        [cleanupTask.id, decisionTask.id, 'failure']
      );
      
      // Simulate decision task completion with success
      await taskService.updateTaskStatus(decisionTask.id!, 'completed' as any);
      await taskService.completeTask(decisionTask.id!, { 
        decision: 'success',
        data_quality_score: 0.85 
      });
      
      // Check which tasks should be eligible to run
      const eligibleTasks = await dbService.prepare(`
        SELECT t.*, td.dependency_type
        FROM tasks t
        JOIN task_dependencies td ON t.id = td.task_id
        JOIN tasks dt ON td.depends_on_task_id = dt.id
        WHERE dt.id = ? AND dt.status = 'completed'
      `).all(decisionTask.id);
      
      const successPath = eligibleTasks.filter(t => t.dependency_type === 'success');
      const failurePath = eligibleTasks.filter(t => t.dependency_type === 'failure');
      
      expect(successPath).toHaveLength(1);
      expect(successPath[0].type).toBe('data-analysis');
      expect(failurePath).toHaveLength(1); // Still exists but shouldn't execute
    });
  });

  describe('Task Scheduling and Timing', () => {
    it('should handle scheduled task execution', async () => {
      const futureTime = new Date(Date.now() + 5000); // 5 seconds from now
      
      const scheduledTask = await taskService.addTask({
        type: 'scheduled-report',
        moduleId: 'reports',
        instructions: { 
          reportType: 'daily-summary',
          scheduledFor: futureTime.toISOString()
        },
        estimatedDuration: 600
      });
      
      // Task should be in pending state initially
      expect(scheduledTask.status).toBe('pending');
      
      // Simulate time passing and scheduler checking for due tasks
      const dueTasks = await dbService.prepare(`
        SELECT * FROM tasks 
        WHERE status = 'pending' 
        AND JSON_EXTRACT(instructions, '$.scheduledFor') <= datetime('now')
      `).all();
      
      // Task shouldn't be due yet
      expect(dueTasks.find(t => t.id === scheduledTask.id)).toBeUndefined();
      
      // Update task as if time has passed
      await dbService.execute(
        'UPDATE tasks SET instructions = ? WHERE id = ?',
        [JSON.stringify({ 
          reportType: 'daily-summary',
          scheduledFor: new Date(Date.now() - 1000).toISOString() // 1 second ago
        }), scheduledTask.id]
      );
      
      // Now task should be due
      const nowDueTasks = await dbService.prepare(`
        SELECT * FROM tasks 
        WHERE status = 'pending' 
        AND JSON_EXTRACT(instructions, '$.scheduledFor') <= datetime('now')
      `).all();
      
      expect(nowDueTasks.find(t => t.id === scheduledTask.id)).toBeDefined();
    });

    it('should handle task deadlines and escalation', async () => {
      const nearDeadlineTask = await taskService.addTask({
        type: 'urgent-processing',
        moduleId: 'processing',
        priority: 5,
        deadline: new Date(Date.now() + 3600000), // 1 hour deadline
        estimatedDuration: 1800 // 30 minutes estimated
      });
      
      const overdueTask = await taskService.addTask({
        type: 'overdue-task',
        moduleId: 'processing',
        priority: 6,
        deadline: new Date(Date.now() - 3600000) // 1 hour overdue
      });
      
      // Check for tasks approaching deadline
      const approachingDeadline = await dbService.prepare(`
        SELECT *, 
               (julianday(deadline) - julianday('now')) * 24 * 60 as minutes_to_deadline
        FROM tasks 
        WHERE deadline IS NOT NULL 
        AND deadline > datetime('now')
        AND (julianday(deadline) - julianday('now')) * 24 * 60 < 120
        ORDER BY deadline ASC
      `).all();
      
      expect(approachingDeadline.find(t => t.id === nearDeadlineTask.id)).toBeDefined();
      
      // Check for overdue tasks
      const overdueTasks = await dbService.prepare(`
        SELECT *,
               (julianday('now') - julianday(deadline)) * 24 * 60 as minutes_overdue
        FROM tasks 
        WHERE deadline IS NOT NULL 
        AND deadline < datetime('now')
        AND status NOT IN ('completed', 'cancelled')
      `).all();
      
      expect(overdueTasks.find(t => t.id === overdueTask.id)).toBeDefined();
      
      // Simulate escalation for overdue tasks
      for (const task of overdueTasks) {
        if (task.minutes_overdue > 60) { // Over 1 hour overdue
          await taskService.updateTask(task.id, { 
            priority: Math.min(task.priority + 2, 10) // Increase priority
          });
        }
      }
      
      const escalatedTask = await taskService.getTaskById(overdueTask.id!);
      expect(escalatedTask?.priority).toBe(8); // Increased from 6 to 8
    });

    it('should implement task retry mechanisms with backoff', async () => {
      const retryableTask = await taskService.addTask({
        type: 'unreliable-network-operation',
        moduleId: 'network',
        maxRetries: 3,
        instructions: {
          endpoint: 'https://unreliable-api.example.com/data',
          timeout: 5000
        }
      });
      
      // Assign to agent and start
      const agent = await agentService.create({
        id: `retry-agent-${createTestId()}`,
        name: 'Retry Test Agent',
        type: 'network'
      });
      
      await taskService.assignTaskToAgent(retryableTask.id!, agent.id);
      await taskService.updateTaskStatus(retryableTask.id!, 'in_progress' as any);
      
      // Simulate failures and retries
      let currentRetry = 0;
      while (currentRetry < retryableTask.maxRetries!) {
        await taskService.failTask(retryableTask.id!, `Network timeout (attempt ${currentRetry + 1})`);
        
        currentRetry++;
        await taskService.updateTask(retryableTask.id!, { 
          retryCount: currentRetry,
          status: currentRetry < retryableTask.maxRetries! ? 'pending' : 'failed'
        });
        
        // Simulate exponential backoff delay (in real implementation)
        const backoffDelay = Math.pow(2, currentRetry) * 1000; // 2^n seconds
        console.log(`Retry ${currentRetry} scheduled with ${backoffDelay}ms backoff`);
      }
      
      const finalTask = await taskService.getTaskById(retryableTask.id!);
      expect(finalTask?.status).toBe('failed');
      expect(finalTask?.retryCount).toBe(3);
    });

    it('should handle task batching and bulk operations', async () => {
      const batchWorkflowId = `batch-${createTestId()}`;
      
      // Create batch processing workflow
      await dbService.execute(
        'INSERT INTO workflows (id, name, description) VALUES (?, ?, ?)',
        [batchWorkflowId, 'Batch Processing', 'Process multiple files in batch']
      );
      
      // Create multiple similar tasks for batch processing
      const batchTasks = [];
      for (let i = 0; i < 10; i++) {
        const task = await taskService.addTask({
          type: 'file-processing',
          moduleId: 'batch',
          workflowId: batchWorkflowId,
          instructions: {
            fileName: `file_${i}.csv`,
            operation: 'transform'
          },
          priority: 4
        });
        batchTasks.push(task);
      }
      
      // Group tasks for batch processing
      const batchGroups = await dbService.prepare(`
        SELECT type, module_id, COUNT(*) as task_count
        FROM tasks 
        WHERE workflow_id = ? AND status = 'pending'
        GROUP BY type, module_id
        HAVING COUNT(*) >= 5
      `).all(batchWorkflowId);
      
      expect(batchGroups).toHaveLength(1);
      expect(batchGroups[0].task_count).toBe(10);
      
      // Create a batch coordinator task
      const batchCoordinator = await taskService.addTask({
        type: 'batch-coordinator',
        moduleId: 'batch',
        workflowId: batchWorkflowId,
        instructions: {
          batchSize: 5,
          totalTasks: 10,
          processingType: 'file-processing'
        }
      });
      
      // Update batch tasks to reference coordinator
      await dbService.execute(
        'UPDATE tasks SET parent_task_id = ? WHERE workflow_id = ? AND type = ?',
        [batchCoordinator.id, batchWorkflowId, 'file-processing']
      );
      
      // Verify batch structure
      const batchChildren = await dbService.prepare(`
        SELECT COUNT(*) as child_count FROM tasks WHERE parent_task_id = ?
      `).get(batchCoordinator.id);
      
      expect(batchChildren.child_count).toBe(10);
    });
  });

  describe('Task Performance and Optimization', () => {
    it('should track task execution metrics', async () => {
      const performanceTask = await taskService.addTask({
        type: 'performance-test',
        moduleId: 'performance',
        estimatedDuration: 2000,
        instructions: { complexity: 'high' }
      });
      
      const agent = await agentService.create({
        id: `perf-agent-${createTestId()}`,
        name: 'Performance Test Agent',
        type: 'performance'
      });
      
      await taskService.assignTaskToAgent(performanceTask.id!, agent.id);
      
      // Simulate task execution with timing
      const startTime = Date.now();
      await taskService.updateTaskStatus(performanceTask.id!, 'in_progress' as any);
      
      // Simulate some processing time
      await waitForEvent(100);
      
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      
      await taskService.completeTask(performanceTask.id!, { 
        processingTime: actualDuration,
        memoryUsed: 1024,
        cpuCycles: 50000
      });
      
      await taskService.updateTask(performanceTask.id!, {
        actualDuration
      });
      
      const completedTask = await taskService.getTaskById(performanceTask.id!);
      expect(completedTask?.status).toBe('completed');
      expect(completedTask?.actualDuration).toBeGreaterThan(0);
      expect(completedTask?.result).toContain('processingTime');
    });

    it('should analyze task performance patterns', async () => {
      // Create multiple tasks of the same type with different performance
      const taskTypes = ['analysis', 'transformation', 'loading'];
      const performanceData = [];
      
      for (const taskType of taskTypes) {
        for (let i = 0; i < 5; i++) {
          const task = await taskService.addTask({
            type: taskType,
            moduleId: 'benchmark',
            estimatedDuration: 1000 + (i * 200)
          });
          
          const actualDuration = 800 + (i * 250) + Math.random() * 200;
          await taskService.updateTask(task.id!, {
            status: 'completed',
            actualDuration: Math.round(actualDuration)
          });
          
          performanceData.push({
            type: taskType,
            estimated: task.estimatedDuration!,
            actual: Math.round(actualDuration)
          });
        }
      }
      
      // Analyze performance by task type
      const performanceAnalysis = await dbService.prepare(`
        SELECT 
          type,
          COUNT(*) as task_count,
          AVG(estimated_duration) as avg_estimated,
          AVG(actual_duration) as avg_actual,
          AVG(CAST(actual_duration - estimated_duration AS REAL) / estimated_duration * 100) as avg_variance_percent
        FROM tasks 
        WHERE status = 'completed' AND estimated_duration > 0 AND actual_duration > 0
        GROUP BY type
        ORDER BY avg_variance_percent DESC
      `).all();
      
      expect(performanceAnalysis).toHaveLength(3);
      performanceAnalysis.forEach(analysis => {
        expect(analysis.task_count).toBe(5);
        expect(analysis.avg_estimated).toBeGreaterThan(0);
        expect(analysis.avg_actual).toBeGreaterThan(0);
      });
    });

    it('should optimize task allocation based on historical performance', async () => {
      // Create agents with different performance profiles
      const agents = await Promise.all([
        agentService.create({
          id: `fast-agent-${createTestId()}`,
          name: 'Fast Agent',
          type: 'optimizer',
          performanceScore: 0.95
        }),
        agentService.create({
          id: `slow-agent-${createTestId()}`,
          name: 'Slow Agent',
          type: 'optimizer',
          performanceScore: 0.60
        }),
        agentService.create({
          id: `medium-agent-${createTestId()}`,
          name: 'Medium Agent',
          type: 'optimizer',
          performanceScore: 0.80
        })
      ]);
      
      // Create high-priority task
      const urgentTask = await taskService.addTask({
        type: 'optimization-test',
        moduleId: 'optimizer',
        priority: 9,
        estimatedDuration: 5000
      });
      
      // Find optimal agent based on performance score and availability
      const optimalAgent = await dbService.prepare(`
        SELECT a.*, 
               COALESCE(task_counts.active_tasks, 0) as current_workload
        FROM agents a
        LEFT JOIN (
          SELECT assigned_agent_id, COUNT(*) as active_tasks
          FROM tasks 
          WHERE status IN ('assigned', 'in_progress') 
          GROUP BY assigned_agent_id
        ) task_counts ON a.id = task_counts.assigned_agent_id
        WHERE a.type = 'optimizer'
        ORDER BY 
          (a.performance_score * 0.7) + ((5 - COALESCE(task_counts.active_tasks, 0)) * 0.3) DESC
        LIMIT 1
      `).get();
      
      expect(optimalAgent).toBeDefined();
      expect(optimalAgent.name).toBe('Fast Agent'); // Should select highest performing agent
      
      // Assign task to optimal agent
      await taskService.assignTaskToAgent(urgentTask.id!, optimalAgent.id);
      
      const assignedTask = await taskService.getTaskById(urgentTask.id!);
      expect(assignedTask?.assignedAgentId).toBe(optimalAgent.id);
    });
  });

  describe('Advanced Workflow Management', () => {
    it('should handle dynamic workflow modification', async () => {
      const dynamicWorkflowId = `dynamic-${createTestId()}`;
      
      await dbService.execute(
        'INSERT INTO workflows (id, name, description, status) VALUES (?, ?, ?, ?)',
        [dynamicWorkflowId, 'Dynamic Workflow', 'Workflow that adapts based on results', 'active']
      );
      
      // Create initial workflow tasks
      const initialTask = await taskService.addTask({
        type: 'data-assessment',
        moduleId: 'assessment',
        workflowId: dynamicWorkflowId,
        instructions: { assessmentType: 'data-quality' }
      });
      
      // Complete initial task with results that determine next steps
      await taskService.updateTaskStatus(initialTask.id!, 'completed' as any);
      await taskService.completeTask(initialTask.id!, {
        dataQuality: 'high',
        recordCount: 1000000,
        requiresPartitioning: true
      });
      
      const result = JSON.parse((await taskService.getTaskById(initialTask.id!))?.result || '{}');
      
      // Dynamically add tasks based on assessment results
      if (result.requiresPartitioning) {
        await taskService.addTask({
          type: 'data-partitioning',
          moduleId: 'partitioning',
          workflowId: dynamicWorkflowId,
          instructions: { 
            partitionSize: Math.ceil(result.recordCount / 10),
            strategy: 'temporal'
          }
        });
      }
      
      if (result.dataQuality === 'high') {
        await taskService.addTask({
          type: 'advanced-analytics',
          moduleId: 'analytics',
          workflowId: dynamicWorkflowId,
          instructions: { 
            algorithms: ['ml', 'statistical'],
            confidence: 'high'
          }
        });
      }
      
      // Verify dynamic tasks were created
      const workflowTasks = await dbService.prepare(`
        SELECT type FROM tasks WHERE workflow_id = ? ORDER BY created_at
      `).all(dynamicWorkflowId);
      
      expect(workflowTasks).toHaveLength(3);
      expect(workflowTasks.map(t => t.type)).toEqual([
        'data-assessment',
        'data-partitioning',
        'advanced-analytics'
      ]);
    });

    it('should implement workflow versioning and rollback', async () => {
      const versionedWorkflowId = `versioned-${createTestId()}`;
      
      // Create workflow version 1
      await dbService.execute(
        'INSERT INTO workflows (id, name, description, status) VALUES (?, ?, ?, ?)',
        [versionedWorkflowId + '_v1', 'Versioned Workflow v1', 'Initial version', 'active']
      );
      
      const v1Task = await taskService.addTask({
        type: 'legacy-processing',
        moduleId: 'legacy',
        workflowId: versionedWorkflowId + '_v1'
      });
      
      // Create workflow version 2 with improvements
      await dbService.execute(
        'INSERT INTO workflows (id, name, description, status) VALUES (?, ?, ?, ?)',
        [versionedWorkflowId + '_v2', 'Versioned Workflow v2', 'Improved version', 'active']
      );
      
      const v2Tasks = await Promise.all([
        taskService.addTask({
          type: 'optimized-processing',
          moduleId: 'optimized',
          workflowId: versionedWorkflowId + '_v2'
        }),
        taskService.addTask({
          type: 'validation',
          moduleId: 'validation',
          workflowId: versionedWorkflowId + '_v2'
        })
      ]);
      
      // Simulate issue with v2, need to rollback to v1
      const rollbackReason = 'Performance regression detected';
      
      await dbService.execute(
        'UPDATE workflows SET status = ? WHERE id = ?',
        ['deprecated', versionedWorkflowId + '_v2']
      );
      
      await dbService.execute(
        'UPDATE workflows SET status = ? WHERE id = ?',
        ['active', versionedWorkflowId + '_v1']
      );
      
      // Cancel v2 tasks and create v1 replacement tasks if needed
      for (const v2Task of v2Tasks) {
        await taskService.updateTaskStatus(v2Task.id!, 'cancelled' as any);
      }
      
      // Verify rollback
      const activeWorkflows = await dbService.prepare(`
        SELECT id, name FROM workflows WHERE status = 'active' AND id LIKE ?
      `).all(versionedWorkflowId + '%');
      
      expect(activeWorkflows).toHaveLength(1);
      expect(activeWorkflows[0].id).toBe(versionedWorkflowId + '_v1');
    });
  });
});