/**
 * Integration test demonstrating proper separation of concerns between
 * Agent and Task modules with clean interfaces
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'events';

// Mock interfaces demonstrating clean separation
interface ITaskAPI {
  createTask(task: Partial<ITask>): Promise<ITask>;
  updateTaskStatus(taskId: number, status: string, result?: any): Promise<void>;
  assignTaskToAgent(taskId: number, agentId: string): Promise<void>;
  getTask(taskId: number): Promise<ITask | null>;
  getTasksByAgent(agentId: string): Promise<ITask[]>;
  getNextAvailableTask(agentCapabilities?: string[]): Promise<ITask | null>;
}

interface IAgentAPI {
  createAgent(agent: Partial<IAgent>): Promise<IAgent>;
  updateAgentStatus(agentId: string, status: string): Promise<void>;
  getAgent(agentId: string): Promise<IAgent | null>;
  getAvailableAgents(capability?: string): Promise<IAgent[]>;
  reportAgentMetrics(agentId: string, metrics: any): Promise<void>;
}

interface ITask {
  id?: number;
  type: string;
  moduleId: string;
  instructions: any;
  priority: number;
  status: string;
  assignedAgentId?: string;
  result?: any;
  error?: string;
  createdAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface IAgent {
  id: string;
  name: string;
  type: string;
  status: 'stopped' | 'active' | 'busy';
  capabilities: string[];
  currentTaskId?: number;
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
}

// Event types for clean communication
type TaskEvents = {
  'task.created': { task: ITask };
  'task.assigned': { taskId: number; agentId: string };
  'task.started': { taskId: number; agentId: string };
  'task.completed': { taskId: number; result: any };
  'task.failed': { taskId: number; error: string };
};

type AgentEvents = {
  'agent.available': { agentId: string; capabilities: string[] };
  'agent.busy': { agentId: string; taskId: number };
  'agent.idle': { agentId: string };
};

// Mock implementation showing proper separation
class TaskModuleMock implements ITaskAPI {
  public tasks: Map<number, ITask> = new Map();
  private nextId = 1;
  private eventBus: EventEmitter;

  constructor(eventBus: EventEmitter) {
    this.eventBus = eventBus;
  }

  async createTask(task: Partial<ITask>): Promise<ITask> {
    const newTask: ITask = {
      id: this.nextId++,
      type: task.type!,
      moduleId: task.moduleId!,
      instructions: task.instructions || {},
      priority: task.priority || 5,
      status: 'pending',
      createdAt: new Date(),
      ...task
    };
    
    this.tasks.set(newTask.id!, newTask);
    this.eventBus.emit('task.created', { task: newTask });
    return newTask;
  }

  async updateTaskStatus(taskId: number, status: string, result?: any): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    
    task.status = status;
    
    if (status === 'running') {
      task.startedAt = new Date();
      this.eventBus.emit('task.started', { taskId, agentId: task.assignedAgentId! });
    } else if (status === 'completed') {
      task.completedAt = new Date();
      task.result = result;
      this.eventBus.emit('task.completed', { taskId, result });
    } else if (status === 'failed') {
      task.completedAt = new Date();
      task.error = result;
      this.eventBus.emit('task.failed', { taskId, error: result });
    }
  }

  async assignTaskToAgent(taskId: number, agentId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    
    task.assignedAgentId = agentId;
    task.status = 'assigned';
    this.eventBus.emit('task.assigned', { taskId, agentId });
    
    // This would be handled by the orchestrator in a real system
    // For the test, we'll let the orchestrator handle statistics
  }

  async getTask(taskId: number): Promise<ITask | null> {
    return this.tasks.get(taskId) || null;
  }

  async getTasksByAgent(agentId: string): Promise<ITask[]> {
    return Array.from(this.tasks.values()).filter(t => t.assignedAgentId === agentId);
  }

  async getNextAvailableTask(agentCapabilities?: string[]): Promise<ITask | null> {
    const pendingTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'pending')
      .sort((a, b) => b.priority - a.priority);
    
    return pendingTasks[0] || null;
  }
}

class AgentModuleMock implements IAgentAPI {
  private agents: Map<string, IAgent> = new Map();
  private eventBus: EventEmitter;
  private tasks: Map<number, ITask>;

  constructor(eventBus: EventEmitter, tasks: Map<number, ITask>) {
    this.eventBus = eventBus;
    this.tasks = tasks;
    
    // Subscribe to task events
    this.eventBus.on('task.assigned', ({ agentId }) => {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = 'busy';
        this.eventBus.emit('agent.busy', { agentId });
      }
    });
    
    this.eventBus.on('task.completed', ({ taskId }) => {
      // Find agent that was processing this task and set back to active
      const agent = Array.from(this.agents.values()).find(a => 
        Array.from(this.tasks.values()).some(t => t.id === taskId && t.assignedAgentId === a.id)
      );
      if (agent) {
        agent.status = 'active';
        this.eventBus.emit('agent.idle', { agentId: agent.id });
      }
    });
    
    this.eventBus.on('task.failed', ({ taskId }) => {
      // Find agent that was processing this task and set back to active
      const agent = Array.from(this.agents.values()).find(a => 
        Array.from(this.tasks.values()).some(t => t.id === taskId && t.assignedAgentId === a.id)
      );
      if (agent) {
        agent.status = 'active';
        this.eventBus.emit('agent.idle', { agentId: agent.id });
      }
    });
  }

  async createAgent(agent: Partial<IAgent>): Promise<IAgent> {
    const newAgent: IAgent = {
      id: agent.id || `agent-${Date.now()}`,
      name: agent.name!,
      description: agent.description || '',
      instructions: agent.instructions || '',
      type: agent.type!,
      status: 'stopped',
      config: agent.config || {},
      capabilities: agent.capabilities || [],
      tools: agent.tools || [],
      created_at: new Date(),
      updated_at: new Date(),
      assigned_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0,
      ...agent
    };
    
    this.agents.set(newAgent.id, newAgent);
    return newAgent;
  }

  async updateAgentStatus(agentId: string, status: 'stopped' | 'active' | 'busy'): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    
    agent.status = status;
    
    if (status === 'active') {
      this.eventBus.emit('agent.available', { agentId, capabilities: agent.capabilities });
    }
  }

  async getAgent(agentId: string): Promise<IAgent | null> {
    return this.agents.get(agentId) || null;
  }

  async getAvailableAgents(capability?: string): Promise<IAgent[]> {
    return Array.from(this.agents.values()).filter(a => 
      a.status === 'active' && 
      (!capability || a.capabilities.includes(capability))
    );
  }

  async reportAgentMetrics(agentId: string, metrics: any): Promise<void> {
    // Store metrics (in real implementation)
    console.log(`Agent ${agentId} metrics:`, metrics);
  }

  async incrementTaskCount(agentId: string, type: 'assigned' | 'completed' | 'failed'): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    
    switch (type) {
      case 'assigned':
        agent.assigned_tasks = (agent.assigned_tasks || 0) + 1;
        break;
      case 'completed':
        agent.completed_tasks = (agent.completed_tasks || 0) + 1;
        break;
      case 'failed':
        agent.failed_tasks = (agent.failed_tasks || 0) + 1;
        break;
    }
    
    this.agents.set(agentId, agent);
  }
}

// Task Orchestrator - coordinates between modules without coupling
class TaskOrchestrator {
  constructor(
    private taskAPI: ITaskAPI,
    private agentAPI: IAgentAPI,
    private eventBus: EventEmitter
  ) {
    // Listen for available agents to assign pending tasks
    this.eventBus.on('agent.available', async ({ agentId }) => {
      await this.assignNextTaskToAgent(agentId);
    });
    
    // Listen for idle agents to assign more work
    this.eventBus.on('agent.idle', async ({ agentId }) => {
      await this.assignNextTaskToAgent(agentId);
    });
  }

  private async assignNextTaskToAgent(agentId: string): Promise<void> {
    const agent = await this.agentAPI.getAgent(agentId);
    if (!agent || agent.status !== 'active') return;
    
    const task = await this.taskAPI.getNextAvailableTask(agent.capabilities);
    if (!task || !task.id) return;
    
    await this.taskAPI.assignTaskToAgent(task.id, agentId);
    await this.agentAPI.incrementTaskCount(agentId, 'assigned');
  }

  async executeTask(agentId: string, taskId: number): Promise<void> {
    const agent = await this.agentAPI.getAgent(agentId);
    const task = await this.taskAPI.getTask(taskId);
    
    if (!agent || !task) throw new Error('Agent or task not found');
    
    // Update task status to running
    await this.taskAPI.updateTaskStatus(taskId, 'running');
    
    try {
      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Complete task
      const result = { 
        processed: true, 
        output: `Task ${task.type} processed by ${agent.name}` 
      };
      await this.taskAPI.updateTaskStatus(taskId, 'completed', result);
      
      // Update agent statistics
      await this.agentAPI.incrementTaskCount(agentId, 'completed');
      
    } catch (error) {
      await this.taskAPI.updateTaskStatus(taskId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      await this.agentAPI.incrementTaskCount(agentId, 'failed');
    }
  }
}

describe('Agent-Task Clean Separation Integration Test', () => {
  let eventBus: EventEmitter;
  let taskModule: TaskModuleMock;
  let agentModule: AgentModuleMock;
  let orchestrator: TaskOrchestrator;

  beforeAll(() => {
    eventBus = new EventEmitter();
    taskModule = new TaskModuleMock(eventBus);
    agentModule = new AgentModuleMock(eventBus, taskModule.tasks);
    orchestrator = new TaskOrchestrator(taskModule, agentModule, eventBus);
  });

  afterAll(() => {
    eventBus.removeAllListeners();
  });

  describe('Clean Module Separation', () => {
    it('should create agent without knowing about tasks', async () => {
      const agent = await agentModule.createAgent({
        name: 'worker-1',
        type: 'processor',
        capabilities: ['data-processing', 'report-generation']
      });

      expect(agent.id).toBeDefined();
      expect(agent.assigned_tasks).toBe(0);
      expect(agent.completed_tasks).toBe(0);
      expect(agent.failed_tasks).toBe(0);
    });

    it('should create task without knowing about agents', async () => {
      const task = await taskModule.createTask({
        type: 'data-processing',
        moduleId: 'analytics',
        instructions: { process: 'aggregate', dataset: 'sales' },
        priority: 8
      });

      expect(task.id).toBeDefined();
      expect(task.assignedAgentId).toBeUndefined();
      expect(task.status).toBe('pending');
    });

    it('should coordinate task assignment through orchestrator', async () => {
      // Create agent and task
      const agent = await agentModule.createAgent({
        name: 'worker-2',
        type: 'processor',
        capabilities: ['report-generation']
      });

      const task = await taskModule.createTask({
        type: 'report-generation',
        moduleId: 'reporting',
        instructions: { report: 'monthly-summary' },
        priority: 10
      });

      // Start agent (makes it available)
      await agentModule.updateAgentStatus(agent.id, 'active');

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check task was assigned
      const updatedTask = await taskModule.getTask(task.id!);
      expect(updatedTask?.assignedAgentId).toBe(agent.id);
      expect(updatedTask?.status).toBe('assigned');

      // Check agent status
      const updatedAgent = await agentModule.getAgent(agent.id);
      expect(updatedAgent?.status).toBe('busy');
    });

    it('should handle task execution with clean interfaces', async () => {
      const agent = await agentModule.createAgent({
        name: 'executor-1',
        type: 'executor'
      });

      const task = await taskModule.createTask({
        type: 'execution-test',
        moduleId: 'test',
        priority: 5
      });

      await agentModule.updateAgentStatus(agent.id, 'active');
      await taskModule.assignTaskToAgent(task.id!, agent.id);
      await agentModule.incrementTaskCount(agent.id, 'assigned');

      // Execute task through orchestrator
      await orchestrator.executeTask(agent.id, task.id!);

      // Verify task completion
      const completedTask = await taskModule.getTask(task.id!);
      expect(completedTask?.status).toBe('completed');
      expect(completedTask?.result).toBeDefined();
      expect(completedTask?.result.output).toContain('processed by executor-1');

      // Verify agent statistics updated
      const updatedAgent = await agentModule.getAgent(agent.id);
      expect(updatedAgent?.completed_tasks).toBe(1);
      expect(updatedAgent?.assigned_tasks).toBeGreaterThanOrEqual(1);
      expect(updatedAgent?.status).toBe('active');
    });

    it('should handle multiple agents and tasks independently', async () => {
      // Create multiple agents
      const agents = await Promise.all([
        agentModule.createAgent({ name: 'multi-1', type: 'worker' }),
        agentModule.createAgent({ name: 'multi-2', type: 'worker' }),
        agentModule.createAgent({ name: 'multi-3', type: 'worker' })
      ]);

      // Create multiple tasks
      const tasks = await Promise.all([
        taskModule.createTask({ type: 'task-1', moduleId: 'test', priority: 1 }),
        taskModule.createTask({ type: 'task-2', moduleId: 'test', priority: 2 }),
        taskModule.createTask({ type: 'task-3', moduleId: 'test', priority: 3 })
      ]);

      // Activate all agents
      await Promise.all(
        agents.map(agent => agentModule.updateAgentStatus(agent.id, 'active'))
      );

      // Manually assign tasks to agents (since we don't have automatic assignment)
      for (let i = 0; i < tasks.length; i++) {
        const agent = agents[i % agents.length]; // Round-robin assignment
        await taskModule.assignTaskToAgent(tasks[i].id!, agent.id);
        await agentModule.incrementTaskCount(agent.id, 'assigned');
      }

      // Verify all tasks are assigned
      const assignedTasks = await Promise.all(
        tasks.map(task => taskModule.getTask(task.id!))
      );

      assignedTasks.forEach(task => {
        expect(task?.assignedAgentId).toBeDefined();
        expect(task?.status).toBe('assigned');
      });

      // Verify agents have tasks
      const busyAgents = await Promise.all(
        agents.map(agent => agentModule.getAgent(agent.id))
      );

      const busyCount = busyAgents.filter(a => a?.status === 'busy').length;
      expect(busyCount).toBe(3); // All agents should be busy
    });
  });

  describe('Event-Based Communication', () => {
    it('should communicate through events without direct coupling', async () => {
      const events: string[] = [];
      
      // Track all events
      ['task.created', 'task.assigned', 'agent.available', 'agent.busy'].forEach(event => {
        eventBus.on(event, () => events.push(event));
      });

      const agent = await agentModule.createAgent({ name: 'event-test', type: 'worker' });
      const task = await taskModule.createTask({ type: 'event-task', moduleId: 'test' });

      await agentModule.updateAgentStatus(agent.id, 'active');

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify event flow
      expect(events).toContain('task.created');
      expect(events).toContain('agent.available');
      expect(events).toContain('task.assigned');
      expect(events).toContain('agent.busy');
    });
  });
});