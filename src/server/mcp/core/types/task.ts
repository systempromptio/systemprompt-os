/**
 * ITask types for MCP.
 */

export interface ITask {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  result?: unknown;
  error?: string;
}
