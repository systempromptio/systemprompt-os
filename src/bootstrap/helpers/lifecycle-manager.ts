/**
 * Module Lifecycle Manager for SystemPrompt OS.
 * Manages the lifecycle of modules including initialization, start, stop, and health checks.
 * @module bootstrap/helpers/lifecycle-manager
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export interface HealthStatus {
  healthy: boolean;
  message?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface ModuleLifecycleOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Manages module lifecycle operations with proper error handling and logging.
 */
export class ModuleLifecycleManager {
  private readonly logger = LoggerService.getInstance();
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly defaultRetryAttempts = 3;
  private readonly defaultRetryDelay = 1000; // 1 second

  /**
   * Initialize a module with retry logic.
   * @param module - The module to initialize
   * @param options - Lifecycle options
   */
  async initializeModule(
    module: IModule,
    options: ModuleLifecycleOptions = {}
  ): Promise<void> {
    const { retryAttempts = this.defaultRetryAttempts, retryDelay = this.defaultRetryDelay } = options;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        await this.executeWithTimeout(
          () => module.initialize(),
          options.timeout || this.defaultTimeout,
          `Module ${module.name} initialization`
        );

        this.logger.info(LogSource.BOOTSTRAP, `Module ${module.name} initialized successfully`, {
          attempt,
          category: 'lifecycle'
        });
        return;
      } catch (error) {
        this.logger.warn(LogSource.BOOTSTRAP, `Module ${module.name} initialization failed`, {
          attempt,
          maxAttempts: retryAttempts,
          error: error instanceof Error ? error.message : String(error),
          category: 'lifecycle'
        });

        if (attempt < retryAttempts) {
          await this.delay(retryDelay);
        } else {
          throw new Error(`Failed to initialize module ${module.name} after ${retryAttempts} attempts: ${error}`);
        }
      }
    }
  }

  /**
   * Start a module if it has a start method.
   * @param module - The module to start
   * @param options - Lifecycle options
   */
  async startModule(
    module: IModule,
    options: ModuleLifecycleOptions = {}
  ): Promise<void> {
    if (!module.start || typeof module.start !== 'function') {
      this.logger.debug(LogSource.BOOTSTRAP, `Module ${module.name} has no start method`, {
        category: 'lifecycle'
      });
      return;
    }

    try {
      await this.executeWithTimeout(
        () => module.start!(),
        options.timeout || this.defaultTimeout,
        `Module ${module.name} start`
      );

      this.logger.info(LogSource.BOOTSTRAP, `Module ${module.name} started successfully`, {
        category: 'lifecycle'
      });
    } catch (error) {
      throw new Error(`Failed to start module ${module.name}: ${error}`);
    }
  }

  /**
   * Stop a module if it has a stop method.
   * @param module - The module to stop
   * @param timeout - Timeout in milliseconds (default: 10 seconds)
   */
  async stopModule(module: IModule, timeout: number = 10000): Promise<void> {
    if (!module.stop || typeof module.stop !== 'function') {
      this.logger.debug(LogSource.BOOTSTRAP, `Module ${module.name} has no stop method`, {
        category: 'lifecycle'
      });
      return;
    }

    try {
      await this.executeWithTimeout(
        () => module.stop!(),
        timeout,
        `Module ${module.name} shutdown`
      );

      this.logger.info(LogSource.BOOTSTRAP, `Module ${module.name} stopped successfully`, {
        category: 'lifecycle'
      });
    } catch (error) {
      // Log but don't throw during shutdown
      this.logger.error(LogSource.BOOTSTRAP, `Module ${module.name} stop failed`, {
        error: error instanceof Error ? error.message : String(error),
        category: 'lifecycle'
      });
    }
  }

  /**
   * Check the health of a module.
   * @param module - The module to check
   * @returns Health status
   */
  async checkModuleHealth(module: IModule): Promise<HealthStatus> {
    if (!module.health || typeof module.health !== 'function') {
      return {
        healthy: true,
        message: 'Module has no health check'
      };
    }

    try {
      const health = await this.executeWithTimeout(
        () => module.health!(),
        5000, // 5 second timeout for health checks
        `Module ${module.name} health check`
      );

      return {
        healthy: health.status === 'healthy',
        message: health.message || undefined,
        details: health.checks
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check health of multiple modules in parallel.
   * @param modules - Map of modules to check
   * @returns Map of module health statuses
   */
  async checkAllModulesHealth(
    modules: Map<string, IModule>
  ): Promise<Map<string, HealthStatus>> {
    const healthChecks = new Map<string, HealthStatus>();

    const promises = Array.from(modules.entries()).map(async ([name, module]) => {
      const health = await this.checkModuleHealth(module);
      healthChecks.set(name, health);
    });

    await Promise.all(promises);
    return healthChecks;
  }

  /**
   * Execute a function with a timeout.
   * @param fn - Function to execute
   * @param timeout - Timeout in milliseconds
   * @param operation - Operation description for error messages
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    operation: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${operation} timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Delay execution for a specified time.
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}