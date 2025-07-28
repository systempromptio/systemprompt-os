/**
 * Enhanced Agent Operations Integration Tests
 * Tests advanced agent functionality, state management, and edge cases
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { TaskService } from '@/modules/core/tasks/services/task.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { createTestId, waitForEvent } from './setup';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Enhanced Agent Operations Integration Test', () => {
  let agentService: AgentService;
  let taskService: TaskService;
  let dbService: DatabaseService;
  let logger: LoggerService;
  
  const testSessionId = `enhanced-agents-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    console.log(`🚀 Setting up enhanced agent operations test (session: ${testSessionId})...`);
    
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Initialize logger first
    logger = LoggerService.getInstance();
    await logger.initialize({
      level: 'error',
      outputs: []
    });
    
    // Initialize database
    dbService = DatabaseService.getInstance();
    await dbService.initialize({
      type: 'sqlite',
      sqlite: { filename: testDbPath }
    }, logger);
    
    // Create comprehensive schema
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
        failed_tasks INTEGER DEFAULT 0,
        last_activity DATETIME,
        performance_score REAL DEFAULT 0.0,
        memory_usage INTEGER DEFAULT 0,
        cpu_usage REAL DEFAULT 0.0
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
        execution_time INTEGER DEFAULT 0,
        memory_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (assigned_agent_id) REFERENCES agents(id)
      )
    `);
    
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS agent_performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);
    
    // Initialize services
    agentService = AgentService.getInstance();
    taskService = TaskService.getInstance();
    
    console.log('✅ Enhanced agent operations test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up enhanced agent operations test (session: ${testSessionId})...`);
    
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
    await dbService.execute('DELETE FROM agent_performance_metrics');
    await dbService.execute('DELETE FROM tasks');
    await dbService.execute('DELETE FROM agents');
  });

  describe('Advanced Agent Creation and Configuration', () => {
    it('should create agents with complex capabilities and tools', async () => {
      const complexAgent = {
        id: `complex-agent-${createTestId()}`,
        name: 'Complex Processing Agent',
        description: 'Agent capable of handling multiple data processing tasks',
        instructions: 'Process data according to provided algorithms and return structured results',
        type: 'data-processor',
        capabilities: [
          'data-analysis',
          'statistical-processing', 
          'machine-learning',
          'report-generation',
          'data-visualization'
        ],
        tools: [
          'pandas', 'numpy', 'scikit-learn', 'matplotlib', 'jupyter'
        ],
        config: {
          maxConcurrentTasks: 5,
          memoryLimit: '2GB',
          timeout: 300000,
          enableCaching: true,
          logLevel: 'debug'
        }
      };
      
      const createdAgent = await agentService.create(complexAgent);
      
      expect(createdAgent.id).toBe(complexAgent.id);
      expect(createdAgent.capabilities).toEqual(complexAgent.capabilities);
      expect(createdAgent.tools).toEqual(complexAgent.tools);
      expect(createdAgent.config).toEqual(complexAgent.config);
      expect(createdAgent.status).toBe('stopped');
    });

    it('should validate agent configuration during creation', async () => {
      const invalidConfigs = [
        {
          // Missing required fields
          name: 'Incomplete Agent'
        },
        {
          // Invalid type
          name: 'Invalid Type Agent',
          type: '',
          id: `invalid-type-${createTestId()}`
        },
        {
          // Invalid capabilities format
          name: 'Invalid Capabilities Agent',
          type: 'processor',
          id: `invalid-caps-${createTestId()}`,
          capabilities: 'not-an-array'
        }
      ];
      
      for (const config of invalidConfigs) {
        try {
          await agentService.create(config as any);
          expect.fail(`Should have thrown error for invalid config: ${JSON.stringify(config)}`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle agent updates and configuration changes', async () => {
      const agent = await agentService.create({
        id: `update-agent-${createTestId()}`,
        name: 'Updatable Agent',
        type: 'processor',
        capabilities: ['basic-processing'],
        config: { version: '1.0' }
      });
      
      // Update agent configuration
      const updatedAgent = await agentService.update(agent.id, {
        name: 'Updated Agent Name',
        capabilities: ['basic-processing', 'advanced-processing'],
        config: { 
          version: '2.0',
          newFeature: true 
        }
      });
      
      expect(updatedAgent?.name).toBe('Updated Agent Name');
      expect(updatedAgent?.capabilities).toContain('advanced-processing');
      expect(updatedAgent?.config.version).toBe('2.0');
      expect(updatedAgent?.config.newFeature).toBe(true);
    });

    it('should manage agent lifecycle states correctly', async () => {
      const agent = await agentService.create({
        id: `lifecycle-agent-${createTestId()}`,
        name: 'Lifecycle Test Agent',
        type: 'processor'
      });
      
      // Initially stopped
      expect(agent.status).toBe('stopped');
      
      // Start agent
      await agentService.start(agent.id);
      let updatedAgent = await agentService.getById(agent.id);
      expect(updatedAgent?.status).toBe('active');
      
      // Stop agent
      await agentService.stop(agent.id);
      updatedAgent = await agentService.getById(agent.id);
      expect(updatedAgent?.status).toBe('stopped');
      
      // Force stop (should work even if already stopped)
      await agentService.stop(agent.id, true);
      updatedAgent = await agentService.getById(agent.id);
      expect(updatedAgent?.status).toBe('stopped');
    });
  });

  describe('Agent Performance Monitoring', () => {
    it('should track agent performance metrics', async () => {
      const agent = await agentService.create({
        id: `perf-agent-${createTestId()}`,
        name: 'Performance Tracked Agent',
        type: 'processor'
      });
      
      // Simulate performance metrics
      const metrics = [
        { type: 'cpu_usage', value: 45.5 },
        { type: 'memory_usage', value: 1024 },
        { type: 'task_completion_rate', value: 0.85 },
        { type: 'average_response_time', value: 250 }
      ];
      
      for (const metric of metrics) {
        await dbService.execute(
          'INSERT INTO agent_performance_metrics (agent_id, metric_type, value) VALUES (?, ?, ?)',
          [agent.id, metric.type, metric.value]
        );
      }
      
      // Retrieve and verify metrics
      const storedMetrics = await dbService.prepare(
        'SELECT * FROM agent_performance_metrics WHERE agent_id = ? ORDER BY timestamp DESC'
      ).all(agent.id);
      
      expect(storedMetrics).toHaveLength(4);
      expect(storedMetrics.map(m => m.metric_type)).toEqual([
        'average_response_time',
        'task_completion_rate', 
        'memory_usage',
        'cpu_usage'
      ]);
    });

    it('should calculate agent performance scores', async () => {
      const agent = await agentService.create({
        id: `score-agent-${createTestId()}`,
        name: 'Score Calculation Agent',
        type: 'processor'
      });
      
      // Create tasks with various outcomes
      const tasks = [
        { status: 'completed', execution_time: 1000, priority: 8 },
        { status: 'completed', execution_time: 1500, priority: 5 },
        { status: 'completed', execution_time: 800, priority: 9 },
        { status: 'failed', execution_time: 2000, priority: 7 },
        { status: 'completed', execution_time: 1200, priority: 6 }
      ];
      
      for (const task of tasks) {
        await taskService.createTask({
          type: 'performance-test',
          moduleId: 'test',
          assignedAgentId: agent.id,
          status: task.status as any,
          executionTime: task.execution_time,
          priority: task.priority
        });
      }
      
      // Calculate performance metrics
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const avgExecutionTime = completedTasks.reduce((sum, t) => sum + t.execution_time, 0) / completedTasks.length;
      const completionRate = completedTasks.length / tasks.length;
      const performanceScore = (completionRate * 0.6) + ((3000 - avgExecutionTime) / 3000 * 0.4);
      
      // Update agent performance score
      await agentService.update(agent.id, { 
        performanceScore: performanceScore,
        completedTasks: completedTasks.length,
        failedTasks: tasks.length - completedTasks.length
      });
      
      const updatedAgent = await agentService.getById(agent.id);
      expect(updatedAgent?.performanceScore).toBeCloseTo(performanceScore, 2);
    });

    it('should identify underperforming agents', async () => {
      // Create agents with different performance profiles
      const agents = await Promise.all([
        agentService.create({
          id: `high-perf-${createTestId()}`,
          name: 'High Performance Agent',
          type: 'processor',
          performanceScore: 0.95,
          completedTasks: 100,
          failedTasks: 2
        }),
        agentService.create({
          id: `med-perf-${createTestId()}`,
          name: 'Medium Performance Agent', 
          type: 'processor',
          performanceScore: 0.75,
          completedTasks: 80,
          failedTasks: 15
        }),
        agentService.create({
          id: `low-perf-${createTestId()}`,
          name: 'Low Performance Agent',
          type: 'processor',
          performanceScore: 0.45,
          completedTasks: 30,
          failedTasks: 25
        })
      ]);
      
      // Query underperforming agents (performance score < 0.6)
      const underperforming = await dbService.prepare(
        'SELECT * FROM agents WHERE performance_score < 0.6 ORDER BY performance_score ASC'
      ).all();
      
      expect(underperforming).toHaveLength(1);
      expect(underperforming[0].name).toBe('Low Performance Agent');
      expect(underperforming[0].performance_score).toBe(0.45);
    });
  });

  describe('Agent Workload Management', () => {
    it('should distribute tasks based on agent capabilities', async () => {
      // Create specialized agents
      const agents = await Promise.all([
        agentService.create({
          id: `data-specialist-${createTestId()}`,
          name: 'Data Specialist',
          type: 'specialist',
          capabilities: ['data-analysis', 'statistics', 'machine-learning']
        }),
        agentService.create({
          id: `web-specialist-${createTestId()}`,
          name: 'Web Specialist',
          type: 'specialist', 
          capabilities: ['web-scraping', 'api-integration', 'html-parsing']
        }),
        agentService.create({
          id: `general-worker-${createTestId()}`,
          name: 'General Worker',
          type: 'general',
          capabilities: ['general-processing', 'file-operations', 'basic-tasks']
        })
      ]);
      
      // Create tasks requiring different capabilities
      const tasks = await Promise.all([
        taskService.createTask({
          type: 'data-analysis',
          moduleId: 'analytics',
          instructions: { dataset: 'sales_data.csv', operation: 'correlation_analysis' }
        }),
        taskService.createTask({
          type: 'web-scraping',
          moduleId: 'scraper',
          instructions: { url: 'https://example.com', selector: '.data' }
        }),
        taskService.createTask({
          type: 'file-processing',
          moduleId: 'files',
          instructions: { operation: 'merge', files: ['a.txt', 'b.txt'] }
        })
      ]);
      
      // Assign tasks based on capabilities
      await taskService.assignTaskToAgent(tasks[0].id!, agents[0].id); // Data task to data specialist
      await taskService.assignTaskToAgent(tasks[1].id!, agents[1].id); // Web task to web specialist
      await taskService.assignTaskToAgent(tasks[2].id!, agents[2].id); // General task to general worker
      
      // Verify assignments
      const assignedTasks = await Promise.all(
        tasks.map(task => taskService.getTaskById(task.id!))
      );
      
      expect(assignedTasks[0]?.assignedAgentId).toBe(agents[0].id);
      expect(assignedTasks[1]?.assignedAgentId).toBe(agents[1].id);
      expect(assignedTasks[2]?.assignedAgentId).toBe(agents[2].id);
    });

    it('should handle agent overload scenarios', async () => {
      const agent = await agentService.create({
        id: `overload-agent-${createTestId()}`,
        name: 'Overload Test Agent',
        type: 'worker',
        config: { maxConcurrentTasks: 2 }
      });
      
      await agentService.start(agent.id);
      
      // Create multiple tasks for the same agent
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const task = await taskService.createTask({
          type: 'processing-task',
          moduleId: 'test',
          instructions: { index: i }
        });
        await taskService.assignTaskToAgent(task.id!, agent.id);
        await taskService.updateTaskStatus(task.id!, 'in_progress' as any);
        tasks.push(task);
      }
      
      // Check agent workload
      const agentTasks = await taskService.getTasksByAgentId(agent.id);
      const runningTasks = agentTasks.filter(t => t.status === 'in_progress');
      
      // Should have tasks assigned but may be queued
      expect(agentTasks.length).toBe(5);
      expect(runningTasks.length).toBeGreaterThan(0);
      
      // Mark agent as overloaded if too many running tasks
      const isOverloaded = runningTasks.length > (agent.config?.maxConcurrentTasks || 3);
      if (isOverloaded) {
        await agentService.update(agent.id, { status: 'overloaded' });
      }
      
      const updatedAgent = await agentService.getById(agent.id);
      if (runningTasks.length > 2) {
        expect(updatedAgent?.status).toBe('overloaded');
      }
    });

    it('should implement task priority queuing', async () => {
      const agent = await agentService.create({
        id: `priority-agent-${createTestId()}`,
        name: 'Priority Queue Agent',
        type: 'processor'
      });
      
      await agentService.start(agent.id);
      
      // Create tasks with different priorities
      const taskPriorities = [3, 8, 1, 10, 5, 7];
      const tasks = [];
      
      for (const priority of taskPriorities) {
        const task = await taskService.createTask({
          type: 'priority-task',
          moduleId: 'test',
          priority,
          instructions: { priority }
        });
        await taskService.assignTaskToAgent(task.id!, agent.id);
        tasks.push(task);
      }
      
      // Get tasks ordered by priority (highest first)
      const prioritizedTasks = await dbService.prepare(`
        SELECT * FROM tasks 
        WHERE assigned_agent_id = ? AND status = 'pending'
        ORDER BY priority DESC, created_at ASC
      `).all(agent.id);
      
      expect(prioritizedTasks).toHaveLength(6);
      expect(prioritizedTasks[0].priority).toBe(10); // Highest priority first
      expect(prioritizedTasks[1].priority).toBe(8);
      expect(prioritizedTasks[2].priority).toBe(7);
      expect(prioritizedTasks[5].priority).toBe(1);  // Lowest priority last
    });
  });

  describe('Agent Error Handling and Recovery', () => {
    it('should handle agent failures gracefully', async () => {
      const agent = await agentService.create({
        id: `failure-agent-${createTestId()}`,
        name: 'Failure Prone Agent',
        type: 'unreliable'
      });
      
      await agentService.start(agent.id);
      
      // Create task that will fail
      const task = await taskService.createTask({
        type: 'failing-task',
        moduleId: 'test',
        instructions: { shouldFail: true }
      });
      
      await taskService.assignTaskToAgent(task.id!, agent.id);
      await taskService.updateTaskStatus(task.id!, 'in_progress' as any);
      
      // Simulate agent failure
      await taskService.failTask(task.id!, 'Agent encountered unexpected error');
      await agentService.update(agent.id, { 
        status: 'error',
        failedTasks: 1
      });
      
      // Verify failure state
      const failedTask = await taskService.getTaskById(task.id!);
      const failedAgent = await agentService.getById(agent.id);
      
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.error).toContain('unexpected error');
      expect(failedAgent?.status).toBe('error');
      expect(failedAgent?.failedTasks).toBe(1);
    });

    it('should implement agent recovery mechanisms', async () => {
      const agent = await agentService.create({
        id: `recovery-agent-${createTestId()}`,
        name: 'Recovery Test Agent',
        type: 'resilient',
        config: { 
          autoRestart: true,
          maxFailures: 3
        }
      });
      
      // Simulate agent failure
      await agentService.update(agent.id, { 
        status: 'error',
        failedTasks: 2
      });
      
      // Attempt recovery
      const canRecover = agent.config?.autoRestart && 
                        (agent.failedTasks || 0) < (agent.config.maxFailures || 3);
      
      if (canRecover) {
        await agentService.update(agent.id, { status: 'stopped' });
        await agentService.start(agent.id);
      }
      
      const recoveredAgent = await agentService.getById(agent.id);
      expect(recoveredAgent?.status).toBe('active');
    });

    it('should handle resource exhaustion scenarios', async () => {
      const agent = await agentService.create({
        id: `resource-agent-${createTestId()}`,
        name: 'Resource Limited Agent',
        type: 'limited',
        config: {
          memoryLimit: 1024, // 1GB
          cpuThreshold: 80.0
        }
      });
      
      // Simulate high resource usage
      await agentService.update(agent.id, {
        memoryUsage: 1200,  // Exceeds limit
        cpuUsage: 85.0      // Exceeds threshold
      });
      
      const agent_data = await agentService.getById(agent.id);
      const memoryExceeded = (agent_data?.memoryUsage || 0) > (agent_data?.config?.memoryLimit || Infinity);
      const cpuExceeded = (agent_data?.cpuUsage || 0) > (agent_data?.config?.cpuThreshold || 100);
      
      if (memoryExceeded || cpuExceeded) {
        await agentService.update(agent.id, { status: 'resource_limited' });
      }
      
      const limitedAgent = await agentService.getById(agent.id);
      expect(limitedAgent?.status).toBe('resource_limited');
    });
  });

  describe('Agent Communication and Coordination', () => {
    it('should coordinate multiple agents for complex tasks', async () => {
      // Create a team of coordinated agents
      const coordinatorAgent = await agentService.create({
        id: `coordinator-${createTestId()}`,
        name: 'Task Coordinator',
        type: 'coordinator',
        capabilities: ['task-management', 'agent-coordination']
      });
      
      const workerAgents = await Promise.all([
        agentService.create({
          id: `worker-1-${createTestId()}`,
          name: 'Worker Agent 1',
          type: 'worker',
          capabilities: ['data-processing']
        }),
        agentService.create({
          id: `worker-2-${createTestId()}`,
          name: 'Worker Agent 2',
          type: 'worker',
          capabilities: ['result-aggregation']
        })
      ]);
      
      // Start all agents
      await agentService.start(coordinatorAgent.id);
      await Promise.all(workerAgents.map(agent => agentService.start(agent.id)));
      
      // Create complex task requiring coordination
      const complexTask = await taskService.createTask({
        type: 'complex-coordination',
        moduleId: 'coordination',
        instructions: {
          subtasks: [
            { type: 'data-processing', assignTo: 'worker' },
            { type: 'result-aggregation', assignTo: 'worker', dependsOn: 0 }
          ]
        }
      });
      
      // Assign main task to coordinator
      await taskService.assignTaskToAgent(complexTask.id!, coordinatorAgent.id);
      
      // Verify coordination setup
      const assignedTask = await taskService.getTaskById(complexTask.id!);
      expect(assignedTask?.assignedAgentId).toBe(coordinatorAgent.id);
      
      // Verify all agents are active
      const allAgents = await Promise.all([
        agentService.getById(coordinatorAgent.id),
        ...workerAgents.map(agent => agentService.getById(agent.id))
      ]);
      
      allAgents.forEach(agent => {
        expect(agent?.status).toBe('active');
      });
    });

    it('should handle agent communication failures', async () => {
      const agents = await Promise.all([
        agentService.create({
          id: `comm-agent-1-${createTestId()}`,
          name: 'Communication Agent 1',
          type: 'communicator'
        }),
        agentService.create({
          id: `comm-agent-2-${createTestId()}`,
          name: 'Communication Agent 2',
          type: 'communicator'
        })
      ]);
      
      await Promise.all(agents.map(agent => agentService.start(agent.id)));
      
      // Simulate communication failure
      await agentService.update(agents[1].id, { 
        status: 'communication_error',
        lastActivity: new Date(Date.now() - 300000) // 5 minutes ago
      });
      
      // Check for agents with communication issues
      const staleAgents = await dbService.prepare(`
        SELECT * FROM agents 
        WHERE status = 'communication_error' 
        OR (last_activity IS NOT NULL AND last_activity < datetime('now', '-5 minutes'))
      `).all();
      
      expect(staleAgents.length).toBeGreaterThan(0);
      
      // Attempt to recover communication
      for (const staleAgent of staleAgents) {
        if (staleAgent.status === 'communication_error') {
          await agentService.update(staleAgent.id, { status: 'stopped' });
          await agentService.start(staleAgent.id);
        }
      }
      
      const recoveredAgent = await agentService.getById(agents[1].id);
      expect(recoveredAgent?.status).toBe('active');
    });
  });

  describe('Agent Analytics and Reporting', () => {
    it('should generate comprehensive agent analytics', async () => {
      // Create agents with various activity levels
      const agents = await Promise.all([
        agentService.create({
          id: `analytics-agent-1-${createTestId()}`,
          name: 'High Activity Agent',
          type: 'worker',
          completedTasks: 150,
          failedTasks: 5,
          performanceScore: 0.92
        }),
        agentService.create({
          id: `analytics-agent-2-${createTestId()}`,
          name: 'Medium Activity Agent',
          type: 'worker',
          completedTasks: 75,
          failedTasks: 12,
          performanceScore: 0.78
        }),
        agentService.create({
          id: `analytics-agent-3-${createTestId()}`,
          name: 'Low Activity Agent',
          type: 'worker',
          completedTasks: 20,
          failedTasks: 8,
          performanceScore: 0.65
        })
      ]);
      
      // Generate analytics
      const analytics = await dbService.prepare(`
        SELECT 
          COUNT(*) as total_agents,
          AVG(completed_tasks) as avg_completed_tasks,
          AVG(failed_tasks) as avg_failed_tasks,
          AVG(performance_score) as avg_performance_score,
          MAX(performance_score) as max_performance_score,
          MIN(performance_score) as min_performance_score
        FROM agents 
        WHERE id LIKE 'analytics-agent-%'
      `).get();
      
      expect(analytics.total_agents).toBe(3);
      expect(analytics.avg_completed_tasks).toBeCloseTo(81.67, 1);
      expect(analytics.avg_performance_score).toBeCloseTo(0.783, 2);
      expect(analytics.max_performance_score).toBe(0.92);
      expect(analytics.min_performance_score).toBe(0.65);
    });

    it('should track agent utilization patterns over time', async () => {
      const agent = await agentService.create({
        id: `utilization-agent-${createTestId()}`,
        name: 'Utilization Tracking Agent',
        type: 'monitored'
      });
      
      // Simulate utilization data over time
      const utilizationData = [
        { hour: 0, utilization: 0.2 },
        { hour: 8, utilization: 0.8 },
        { hour: 12, utilization: 0.95 },
        { hour: 16, utilization: 0.7 },
        { hour: 20, utilization: 0.3 }
      ];
      
      for (const data of utilizationData) {
        await dbService.execute(
          'INSERT INTO agent_performance_metrics (agent_id, metric_type, value, timestamp) VALUES (?, ?, ?, datetime("now", ? || " hours"))',
          [agent.id, 'utilization', data.utilization, -data.hour.toString()]
        );
      }
      
      // Query utilization patterns
      const utilizationPattern = await dbService.prepare(`
        SELECT 
          strftime('%H', timestamp) as hour,
          AVG(value) as avg_utilization
        FROM agent_performance_metrics 
        WHERE agent_id = ? AND metric_type = 'utilization'
        GROUP BY strftime('%H', timestamp)
        ORDER BY hour
      `).all(agent.id);
      
      expect(utilizationPattern.length).toBe(5);
      expect(utilizationPattern.find(p => p.hour === '12')?.avg_utilization).toBe(0.95);
    });
  });
});