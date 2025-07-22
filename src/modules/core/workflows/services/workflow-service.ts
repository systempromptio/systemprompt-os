/**
 * @fileoverview Workflow service for managing workflow lifecycle
 * @module modules/core/workflows/services
 */

import { EventEmitter } from 'events';
import type { 
  WorkflowDefinition, 
  WorkflowExecution, 
  CreateWorkflowDto, 
  UpdateWorkflowDto,
  ExecuteWorkflowDto,
  ScheduleWorkflowDto,
  WorkflowStatus,
  ExecutionStatus,
  WorkflowEvent
} from '../types/workflow.types.js';
import type { WorkflowRepository } from '../repositories/workflow-repository.js';
import type { WorkflowEngine } from './workflow-engine.js';
import * as yaml from 'js-yaml';

export class WorkflowService extends EventEmitter {
  private scheduledWorkflows: Map<string, NodeJS.Timer> = new Map();

  constructor(
    private repository: WorkflowRepository,
    private engine: WorkflowEngine,
    private logger?: any
  ) {
    super();
    
    // Subscribe to engine events
    this.engine.on('execution-completed', this.handleExecutionCompleted.bind(this));
    this.engine.on('execution-failed', this.handleExecutionFailed.bind(this));
    this.engine.on('execution-cancelled', this.handleExecutionCancelled.bind(this));
  }

  async createWorkflow(data: CreateWorkflowDto): Promise<WorkflowDefinition> {
    try {
      // Validate workflow definition
      this.validateWorkflow(data);

      const workflow = await this.repository.createWorkflow(data);
      
      this.emitEvent({
        type: 'created',
        workflow_id: workflow.id,
        timestamp: new Date(),
        data: { workflow }
      });

      this.logger?.info('Workflow created', { 
        workflowId: workflow.id, 
        name: workflow.name 
      });
      
      return workflow;
    } catch (error) {
      this.logger?.error('Failed to create workflow', { error, data });
      throw error;
    }
  }

  async createWorkflowFromFile(filePath: string, name?: string): Promise<WorkflowDefinition> {
    try {
      // In a real implementation, this would read from file system
      // For now, we'll parse the provided content
      const definition = yaml.load(filePath) as CreateWorkflowDto;
      
      if (name) {
        definition.name = name;
      }

      return this.createWorkflow(definition);
    } catch (error) {
      this.logger?.error('Failed to create workflow from file', { error, filePath });
      throw error;
    }
  }

  async getWorkflow(id: string): Promise<WorkflowDefinition | null> {
    return this.repository.getWorkflow(id);
  }

  async listWorkflows(status?: WorkflowStatus): Promise<WorkflowDefinition[]> {
    return this.repository.listWorkflows(status);
  }

