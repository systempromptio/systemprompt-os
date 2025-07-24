import { Service, Inject } from 'typedi';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseEventExecutor } from './base.executor.js';
import {
  ExecutorType,
} from '../types/index.js';
import type {
  Event,
  EventExecution,
  ExecutionResult,
  ExecutorCapabilities,
  TaskConfiguration,
  RetryPolicy,
} from '../types/index.js';
import type { ILogger } from '../../logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';

const execAsync = promisify(exec);

/**
 * Command executor - executes shell commands (migrated from scheduler module)
 */
@Service()
export class CommandExecutor extends BaseEventExecutor {
  readonly type = ExecutorType.COMMAND;

  constructor(@Inject(TYPES.Logger) private readonly logger: ILogger) {
    super();
  }

  /**
   * Execute a command event
   * @param event Event to execute
   * @param execution Execution context
   * @returns Execution result
   */
  async execute(event: Event, execution: EventExecution): Promise<ExecutionResult> {
    try {
      const config = execution.context['task_config'] as TaskConfiguration;

      if (!config?.command) {
        throw new Error('Invalid command configuration');
      }

      const { command, args = [], env = {}, working_directory, timeout_ms = 30000 } = config;

      // Build the full command
      const fullCommand =
        args.length > 0 ? `${command} ${args.map((arg) => `"${arg}"`).join(' ')}` : command;

      // Execute the command
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: working_directory,
        env: { ...process.env, ...env },
        timeout: timeout_ms,
      });

      const duration = Date.now() - startTime;

      // Log the execution
      this.logger.info('Command executed successfully', {
        event_id: event.id,
        command: fullCommand,
        duration_ms: duration,
      });

      return this.success({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration_ms: duration,
        exit_code: 0,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout');
      const isPermission = errorMessage.includes('EACCES') || errorMessage.includes('permission');

      this.logger.error('Command execution failed', {
        error: errorMessage,
        event_id: event.id,
        is_timeout: isTimeout,
        is_permission: isPermission,
      });

      // Don't retry permission errors
      const shouldRetry = !isPermission && execution.retry_count < execution.max_retries;
      const retryPolicy = execution.context['retry_policy'] as RetryPolicy | undefined;

      return this.failure(
        errorMessage,
        shouldRetry,
        shouldRetry ? this.calculateRetryDelay(execution.retry_count, retryPolicy) : undefined,
      );
    }
  }

  /**
   * Type guard for TaskConfiguration
   * @param config Configuration to check
   * @returns True if config is TaskConfiguration
   */
  private isTaskConfiguration(config: unknown): config is TaskConfiguration {
    if (!config || typeof config !== 'object') {
      return false;
    }
    const c = config as Record<string, unknown>;
    return typeof c['command'] === 'string';
  }

  /**
   * Validate command configuration
   * @param config Configuration to validate
   * @returns True if valid
   */
  override async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    if (!this.isTaskConfiguration(config)) {
      return false;
    }

    const taskConfig = config;

    if (!taskConfig.command || typeof taskConfig.command !== 'string') {
      return false;
    }

    if (taskConfig.args && !Array.isArray(taskConfig.args)) {
      return false;
    }

    if (taskConfig.env && typeof taskConfig.env !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Get executor capabilities
   * @returns Executor capabilities
   */
  getCapabilities(): ExecutorCapabilities {
    return {
      supportsAsync: true,
      supportsRetry: true,
      supportsTimeout: true,
      maxConcurrency: 10, // Limit concurrent command executions
      requiredPermissions: ['command:execute'],
    };
  }
}
