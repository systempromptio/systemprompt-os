/**
 * @fileoverview Workflow execution engine
 * @module modules/core/workflows/services
 */

import { EventEmitter } from 'events';
import type { 
  WorkflowDefinition, 
  WorkflowExecution, 
  WorkflowStep,
  StepResult,
  ExecutionContext,
  StepStatus
} from '../types/workflow.types.js';
import type { WorkflowRepository } from '../repositories/workflow-repository.js';

export class WorkflowEngine extends EventEmitter {
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private executionIntervals: Map<string, NodeJS.Timer> = new Map();
  private isRunning: boolean = false;

  constructor(
    private repository: WorkflowRepository,
    private logger?: any
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.logger?.info('Workflow engine started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Cancel all active executions
    for (const [executionId, execution] of this.activeExecutions) {
      await this.cancelExecution(executionId, 'Engine stopped');
    }

    // Clear all intervals
    for (const [executionId, interval] of this.executionIntervals) {
      clearInterval(interval);
    }
    this.executionIntervals.clear();

    this.logger?.info('Workflow engine stopped');
  }

  isHealthy(): boolean {
    return this.isRunning;
  }

  async executeWorkflow(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution
  ): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Workflow engine is not running');
    }

    try {
      this.activeExecutions.set(execution.id, execution);
      
      // Update status to running
      await this.repository.updateExecutionStatus(execution.id, 'running');
      
      // Start execution
      this.logger?.info('Starting workflow execution', { 
        executionId: execution.id,
        workflowId: workflow.id 
      });

      // Execute steps
      await this.executeSteps(workflow, execution, workflow.steps);

      // Mark as completed
      await this.repository.updateExecutionStatus(
        execution.id, 
        'completed',
        undefined,
        execution.context.variables
      );

      this.emit('execution-completed', { executionId: execution.id, workflow });
      this.logger?.info('Workflow execution completed', { executionId: execution.id });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle error
      if (workflow.error_handler) {
        try {
          await this.executeStep(workflow, execution, workflow.error_handler);
        } catch (handlerError) {
          this.logger?.error('Error handler failed', { 
            executionId: execution.id,
            error: handlerError 
          });
        }
      }

      await this.repository.updateExecutionStatus(
        execution.id,
        'failed',
        undefined,
        undefined,
        errorMessage
      );

      this.emit('execution-failed', { executionId: execution.id, error: errorMessage });
      this.logger?.error('Workflow execution failed', { 
        executionId: execution.id,
        error 
      });
    } finally {
      this.activeExecutions.delete(execution.id);
    }
  }

  async pauseExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found or not active');
    }

    await this.repository.updateExecutionStatus(executionId, 'paused');
    this.emit('execution-paused', { executionId });
    this.logger?.info('Workflow execution paused', { executionId });
  }

  async resumeExecution(executionId: string): Promise<void> {
    const execution = await this.repository.getExecution(executionId);
    if (!execution || execution.status !== 'paused') {
      throw new Error('Execution not found or not paused');
    }

    const workflow = await this.repository.getWorkflow(execution.workflow_id);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    await this.repository.updateExecutionStatus(executionId, 'running');
    this.emit('execution-resumed', { executionId });
    
    // Continue from checkpoint
    const checkpoint = await this.repository.getLatestCheckpoint(executionId);
    if (checkpoint) {
      execution.context = checkpoint.context;
      // Resume execution from the next step after checkpoint
      // This is simplified - real implementation would be more complex
    }

    await this.executeWorkflow(workflow, execution);
  }

  async cancelExecution(executionId: string, reason?: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found or not active');
    }

    await this.repository.updateExecutionStatus(
      executionId, 
      'cancelled',
      undefined,
      undefined,
      reason || 'Cancelled by user'
    );

    this.activeExecutions.delete(executionId);
    this.emit('execution-cancelled', { executionId, reason });
    this.logger?.info('Workflow execution cancelled', { executionId, reason });
  }

  private async executeSteps(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    steps: WorkflowStep[]
  ): Promise<void> {
    for (const step of steps) {
      // Check if execution was cancelled
      if (!this.activeExecutions.has(execution.id)) {
        throw new Error('Execution was cancelled');
      }

      // Check dependencies
      if (step.depends_on && step.depends_on.length > 0) {
        const allDependenciesMet = step.depends_on.every(depId => {
          const depResult = execution.context.step_results[depId];
          return depResult && depResult.status === 'completed';
        });

        if (!allDependenciesMet) {
          await this.skipStep(execution, step, 'Dependencies not met');
          continue;
        }
      }

      await this.executeStep(workflow, execution, step);
    }
  }

  private async executeStep(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    step: WorkflowStep
  ): Promise<void> {
    const startTime = new Date();
    let status: StepStatus = 'running';
    let outputs: Record<string, any> = {};
    let error: string | undefined;

    try {
      // Update current step
      await this.repository.updateExecutionStatus(execution.id, 'running', step.id);

      this.logger?.info('Executing step', { 
        executionId: execution.id,
        stepId: step.id,
        stepName: step.name 
      });

      // Execute based on step type
      switch (step.type) {
        case 'action':
          outputs = await this.executeAction(step, execution.context);
          break;
        
        case 'condition':
          await this.executeCondition(workflow, execution, step);
          break;
        
        case 'parallel':
          await this.executeParallel(workflow, execution, step);
          break;
        
        case 'loop':
          await this.executeLoop(workflow, execution, step);
          break;
        
        case 'subflow':
          await this.executeSubflow(step, execution.context);
          break;
        
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      status = 'completed';

      // Store outputs in context
      if (step.outputs) {
        step.outputs.forEach((outputName, index) => {
          execution.context.variables[outputName] = outputs[`output${index}`] || outputs[outputName];
        });
      }

    } catch (stepError) {
      status = 'failed';
      error = stepError instanceof Error ? stepError.message : 'Unknown error';

      // Handle step error based on configuration
      if (step.on_error === 'retry' && step.retry) {
        const retryCount = execution.context.step_results[step.id]?.retry_count || 0;
        if (retryCount < step.retry.attempts) {
          await this.retryStep(workflow, execution, step, retryCount + 1);
          return;
        }
      } else if (step.on_error === 'continue') {
        this.logger?.warn('Step failed but continuing', { 
          executionId: execution.id,
          stepId: step.id,
          error 
        });
      } else if (step.on_error === 'fail' || !step.on_error) {
        throw stepError;
      }
    }

    // Record step result
    const stepResult: StepResult = {
      step_id: step.id,
      status,
      started_at: startTime,
      completed_at: new Date(),
      outputs,
      error,
      retry_count: execution.context.step_results[step.id]?.retry_count || 0
    };

    await this.repository.addStepResult(execution.id, stepResult);
  }

  private async executeAction(
    step: WorkflowStep,
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    // In a real implementation, this would call the actual action
    // For now, we'll simulate it
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ 
          result: `Action ${step.action} executed`,
          timestamp: new Date() 
        });
      }, Math.random() * 1000);
    });
  }

  private async executeCondition(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    step: WorkflowStep
  ): Promise<void> {
    if (!step.condition) {
      throw new Error('Condition configuration missing');
    }

    // Evaluate condition (simplified)
    const result = this.evaluateExpression(step.condition.expression, execution.context);

    if (result) {
      await this.executeSteps(workflow, execution, step.condition.then_steps);
    } else if (step.condition.else_steps) {
      await this.executeSteps(workflow, execution, step.condition.else_steps);
    }
  }

  private async executeParallel(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    step: WorkflowStep
  ): Promise<void> {
    if (!step.parallel) {
      throw new Error('Parallel configuration missing');
    }

    const promises = step.parallel.branches.map(branch => 
      this.executeSteps(workflow, execution, branch)
    );

    if (step.parallel.wait_all) {
      await Promise.all(promises);
    } else {
      await Promise.race(promises);
    }
  }

  private async executeLoop(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    step: WorkflowStep
  ): Promise<void> {
    if (!step.loop) {
      throw new Error('Loop configuration missing');
    }

    const items = this.evaluateExpression(step.loop.over, execution.context);
    if (!Array.isArray(items)) {
      throw new Error('Loop over value must be an array');
    }

    const maxIterations = step.loop.max_iterations || items.length;
    
    for (let i = 0; i < Math.min(items.length, maxIterations); i++) {
      // Set loop variable
      execution.context.variables[step.loop.as] = items[i];
      execution.context.variables[`${step.loop.as}_index`] = i;

      await this.executeSteps(workflow, execution, step.loop.steps);
    }
  }

  private async executeSubflow(
    step: WorkflowStep,
    context: ExecutionContext
  ): Promise<void> {
    if (!step.subflow) {
      throw new Error('Subflow ID missing');
    }

    // In a real implementation, this would execute another workflow
    // For now, we'll simulate it
    this.logger?.info('Executing subflow', { subflowId: step.subflow });
  }

  private async skipStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
    reason: string
  ): Promise<void> {
    const stepResult: StepResult = {
      step_id: step.id,
      status: 'skipped',
      started_at: new Date(),
      completed_at: new Date(),
      error: reason
    };

    await this.repository.addStepResult(execution.id, stepResult);
    this.logger?.info('Step skipped', { 
      executionId: execution.id,
      stepId: step.id,
      reason 
    });
  }

  private async retryStep(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    step: WorkflowStep,
    retryCount: number
  ): Promise<void> {
    if (!step.retry) {
      return;
    }

    // Calculate delay
    let delay = step.retry.delay;
    if (step.retry.backoff === 'exponential') {
      delay = delay * Math.pow(2, retryCount - 1);
      if (step.retry.max_delay) {
        delay = Math.min(delay, step.retry.max_delay);
      }
    }

    this.logger?.info('Retrying step', { 
      executionId: execution.id,
      stepId: step.id,
      retryCount,
      delay 
    });

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    // Update retry count in context
    if (!execution.context.step_results[step.id]) {
      execution.context.step_results[step.id] = {} as StepResult;
    }
    execution.context.step_results[step.id].retry_count = retryCount;

    // Retry the step
    await this.executeStep(workflow, execution, step);
  }

  private evaluateExpression(expression: string, context: ExecutionContext): any {
    // In a real implementation, this would use a proper expression evaluator
    // For now, we'll do simple variable substitution
    let result = expression;
    
    Object.entries(context.variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
    });

    // Simple boolean evaluation
    if (result === 'true') return true;
    if (result === 'false') return false;
    
    return result;
  }
}