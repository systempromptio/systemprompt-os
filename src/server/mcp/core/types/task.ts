/**
 * Task Types - STUB IMPLEMENTATION
 * TODO: Define proper task types
 */

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface TaskCreate {
  title: string;
  description?: string;
  tool?: string;
  instructions?: string;
}

export interface TaskUpdate {
  status?: string;
  instructions?: string;
  metadata?: Record<string, any>;
}

export interface TaskSession {
  id: string;
  taskId: string;
  status: string;
  createdAt: Date;
}