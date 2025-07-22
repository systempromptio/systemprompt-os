/**
 * @fileoverview Workflow repository for database operations
 * @module modules/core/workflows/repositories
 */

import type { 
  WorkflowDefinition, 
  WorkflowExecution, 
  CreateWorkflowDto, 
  UpdateWorkflowDto,
  ExecutionCheckpoint,
  WorkflowStatus,
  ExecutionStatus,
  StepResult
} from '../types/workflow.types.js';

export class WorkflowRepository {
  constructor(private database: any) {}

  async createWorkflow(data: CreateWorkflowDto): Promise<WorkflowDefinition> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const workflow: WorkflowDefinition = {
      id,
      name: data.name,
      description: data.description,
      version: data.version || '1.0.0',
      status: 'active',
      triggers: data.triggers || [],
      inputs: data.inputs || [],
      outputs: data.outputs || [],
      steps: data.steps,
      error_handler: data.error_handler,
      metadata: data.metadata,
      created_at: now,
      updated_at: now
    };

    await this.database.execute(
      `INSERT INTO workflows (id, name, description, version, status, triggers, inputs, outputs, 
       steps, error_handler, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workflow.id,
        workflow.name,
        workflow.description,
        workflow.version,
        workflow.status,
        JSON.stringify(workflow.triggers),
        JSON.stringify(workflow.inputs),
        JSON.stringify(workflow.outputs),
        JSON.stringify(workflow.steps),
        JSON.stringify(workflow.error_handler),
        JSON.stringify(workflow.metadata),
        workflow.created_at,
        workflow.updated_at
      ]
    );

    return workflow;
  }

  async getWorkflow(id: string): Promise<WorkflowDefinition | null> {
    const results = await this.database.query(
      'SELECT * FROM workflows WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapToWorkflow(results[0]);
  }

  async getWorkflowByName(name: string, version?: string): Promise<WorkflowDefinition | null> {
    let query = 'SELECT * FROM workflows WHERE name = ?';
    const params: any[] = [name];

    if (version) {
      query += ' AND version = ?';
      params.push(version);
    } else {
      query += ' AND status = ? ORDER BY created_at DESC LIMIT 1';
      params.push('active');
    }

    const results = await this.database.query(query, params);

    if (results.length === 0) {
      return null;
    }

    return this.mapToWorkflow(results[0]);
  }

  async listWorkflows(status?: WorkflowStatus): Promise<WorkflowDefinition[]> {
    let query = 'SELECT * FROM workflows';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const results = await this.database.query(query, params);
    return results.map((row: any) => this.mapToWorkflow(row));
  }

  async updateWorkflow(id: string, data: UpdateWorkflowDto): Promise<WorkflowDefinition | null> {
    const workflow = await this.getWorkflow(id);
    if (!workflow) {
      return null;
    }

    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [new Date()];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (data.steps !== undefined) {
      updates.push('steps = ?');
      params.push(JSON.stringify(data.steps));
    }

    if (data.triggers !== undefined) {
      updates.push('triggers = ?');
      params.push(JSON.stringify(data.triggers));
    }

    if (data.inputs !== undefined) {
      updates.push('inputs = ?');
      params.push(JSON.stringify(data.inputs));
    }

    if (data.outputs !== undefined) {
      updates.push('outputs = ?');
      params.push(JSON.stringify(data.outputs));
    }

    if (data.error_handler !== undefined) {
      updates.push('error_handler = ?');
      params.push(JSON.stringify(data.error_handler));
    }

    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }

    params.push(id);

    await this.database.execute(
      `UPDATE workflows SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return this.getWorkflow(id);
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const result = await this.database.execute(
      'DELETE FROM workflows WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  async createExecution(
    workflowId: string, 
    version: string,
    inputs: Record<string, any>
  ): Promise<WorkflowExecution> {
    const id = crypto.randomUUID();
    const now = new Date();

    const execution: WorkflowExecution = {
      id,
      workflow_id: workflowId,
      workflow_version: version,
      status: 'pending',
      inputs,
      started_at: now,
      context: {
        variables: { ...inputs },
        step_results: {},
        metadata: {}
      },
      checkpoints: []
    };

    await this.database.execute(
      `INSERT INTO workflow_executions (id, workflow_id, workflow_version, status, inputs, 
       started_at, context)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        execution.id,
        execution.workflow_id,
        execution.workflow_version,
        execution.status,
        JSON.stringify(execution.inputs),
        execution.started_at,
        JSON.stringify(execution.context)
      ]
    );

    return execution;
  }

  async getExecution(id: string): Promise<WorkflowExecution | null> {
    const results = await this.database.query(
      'SELECT * FROM workflow_executions WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return null;
    }

    const execution = this.mapToExecution(results[0]);
    
    // Load checkpoints
    const checkpoints = await this.database.query(
      'SELECT * FROM execution_checkpoints WHERE execution_id = ? ORDER BY created_at',
      [id]
    );
    
    execution.checkpoints = checkpoints.map((cp: any) => this.mapToCheckpoint(cp));
    
    return execution;
  }

  async listExecutions(
    workflowId?: string, 
    status?: ExecutionStatus,
    limit: number = 100
  ): Promise<WorkflowExecution[]> {
    let query = 'SELECT * FROM workflow_executions';
    const conditions: string[] = [];
    const params: any[] = [];

    if (workflowId) {
      conditions.push('workflow_id = ?');
      params.push(workflowId);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY started_at DESC LIMIT ?';
    params.push(limit);

    const results = await this.database.query(query, params);
    return results.map((row: any) => this.mapToExecution(row));
  }

  async updateExecutionStatus(
    id: string, 
    status: ExecutionStatus,
    currentStep?: string,
    outputs?: Record<string, any>,
    error?: string
  ): Promise<void> {
    const updates: string[] = ['status = ?'];
    const params: any[] = [status];

    if (currentStep !== undefined) {
      updates.push('current_step = ?');
      params.push(currentStep);
    }

    if (outputs !== undefined) {
      updates.push('outputs = ?');
      params.push(JSON.stringify(outputs));
    }

    if (error !== undefined) {
      updates.push('error = ?');
      params.push(error);
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      const now = new Date();
      updates.push('completed_at = ?');
      params.push(now);

      // Calculate duration
      const execution = await this.getExecution(id);
      if (execution) {
        const duration = now.getTime() - execution.started_at.getTime();
        updates.push('duration = ?');
        params.push(duration);
      }
    }

    params.push(id);

    await this.database.execute(
      `UPDATE workflow_executions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  async updateExecutionContext(id: string, context: any): Promise<void> {
    await this.database.execute(
      'UPDATE workflow_executions SET context = ? WHERE id = ?',
      [JSON.stringify(context), id]
    );
  }

  async addStepResult(executionId: string, stepResult: StepResult): Promise<void> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    execution.context.step_results[stepResult.step_id] = stepResult;
    await this.updateExecutionContext(executionId, execution.context);
  }

  async createCheckpoint(executionId: string, stepId: string, context: any): Promise<void> {
    const id = crypto.randomUUID();
    
    await this.database.execute(
      `INSERT INTO execution_checkpoints (id, execution_id, step_id, context, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        executionId,
        stepId,
        JSON.stringify(context),
        new Date()
      ]
    );
  }

  async getLatestCheckpoint(executionId: string): Promise<ExecutionCheckpoint | null> {
    const results = await this.database.query(
      'SELECT * FROM execution_checkpoints WHERE execution_id = ? ORDER BY created_at DESC LIMIT 1',
      [executionId]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapToCheckpoint(results[0]);
  }

  private mapToWorkflow(row: any): WorkflowDefinition {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      version: row.version,
      status: row.status,
      triggers: JSON.parse(row.triggers || '[]'),
      inputs: JSON.parse(row.inputs || '[]'),
      outputs: JSON.parse(row.outputs || '[]'),
      steps: JSON.parse(row.steps || '[]'),
      error_handler: row.error_handler ? JSON.parse(row.error_handler) : undefined,
      metadata: JSON.parse(row.metadata || '{}'),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }

  private mapToExecution(row: any): WorkflowExecution {
    return {
      id: row.id,
      workflow_id: row.workflow_id,
      workflow_version: row.workflow_version,
      status: row.status,
      inputs: JSON.parse(row.inputs || '{}'),
      outputs: row.outputs ? JSON.parse(row.outputs) : undefined,
      error: row.error,
      started_at: new Date(row.started_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      duration: row.duration,
      current_step: row.current_step,
      context: JSON.parse(row.context || '{}'),
      checkpoints: []
    };
  }

  private mapToCheckpoint(row: any): ExecutionCheckpoint {
    return {
      id: row.id,
      execution_id: row.execution_id,
      step_id: row.step_id,
      context: JSON.parse(row.context || '{}'),
      created_at: new Date(row.created_at)
    };
  }
}