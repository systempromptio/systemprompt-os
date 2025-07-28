/**
 * Event system types for inter-module communication
 */

export interface IEventBus {
  emit<T = any>(event: string, data: T): void;
  on<T = any>(event: string, handler: (data: T) => void | Promise<void>): void;
  off(event: string, handler: Function): void;
  once<T = any>(event: string, handler: (data: T) => void | Promise<void>): void;
}

export interface IEventHandler<T = any> {
  (data: T): void | Promise<void>;
}

// Task Events
export interface TaskCreatedEvent {
  taskId: number;
  type: string;
  moduleId: string;
  priority: number;
}

export interface TaskAssignedEvent {
  taskId: number;
  agentId: string;
  assignedAt: Date;
}

export interface TaskStartedEvent {
  taskId: number;
  agentId: string;
  startedAt: Date;
}

export interface TaskCompletedEvent {
  taskId: number;
  agentId: string;
  result: any;
  completedAt: Date;
}

export interface TaskFailedEvent {
  taskId: number;
  agentId: string;
  error: string;
  failedAt: Date;
}

// Agent Events
export interface AgentCreatedEvent {
  agentId: string;
  name: string;
  type: string;
  capabilities: string[];
}

export interface AgentStartedEvent {
  agentId: string;
  startedAt: Date;
}

export interface AgentStoppedEvent {
  agentId: string;
  stoppedAt: Date;
}

export interface AgentAvailableEvent {
  agentId: string;
  capabilities: string[];
}

export interface AgentBusyEvent {
  agentId: string;
  taskId: number;
}

export interface AgentIdleEvent {
  agentId: string;
}

export interface AgentDeletedEvent {
  agentId: string;
}

// Event Names
export enum EventNames {
  // Task Events
  TASK_CREATED = 'task.created',
  TASK_ASSIGNED = 'task.assigned',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  
  // Agent Events
  AGENT_CREATED = 'agent.created',
  AGENT_STARTED = 'agent.started',
  AGENT_STOPPED = 'agent.stopped',
  AGENT_AVAILABLE = 'agent.available',
  AGENT_BUSY = 'agent.busy',
  AGENT_IDLE = 'agent.idle',
  AGENT_DELETED = 'agent.deleted',
}

// Module Events exports
export interface IEventsModuleExports {
  eventBus: IEventBus;
  EventNames: typeof EventNames;
}