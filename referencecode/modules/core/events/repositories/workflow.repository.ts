import { Service, Inject } from 'typedi';
import type { WorkflowDefinition, WorkflowDefinitionRow, WorkflowExecutionRow, WorkflowCheckpointRow } from '../types/index.js';
import type { IDatabaseService } from '../../database/types/index.js';
import { TYPES } from '@/modules/core/types.js';

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  event_execution_id: string;
  status: string;
  context: Record<string, unknown>;
  current_step_id?: string;
  step_results: Record<string, unknown>;
  started_at: Date;
  completed_at?: Date;
  error?: string;
  created_at: Date;
  updated_at: Date;
}

interface WorkflowCheckpoint {
  id: string;
  execution_id: string;
  step_id: string;
  state: Record<string, unknown>;
  created_at: Date;
}

@Service()
export class WorkflowRepository {
  constructor(
    @Inject(TYPES.Database) private readonly db: IDatabaseService
  ) {}
  
  /**
   * Get workflow definition by ID
   */
  async getById(id: string): Promise<WorkflowDefinition | null> {
    const row = await this.db.get(
      'SELECT * FROM workflow_definitions WHERE id = ?',
      [id]
    );
    
    return row ? this.rowToWorkflow(row) : null;
  }
  
  /**
   * Create a workflow definition
   */
  async create(workflow: WorkflowDefinition): Promise<void> {
    await this.db.run(
      `INSERT INTO workflow_definitions (
        id, name, description, version, steps, inputs, outputs,
        error_handling, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workflow.id,
        workflow.name,
        workflow.description,
        workflow.version,
        JSON.stringify(workflow.steps),
        workflow.inputs ? JSON.stringify(workflow.inputs) : null,
        workflow.outputs ? JSON.stringify(workflow.outputs) : null,
        workflow.error_handling ? JSON.stringify(workflow.error_handling) : null,
        1, // enabled by default
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  }
  
  /**
   * Update a workflow definition
   */
  async update(id: string, updates: Partial<WorkflowDefinition>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    
    if (updates.steps !== undefined) {
      fields.push('steps = ?');
      values.push(JSON.stringify(updates.steps));
    }
    
    if (updates.inputs !== undefined) {
      fields.push('inputs = ?');
      values.push(JSON.stringify(updates.inputs));
    }
    
    if (updates.outputs !== undefined) {
      fields.push('outputs = ?');
      values.push(JSON.stringify(updates.outputs));
    }
    
    if (updates.error_handling !== undefined) {
      fields.push('error_handling = ?');
      values.push(JSON.stringify(updates.error_handling));
    }
    
    if (fields.length > 0) {
      values.push(id);
      await this.db.run(
        `UPDATE workflow_definitions SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
  }
  
  /**
   * List all workflows
   */
  async list(enabled?: boolean): Promise<WorkflowDefinition[]> {
    let query = 'SELECT * FROM workflow_definitions';
    const params: unknown[] = [];
    
    if (enabled !== undefined) {
      query += ' WHERE enabled = ?';
      params.push(enabled ? 1 : 0);
    }
    
    const rows = await this.db.all(query, params);
    return rows.map(row => this.rowToWorkflow(row));
  }
  
  /**
   * Create a workflow execution
   */
  async createExecution(execution: Omit<WorkflowExecution, 'created_at' | 'updated_at'>): Promise<WorkflowExecution> {
    const now = new Date();
    const fullExecution: WorkflowExecution = {
      ...execution,
      created_at: now,
      updated_at: now
    };
    
    await this.db.run(
      `INSERT INTO workflow_executions (
        id, workflow_id, event_execution_id, status, context,
        current_step_id, step_results, started_at, completed_at,
        error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullExecution.id,
        fullExecution.workflow_id,
        fullExecution.event_execution_id,
        fullExecution.status,
        JSON.stringify(fullExecution.context),
        fullExecution.current_step_id,
        JSON.stringify(fullExecution.step_results),
        fullExecution.started_at.toISOString(),
        fullExecution.completed_at?.toISOString(),
        fullExecution.error,
        fullExecution.created_at.toISOString(),
        fullExecution.updated_at.toISOString()
      ]
    );
    
    return fullExecution;
  }
  
  /**
   * Update a workflow execution
   */
  async updateExecution(id: string, updates: Partial<WorkflowExecution>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    
    if (updates.current_step_id !== undefined) {
      fields.push('current_step_id = ?');
      values.push(updates.current_step_id);
    }
    
    if (updates.step_results !== undefined) {
      fields.push('step_results = ?');
      values.push(JSON.stringify(updates.step_results));
    }
    
    if (updates.completed_at !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completed_at.toISOString());
    }
    
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }
    
    if (fields.length > 0) {
      values.push(id);
      await this.db.run(
        `UPDATE workflow_executions SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
  }
  
  /**
   * Get workflow execution by ID
   */
  async getExecution(id: string): Promise<WorkflowExecution | null> {
    const row = await this.db.get(
      'SELECT * FROM workflow_executions WHERE id = ?',
      [id]
    );
    
    return row ? this.rowToExecution(row) : null;
  }
  
  /**
   * Create a checkpoint
   */
  async createCheckpoint(checkpoint: WorkflowCheckpoint): Promise<void> {
    await this.db.run(
      `INSERT INTO workflow_checkpoints (
        id, execution_id, step_id, state, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        checkpoint.id,
        checkpoint.execution_id,
        checkpoint.step_id,
        JSON.stringify(checkpoint.state),
        checkpoint.created_at.toISOString()
      ]
    );
  }
  
  /**
   * Get latest checkpoint for an execution
   */
  async getLatestCheckpoint(executionId: string): Promise<WorkflowCheckpoint | null> {
    const row = await this.db.get(
      `SELECT * FROM workflow_checkpoints 
       WHERE execution_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [executionId]
    );
    
    return row ? this.rowToCheckpoint(row) : null;
  }
  
  /**
   * Get checkpoints for a step
   */
  async getStepCheckpoints(executionId: string, stepId: string): Promise<WorkflowCheckpoint[]> {
    const rows = await this.db.all(
      `SELECT * FROM workflow_checkpoints 
       WHERE execution_id = ? AND step_id = ?
       ORDER BY created_at DESC`,
      [executionId, stepId]
    );
    
    return rows.map(row => this.rowToCheckpoint(row));
  }
  
  // Row conversion methods
  
  private rowToWorkflow(row: WorkflowDefinitionRow): WorkflowDefinition {
    const workflow: WorkflowDefinition = {
      id: row.id,
      name: row.name,
      version: row.version,
      steps: JSON.parse(row.steps || '[]')
    };
    if (row.description) {
      workflow.description = row.description;
    }
    if (row.inputs) {
      workflow.inputs = JSON.parse(row.inputs);
    }
    if (row.outputs) {
      workflow.outputs = JSON.parse(row.outputs);
    }
    if (row.error_handling) {
      workflow.error_handling = JSON.parse(row.error_handling);
    }
    return workflow;
  }
  
  private rowToExecution(row: WorkflowExecutionRow): WorkflowExecution {
    const execution: WorkflowExecution = {
      id: row.id,
      workflow_id: row.workflow_id,
      event_execution_id: row.event_execution_id,
      status: row.status,
      context: JSON.parse(row.context || '{}'),
      step_results: JSON.parse(row.step_results || '{}'),
      started_at: new Date(row.started_at),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
    if (row.current_step_id) {
      execution.current_step_id = row.current_step_id;
    }
    if (row.completed_at) {
      execution.completed_at = new Date(row.completed_at);
    }
    if (row.error) {
      execution.error = row.error;
    }
    return execution;
  }
  
  private rowToCheckpoint(row: WorkflowCheckpointRow): WorkflowCheckpoint {
    return {
      id: row.id,
      execution_id: row.execution_id,
      step_id: row.step_id,
      state: JSON.parse(row.state || '{}'),
      created_at: new Date(row.created_at)
    };
  }
}