  async updateWorkflow(id: string, data: UpdateWorkflowDto): Promise<WorkflowDefinition | null> {
    try {
      const workflow = await this.repository.updateWorkflow(id, data);
      
      if (workflow) {
        this.emitEvent({
          type: 'updated',
          workflow_id: id,
          timestamp: new Date(),
          data: { changes: data }
        });

        this.logger?.info('Workflow updated', { workflowId: id });
      }
      
      return workflow;
    } catch (error) {
      this.logger?.error('Failed to update workflow', { error, workflowId: id });
      throw error;
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    try {
      const deleted = await this.repository.deleteWorkflow(id);
      if (!deleted) {
        throw new Error('Workflow not found');
      }

      // Cancel any scheduled executions
      this.cancelScheduledWorkflow(id);

      this.logger?.info('Workflow deleted', { workflowId: id });
    } catch (error) {
      this.logger?.error('Failed to delete workflow', { error, workflowId: id });
      throw error;
    }
  }

  async executeWorkflow(data: ExecuteWorkflowDto): Promise<WorkflowExecution> {
    try {
      const workflow = await this.repository.getWorkflow(data.workflow_id);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      if (workflow.status !== 'active') {
        throw new Error('Workflow is not active');
      }

      // Validate inputs
      this.validateInputs(workflow, data.inputs || {});

      // Create execution
      const execution = await this.repository.createExecution(
        workflow.id,
        workflow.version,
        data.inputs || {}
      );

      this.emitEvent({
        type: 'executed',
        workflow_id: workflow.id,
        execution_id: execution.id,
        timestamp: new Date(),
        data: { inputs: data.inputs }
      });

      this.logger?.info('Workflow execution started', { 
        workflowId: workflow.id,
        executionId: execution.id 
      });

      if (data.async !== false) {
        // Execute asynchronously
        setImmediate(() => {
          this.engine.executeWorkflow(workflow, execution).catch(error => {
            this.logger?.error('Workflow execution error', { 
              executionId: execution.id,
              error 
            });
          });
        });
      } else {
        // Execute synchronously
        await this.engine.executeWorkflow(workflow, execution);
      }

      return execution;
    } catch (error) {
      this.logger?.error('Failed to execute workflow', { error, data });
      throw error;
    }
  }

  async scheduleWorkflow(data: ScheduleWorkflowDto): Promise<string> {
    try {
      const workflow = await this.repository.getWorkflow(data.workflow_id);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const scheduleId = crypto.randomUUID();

      if (data.schedule.type === 'once' && data.schedule.at) {
        // Schedule one-time execution
        const delay = data.schedule.at.getTime() - Date.now();
        if (delay > 0) {
          const timer = setTimeout(() => {
            this.executeWorkflow({
              workflow_id: data.workflow_id,
              inputs: data.inputs,
              metadata: data.metadata
            }).catch(error => {
              this.logger?.error('Scheduled workflow execution failed', { error });
            });
            this.scheduledWorkflows.delete(scheduleId);
          }, delay);

          this.scheduledWorkflows.set(scheduleId, timer);
        }
      } else if (data.schedule.type === 'recurring' && data.schedule.cron) {
        // In a real implementation, this would use a cron library
        // For now, we'll simulate with setInterval
        const interval = setInterval(() => {
          this.executeWorkflow({
            workflow_id: data.workflow_id,
            inputs: data.inputs,
            metadata: data.metadata
          }).catch(error => {
            this.logger?.error('Scheduled workflow execution failed', { error });
          });
        }, 60000); // Execute every minute for demo

        this.scheduledWorkflows.set(scheduleId, interval);
      }

      this.emitEvent({
        type: 'scheduled',
        workflow_id: data.workflow_id,
        timestamp: new Date(),
        data: { scheduleId, schedule: data.schedule }
      });

      this.logger?.info('Workflow scheduled', { 
        workflowId: data.workflow_id,
        scheduleId 
      });

      return scheduleId;
    } catch (error) {
      this.logger?.error('Failed to schedule workflow', { error, data });
      throw error;
    }
  }

  async cancelScheduledWorkflow(scheduleId: string): void {
    const timer = this.scheduledWorkflows.get(scheduleId);
    if (timer) {
      clearTimeout(timer as NodeJS.Timeout);
      clearInterval(timer as NodeJS.Timer);
      this.scheduledWorkflows.delete(scheduleId);
      this.logger?.info('Scheduled workflow cancelled', { scheduleId });
    }
  }

  async getExecution(id: string): Promise<WorkflowExecution | null> {
    return this.repository.getExecution(id);
  }

  async listExecutions(
    workflowId?: string, 
    status?: ExecutionStatus,
    limit?: number
  ): Promise<WorkflowExecution[]> {
    return this.repository.listExecutions(workflowId, status, limit);
  }

  async cancelExecution(executionId: string, force: boolean = false): Promise<void> {
    try {
      await this.engine.cancelExecution(executionId, force ? 'Force cancelled' : 'Cancelled by user');
    } catch (error) {
      this.logger?.error('Failed to cancel execution', { error, executionId });
      throw error;
    }
  }

  async pauseExecution(executionId: string): Promise<void> {
    try {
      await this.engine.pauseExecution(executionId);
    } catch (error) {
      this.logger?.error('Failed to pause execution', { error, executionId });
      throw error;
    }
  }

  async resumeExecution(executionId: string): Promise<void> {
    try {
      await this.engine.resumeExecution(executionId);
    } catch (error) {
      this.logger?.error('Failed to resume execution', { error, executionId });
      throw error;
    }
  }

  validateWorkflow(workflow: CreateWorkflowDto): void {
    // Basic validation
    if (!workflow.name || workflow.name.trim().length === 0) {
      throw new Error('Workflow name is required');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate step IDs are unique
    const stepIds = new Set<string>();
    workflow.steps.forEach(step => {
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    });

    // Validate dependencies exist
    workflow.steps.forEach(step => {
      if (step.depends_on) {
        step.depends_on.forEach(depId => {
          if (!stepIds.has(depId)) {
            throw new Error(`Step ${step.id} depends on non-existent step: ${depId}`);
          }
        });
      }
    });
  }

  exportWorkflow(workflow: WorkflowDefinition): string {
    // Export workflow as YAML
    const exportData = {
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      triggers: workflow.triggers,
      inputs: workflow.inputs,
      outputs: workflow.outputs,
      steps: workflow.steps,
      error_handler: workflow.error_handler,
      metadata: workflow.metadata
    };

    return yaml.dump(exportData);
  }

  private validateInputs(workflow: WorkflowDefinition, inputs: Record<string, any>): void {
    if (!workflow.inputs) {
      return;
    }

    for (const input of workflow.inputs) {
      if (input.required && !(input.name in inputs)) {
        throw new Error(`Required input missing: ${input.name}`);
      }

      // Type validation could be added here
    }
  }

  private handleExecutionCompleted(event: any): void {
    this.emitEvent({
      type: 'completed',
      execution_id: event.executionId,
      timestamp: new Date(),
      data: event
    });
  }

  private handleExecutionFailed(event: any): void {
    this.emitEvent({
      type: 'failed',
      execution_id: event.executionId,
      timestamp: new Date(),
      data: event
    });
  }

  private handleExecutionCancelled(event: any): void {
    this.emitEvent({
      type: 'cancelled',
      execution_id: event.executionId,
      timestamp: new Date(),
      data: event
    });
  }

  private emitEvent(event: WorkflowEvent): void {
    this.emit('workflow-event', event);
  }
}