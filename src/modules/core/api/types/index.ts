/**
 * Module API interfaces for clean inter-module communication
 */

import type { ITask, TaskStatusEnum } from '@/modules/core/tasks/types/index';
import type { IAgent } from '@/modules/core/agents/types/agent.types';
import type { TokenValidationResult } from '@/modules/core/auth/types/index';
import type { IPermissionCheck } from '@/modules/core/permissions/types/index';

/**
 * Task Module API for external module access
 */
export interface ITaskModuleAPI {
  // Task Management
  createTask(task: Partial<ITask>): Promise<ITask>;
  getTask(taskId: number): Promise<ITask | null>;
  updateTask(taskId: number, updates: Partial<ITask>): Promise<ITask>;
  deleteTask(taskId: number): Promise<void>;
  
  // Task Assignment
  assignTaskToAgent(taskId: number, agentId: string): Promise<void>;
  unassignTask(taskId: number): Promise<void>;
  
  // Task Queries
  getTasksByAgent(agentId: string): Promise<ITask[]>;
  getTasksByStatus(status: TaskStatusEnum): Promise<ITask[]>;
  getNextAvailableTask(agentCapabilities?: string[]): Promise<ITask | null>;
  
  // Task Updates
  updateTaskStatus(taskId: number, status: TaskStatusEnum): Promise<void>;
  updateTaskProgress(taskId: number, progress: number): Promise<void>;
  completeTask(taskId: number, result: any): Promise<void>;
  failTask(taskId: number, error: string): Promise<void>;
}

/**
 * Agent Module API for external module access
 */
export interface IAgentModuleAPI {
  // Agent Management
  createAgent(agent: Partial<IAgent>): Promise<IAgent>;
  getAgent(agentId: string): Promise<IAgent | null>;
  updateAgent(agentId: string, updates: Partial<IAgent>): Promise<IAgent | null>;
  deleteAgent(agentId: string): Promise<void>;
  
  // Agent Lifecycle
  startAgent(agentId: string): Promise<void>;
  stopAgent(agentId: string, force?: boolean): Promise<void>;
  
  // Agent Status
  isAgentAvailable(agentId: string): Promise<boolean>;
  getAvailableAgents(capability?: string): Promise<IAgent[]>;
  reportAgentBusy(agentId: string, taskId: number): Promise<void>;
  reportAgentIdle(agentId: string, success: boolean): Promise<void>;
  
  // Agent Queries
  listAgents(status?: string): Promise<IAgent[]>;
  getAgentCapabilities(agentId: string): Promise<string[]>;
}

/**
 * Auth Module API for external module access
 */
export interface IAuthModuleAPI {
  // Token Operations
  validateToken(token: string): Promise<TokenValidationResult>;
  getUserIdFromToken(token: string): Promise<string | null>;
  
  // User Operations
  getUserById(userId: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  
  // Session Management
  isSessionValid(sessionId: string): Promise<boolean>;
  getSessionUserId(sessionId: string): Promise<string | null>;
}

/**
 * Permission Module API for external module access
 */
export interface IPermissionModuleAPI {
  // Permission Checks
  checkPermission(userId: string, resource: string, action: string): Promise<IPermissionCheck>;
  hasPermission(userId: string, resource: string, action: string): Promise<boolean>;
  
  // Role Management
  getUserRoles(userId: string): Promise<string[]>;
  hasRole(userId: string, roleName: string): Promise<boolean>;
  
  // Resource Access
  canAccessResource(userId: string, resourceId: string, action: string): Promise<boolean>;
  getAccessibleResources(userId: string, resourceType: string): Promise<string[]>;
}

/**
 * Orchestrator interface for coordinating between modules
 */
export interface ITaskOrchestrator {
  // Task Assignment
  assignNextAvailableTask(agentId: string): Promise<ITask | null>;
  assignTaskToOptimalAgent(taskId: number): Promise<string | null>;
  
  // Task Execution
  executeTask(agentId: string, taskId: number): Promise<void>;
  retryFailedTask(taskId: number): Promise<void>;
  
  // Monitoring
  getAgentWorkload(agentId: string): Promise<number>;
  getTaskQueueStatus(): Promise<{ pending: number; running: number; completed: number }>;
}