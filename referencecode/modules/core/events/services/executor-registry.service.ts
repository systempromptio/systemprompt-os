import { Service, Inject, Container } from 'typedi';
import type { IEventExecutor, ExecutorCapabilities } from '../types/index.js';
import type { ILogger } from '../../logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';

/**
 * Registry for event executors
 */
@Service()
export class ExecutorRegistry {
  private readonly executors: Map<string, IEventExecutor>;

  constructor(@Inject(TYPES.Logger) private readonly logger: ILogger) {
    this.executors = new Map();
    this.registerBuiltInExecutors();
  }

  /**
   * Register built-in executors
   */
  private async registerBuiltInExecutors(): Promise<void> {
    try {
      // Import and register built-in executors
      const { WebhookExecutor } = await import('../executors/webhook.executor.js');
      const { CommandExecutor } = await import('../executors/command.executor.js');
      const { WorkflowExecutor } = await import('../executors/workflow.executor.js');

      // Register executors
      this.registerExecutor(Container.get(WebhookExecutor));
      this.registerExecutor(Container.get(CommandExecutor));
      this.registerExecutor(Container.get(WorkflowExecutor));

      this.logger.info('Built-in executors registered', {
        executors: Array.from(this.executors.keys()),
      });
    } catch (error) {
      this.logger.error('Failed to register built-in executors', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Register an executor
   */
  registerExecutor(executor: IEventExecutor): void {
    if (this.executors.has(executor.type)) {
      this.logger.warn('Executor already registered', { type: executor.type });
      return;
    }

    this.executors.set(executor.type, executor);
    this.logger.info('Executor registered', {
      type: executor.type,
      capabilities: executor.getCapabilities(),
    });
  }

  /**
   * Unregister an executor
   */
  unregisterExecutor(type: string): void {
    if (this.executors.delete(type)) {
      this.logger.info('Executor unregistered', { type });
    }
  }

  /**
   * Get an executor by type
   */
  getExecutor(type: string): IEventExecutor | undefined {
    return this.executors.get(type);
  }

  /**
   * Get all registered executors
   */
  getAllExecutors(): Map<string, IEventExecutor> {
    return new Map(this.executors);
  }

  /**
   * Get executor types
   */
  getExecutorTypes(): string[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Get executor capabilities
   */
  getExecutorCapabilities(type: string): ExecutorCapabilities | null {
    const executor = this.executors.get(type);
    return executor ? executor.getCapabilities() : null;
  }

  /**
   * Check if executor supports a capability
   */
  supportsCapability(type: string, capability: keyof ExecutorCapabilities): boolean {
    const capabilities = this.getExecutorCapabilities(type);
    return capabilities ? Boolean(capabilities[capability]) : false;
  }

  /**
   * Find executors by capability
   */
  findExecutorsByCapability(capability: keyof ExecutorCapabilities): string[] {
    const matching: string[] = [];

    for (const [type, executor] of this.executors) {
      const capabilities = executor.getCapabilities();
      if (capabilities[capability]) {
        matching.push(type);
      }
    }

    return matching;
  }
}
