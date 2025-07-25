import { Service, Inject } from 'typedi';
import { BaseEventExecutor } from './base.executor.js';
import {
  EventPriority,
  EventTriggerType,
  ExecutorType,
} from '../types/index.js';
import type {
  Event,
  EventExecution,
  ExecutionResult,
  ExecutorCapabilities,
  WorkflowDefinition,
  WorkflowStep,
  EventCondition,
  RetryPolicy,
} from '../types/index.js';
import type { ILogger } from '../../logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { EventService } from '../services/event.service.js';
import { WorkflowRepository } from '../repositories/workflow.repository.js';
import { nanoid } from 'nanoid';

/**
 * Workflow executor - executes complex multi-step workflows
 */
@Service()
export class WorkflowExecutor extends BaseEventExecutor {
  readonly type = ExecutorType.WORKFLOW;

  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject() private readonly eventService: EventService,
    @Inject() private readonly workflowRepository: WorkflowRepository,
  ) {
    super();
  }

  /**
   * Execute a workflow event
   */
  async execute(event: Event, execution: EventExecution): Promise<ExecutionResult> {
    try {
      const workflowId = execution.context['workflow_id'] as string;

      if (!workflowId) {
        throw new Error('No workflow_id provided in execution context');
      }

      // Get workflow definition
      const workflow = await this.workflowRepository.getById(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      // Create workflow execution record
      const workflowExecution = await this.workflowRepository.createExecution({
        id: nanoid(),
        workflow_id: workflow.id,
        event_execution_id: execution.id,
        status: 'running',
        context: {
          ...event.data,
          event_metadata: event.metadata,
          workflow_inputs: workflow.inputs,
        },
        step_results: {},
        started_at: new Date(),
      });

      // Execute workflow steps
      const result = await this.executeWorkflow(
        workflow,
        workflowExecution.id,
        workflowExecution.context,
      );

      // Update workflow execution status
      const updateData: Parameters<typeof this.workflowRepository.updateExecution>[1] = {
        status: result.success ? 'completed' : 'failed',
        completed_at: new Date(),
      };
      if (result.error) {
        updateData.error = result.error;
      }
      await this.workflowRepository.updateExecution(workflowExecution.id, updateData);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Workflow execution failed', {
        error: errorMessage,
        event_id: event.id,
        execution_id: execution.id,
      });

      return this.failure(
        errorMessage,
        execution.retry_count < execution.max_retries,
        this.calculateRetryDelay(execution.retry_count, execution.context['retry_policy'] as RetryPolicy | undefined),
      );
    }
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflow(
    workflow: WorkflowDefinition,
    executionId: string,
    context: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const stepResults: Record<string, unknown> = {};
    const executedSteps = new Set<string>();

    try {
      // Find entry steps (steps with no dependencies)
      const entrySteps = workflow.steps.filter(step =>
        !workflow.steps.some(s => s.next_steps?.includes(step.id)),
      );

      if (entrySteps.length === 0) {
        throw new Error('No entry steps found in workflow');
      }

      // Execute steps starting from entry points
      for (const step of entrySteps) {
        await this.executeStep(
          step,
          workflow,
          executionId,
          context,
          stepResults,
          executedSteps,
        );
      }

      // Build output from step results
      const output = this.buildOutput(workflow.outputs || {}, stepResults);

      return this.success({
        workflow_id: workflow.id,
        execution_id: executionId,
        output,
        step_results: stepResults,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Handle error based on workflow configuration
      if (workflow.error_handling?.on_workflow_failure === 'compensate') {
        await this.runCompensation(workflow, executionId, stepResults);
      }

      return this.failure(errorMessage);
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    workflow: WorkflowDefinition,
    executionId: string,
    context: Record<string, unknown>,
    stepResults: Record<string, unknown>,
    executedSteps: Set<string>,
  ): Promise<void> {
    // Prevent infinite loops
    if (executedSteps.has(step.id)) {
      return;
    }
    executedSteps.add(step.id);

    // Save checkpoint
    await this.workflowRepository.createCheckpoint({
      id: nanoid(),
      execution_id: executionId,
      step_id: step.id,
      state: { context, stepResults },
      created_at: new Date(),
    });

    try {
      let result: any;

      switch (step.type) {
      case 'action':
        result = await this.executeAction(step, context, stepResults);
        break;

      case 'condition':
        result = await this.evaluateCondition(step, context, stepResults);
        break;

      case 'parallel':
        result = await this.executeParallel(step, workflow, executionId, context, stepResults);
        break;

      case 'loop':
        result = await this.executeLoop(step, workflow, executionId, context, stepResults);
        break;

      case 'subflow':
        result = await this.executeSubflow(step, context);
        break;

      default:
        throw new Error(`Unknown step type: ${step.type}`);
      }

      // Store step result
      stepResults[step.id] = result;

      // Execute next steps
      if (step.next_steps) {
        for (const nextStepId of step.next_steps) {
          const nextStep = workflow.steps.find(s => s.id === nextStepId);
          if (nextStep) {
            await this.executeStep(
              nextStep,
              workflow,
              executionId,
              context,
              stepResults,
              executedSteps,
            );
          }
        }
      }

    } catch (error) {
      this.logger.error('Step execution failed', {
        step_id: step.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Handle step failure based on configuration
      if (workflow.error_handling?.on_step_failure === 'fail') {
        throw error;
      }
      // Otherwise continue or retry based on step config
    }
  }

  /**
   * Execute an action step
   */
  private async executeAction(
    step: WorkflowStep,
    context: Record<string, unknown>,
    stepResults: Record<string, unknown>,
  ): Promise<unknown> {
    if (!step.action) {
      throw new Error('Action step missing action property');
    }

    // Resolve inputs with context
    const inputs = this.resolveInputs(step.inputs || {} as any as Record<string, unknown>, context, stepResults);

    // Create an event for this action
    const actionEvent = await this.eventService.createEvent({
      name: `workflow.step.${step.id}`,
      type: step.action,
      priority: EventPriority.NORMAL,
      data: inputs,
      metadata: { step_id: step.id, step_name: step.name },
      trigger_type: EventTriggerType.WORKFLOW,
    });

    // Execute the action event and wait for result
    const result = await this.eventService.executeEvent(actionEvent.id);

    if (!result.success) {
      throw new Error(result.error || 'Action execution failed');
    }

    return result.data;
  }

  /**
   * Evaluate a condition step
   */
  private async evaluateCondition(
    step: WorkflowStep,
    context: Record<string, unknown>,
    stepResults: Record<string, unknown>,
  ): Promise<boolean> {
    if (!step.conditions || step.conditions.length === 0) {
      return true;
    }

    return step.conditions.every(condition =>
      this.evaluateConditionExpression(condition, context, stepResults),
    );
  }

  /**
   * Evaluate a single condition expression
   */
  private evaluateConditionExpression(
    condition: EventCondition,
    context: Record<string, unknown>,
    stepResults: Record<string, unknown>,
  ): boolean {
    const value = this.resolveValue(condition.field, context, stepResults);

    switch (condition.operator) {
    case 'eq':
      return value === condition.value;
    case 'neq':
      return value !== condition.value;
    case 'gt':
      return typeof condition.value === 'number' && typeof value === 'number' && value > condition.value;
    case 'gte':
      return typeof condition.value === 'number' && typeof value === 'number' && value >= condition.value;
    case 'lt':
      return typeof condition.value === 'number' && typeof value === 'number' && value < condition.value;
    case 'lte':
      return typeof condition.value === 'number' && typeof value === 'number' && value <= condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'nin':
      return Array.isArray(condition.value) && !condition.value.includes(value);
    case 'exists':
      return value !== undefined && value !== null;
    case 'regex':
      return typeof condition.value === 'string' && new RegExp(condition.value).test(String(value));
    default:
      return false;
    }
  }

  /**
   * Execute parallel steps
   */
  private async executeParallel(
    step: WorkflowStep,
    workflow: WorkflowDefinition,
    executionId: string,
    context: Record<string, unknown>,
    stepResults: Record<string, unknown>,
  ): Promise<any[]> {
    if (!step.next_steps || step.next_steps.length === 0) {
      return [];
    }

    const parallelPromises = step.next_steps.map(async stepId => {
      const parallelStep = workflow.steps.find(s => s.id === stepId);
      if (!parallelStep) {
        throw new Error(`Parallel step not found: ${stepId}`);
      }

      const parallelResults = { ...stepResults };
      const parallelExecuted = new Set(Object.keys(stepResults));

      await this.executeStep(
        parallelStep,
        workflow,
        executionId,
        context,
        parallelResults,
        parallelExecuted,
      );

      return parallelResults[stepId];
    });

    return Promise.all(parallelPromises);
  }

  /**
   * Execute loop step
   */
  private async executeLoop(
    step: WorkflowStep,
    workflow: WorkflowDefinition,
    executionId: string,
    context: Record<string, unknown>,
    stepResults: Record<string, unknown>,
  ): Promise<any[]> {
    const loopResults: unknown[] = [];
    const maxIterations = (typeof step.inputs?.['max_iterations'] === 'number' ? step.inputs['max_iterations'] : 100);
    let iteration = 0;

    while (iteration < maxIterations) {
      // Check loop condition
      if (step.conditions && step.conditions.length > 0) {
        const shouldContinue = await this.evaluateCondition(step, context, stepResults);
        if (!shouldContinue) {
          break;
        }
      }

      // Execute loop body
      if (step.next_steps && step.next_steps.length > 0) {
        for (const stepId of step.next_steps) {
          const loopStep = workflow.steps.find(s => s.id === stepId);
          if (loopStep) {
            const loopContext = { ...context, loop_index: iteration };
            const loopStepResults = { ...stepResults };
            const loopExecuted = new Set<string>();

            await this.executeStep(
              loopStep,
              workflow,
              executionId,
              loopContext,
              loopStepResults,
              loopExecuted,
            );

            loopResults.push(loopStepResults[stepId]);
          }
        }
      }

      iteration++;
    }

    return loopResults;
  }

  /**
   * Execute subflow step
   */
  private async executeSubflow(
    step: WorkflowStep,
    context: Record<string, unknown>,
  ): Promise<unknown> {
    const subflowId = step.inputs?.['workflow_id'] as string;

    if (!subflowId) {
      throw new Error('Subflow step missing workflow_id');
    }

    // Create event to execute subflow
    const subflowEvent = await this.eventService.createEvent({
      name: `workflow.subflow.${step.id}`,
      type: 'workflow.execute',
      priority: EventPriority.NORMAL,
      data: this.resolveInputs((step.inputs?.['data'] || {}) as Record<string, unknown>, context, {}),
      metadata: {
        parent_step_id: step.id,
        workflow_id: subflowId,
      },
      trigger_type: EventTriggerType.WORKFLOW,
    });

    // Execute subflow and wait for result
    const result = await this.eventService.executeEvent(subflowEvent.id);

    if (!result.success) {
      throw new Error(result.error || 'Subflow execution failed');
    }

    return result.data;
  }

  /**
   * Resolve inputs with context values
   */
  private resolveInputs(
    inputs: Record<string, unknown>,
    context: Record<string, unknown>,
    stepResults: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        // Template expression
        const path = value.slice(2, -2).trim();
        resolved[key] = this.resolveValue(path, context, stepResults);
      } else if (typeof value === 'object' && value !== null) {
        // Nested object
        resolved[key] = this.resolveInputs(value as Record<string, unknown>, context, stepResults);
      } else {
        // Static value
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Resolve a value from context or step results
   */
  private resolveValue(
    path: string,
    context: Record<string, unknown>,
    stepResults: Record<string, unknown>,
  ): unknown {
    const parts = path.split('.');
    let current: unknown = { ...context, steps: stepResults };

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Build output from step results
   */
  private buildOutput(
    outputSchema: Record<string, unknown>,
    stepResults: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.resolveInputs(outputSchema, {}, stepResults);
  }

  /**
   * Run compensation steps
   */
  private async runCompensation(
    workflow: WorkflowDefinition,
    executionId: string,
    stepResults: Record<string, unknown>,
  ): Promise<void> {
    if (!workflow.error_handling?.compensation_steps) {
      return;
    }

    this.logger.info('Running compensation steps', {
      workflow_id: workflow.id,
      execution_id: executionId,
    });

    const compensationContext = { ...stepResults, compensation: true };
    const compensationResults: Record<string, unknown> = {};
    const executedSteps = new Set<string>();

    for (const step of workflow.error_handling.compensation_steps) {
      try {
        await this.executeStep(
          step,
          workflow,
          executionId,
          compensationContext,
          compensationResults,
          executedSteps,
        );
      } catch (error) {
        this.logger.error('Compensation step failed', {
          step_id: step.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other compensation steps
      }
    }
  }

  /**
   * Validate workflow configuration
   */
  override async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    const workflowId = config['workflow_id'];

    if (!workflowId || typeof workflowId !== 'string') {
      return false;
    }

    // Check if workflow exists
    const workflow = await this.workflowRepository.getById(workflowId);
    return workflow !== null;
  }

  /**
   * Get executor capabilities
   */
  getCapabilities(): ExecutorCapabilities {
    return {
      supportsAsync: true,
      supportsRetry: true,
      supportsTimeout: true,
      maxConcurrency: 20,
      requiredPermissions: ['workflow:execute'],
    };
  }
}