/**
 * Monitor module entry point and implementation.
 * Monitor module provides system monitoring and observability features.
 * @file Monitor module entry point and implementation.
 * @module modules/core/monitor
 */

import { EventEmitter } from 'events';
import {
 type IModule, ModulesStatus, ModulesType
} from '@/modules/core/modules/types/index';
import { MetricService } from '@/modules/core/monitor/services/metric.service';
import { MonitorRepositoryImpl } from '@/modules/core/monitor/repositories/monitor.repository';
import type {
  HealthCheckResult,
  IMonitorModuleExports,
  MonitorModuleConfig,
  MonitorModuleDependencies
} from '@/modules/core/monitor/types/index';
import type { IDatabaseAdapter } from '@/modules/core/database/types';

/**
 * Type guard to check if a module is a Monitor module.
 * @param mod - Module to check.
 * @returns True if module is a Monitor module.
 */
export const isMonitorModule = (mod: unknown): mod is IModule<IMonitorModuleExports> => {
  return mod !== null
         && mod !== undefined
         && typeof mod === 'object'
         && 'name' in mod
         && mod.name === 'monitor'
         && 'exports' in mod
         && Boolean(mod.exports)
         && typeof mod.exports === 'object'
         && mod.exports !== null
         && 'MonitorService' in mod.exports;
};

/**
 * Monitor module implementation provides system monitoring and observability features.
 */
export class MonitorModule extends EventEmitter implements IModule<IMonitorModuleExports> {
  public readonly name = 'monitor';
  public readonly version = '1.0.0';
  public readonly type = ModulesType.DAEMON;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private moduleExports?: IMonitorModuleExports;
  private config?: MonitorModuleConfig;
  private deps?: MonitorModuleDependencies;
  private metricService?: MetricService;
  private cleanupInterval?: NodeJS.Timeout;
  get exports(): IMonitorModuleExports {
    if (this.moduleExports === undefined) {
      throw new Error('Module not initialized');
    }
    return this.moduleExports;
  }

  /**
   * Initializes the monitor module.
   * @param context - Initialization context.
   * @param context.config - Module configuration.
   * @param context.deps - Module dependencies.
   */
  async initialize(
    context?: { config: MonitorModuleConfig; deps: MonitorModuleDependencies }
  ): Promise<void> {
    try {
      this.status = ModulesStatus.INITIALIZING;

      if (context === undefined) {
        throw new Error('Monitor module requires initialization context');
      }

      this.setupContext(context);
      this.initializeServices();
      this.finalizeInitialization();
      await Promise.resolve();
    } catch (error) {
      this.handleInitializationError(error);
      throw error;
    }
  }

  /**
   * Starts the monitor module.
   */
  async start(): Promise<void> {
    try {
      if (this.status !== ModulesStatus.STOPPED) {
        throw new Error(`Cannot start module in ${this.status} state`);
      }

      if (this.metricService === undefined || this.config === undefined) {
        throw new Error('Module not properly initialized');
      }

      this.status = ModulesStatus.INITIALIZING;

      const adapter = this.deps?.database.getAdapter('monitor');
      if (!adapter) {
        throw new Error('Database adapter not available');
      }

      this.metricService.initialize();

      this.cleanupInterval = setInterval(
        (): void => {
          this.performCleanup().catch((error: unknown): void => {
            const errorInfo = error instanceof Error ? {
              message: error.message,
              ...error.stack !== null && error.stack !== undefined && error.stack !== '' && { stack: error.stack }
            } : { error };
            this.deps?.logger.error('Cleanup interval error', errorInfo);
          });
        },
        this.config.config.cleanup.interval
      );

      this.status = ModulesStatus.RUNNING;
      this.deps?.logger.info('Monitor module started');
      await Promise.resolve();
    } catch (error) {
      this.status = ModulesStatus.ERROR;
      const errorInfo = this.getErrorInfo(error);
      this.deps?.logger.error('Failed to start Monitor module', errorInfo);
      throw error;
    }
  }

  /**
   * Stops the monitor module.
   */
  async stop(): Promise<void> {
    try {
      this.status = ModulesStatus.STOPPING;

      if (this.cleanupInterval !== undefined) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null as any;
      }

      if (this.metricService !== undefined) {
        await this.metricService.shutdown();
      }

      this.status = ModulesStatus.STOPPED;
      this.deps?.logger.info('Monitor module stopped');
    } catch (error) {
      this.status = ModulesStatus.ERROR;
      const errorInfo = this.getErrorInfo(error);
      this.deps?.logger.error('Failed to stop Monitor module', errorInfo);
      throw error;
    }
  }

  /**
   * Performs a health check on the monitor module.
   * @returns Health check result.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      if (this.status === ModulesStatus.PENDING || this.deps === undefined) {
        return {
          healthy: false,
          message: 'Module not initialized',
          checks: {
            database: false,
            service: false,
            status: 'not_initialized'
          }
        };
      }

      const healthResult = await this.checkHealth();
      const {
 healthy, databaseHealthy, serviceHealthy
} = healthResult;
      const status = this.status === ModulesStatus.RUNNING ? 'running' : 'stopped';

      return {
        healthy,
        message: status,
        checks: {
          database: databaseHealthy,
          service: serviceHealthy,
          status
        }
      };
    } catch {
      return {
        healthy: false,
        message: 'Health check failed',
        checks: {
          database: false,
          service: false,
          status: 'error'
        }
      };
    }
  }

  /**
   * Get module information.
   * @returns Module information object.
   */
  getInfo(): {
    name: string;
    version: string;
    type: string;
    status: ModulesStatus;
    description: string;
    author: string;
  } {
    return {
      name: this.name,
      version: this.version,
      type: this.type,
      status: this.status,
      description: 'System monitoring and observability',
      author: 'SystemPrompt OS Team'
    };
  }

  /**
   * Perform periodic cleanup of old metrics.
   */
  private async performCleanup(): Promise<void> {
    if (this.metricService === undefined || this.config === undefined) {
      return;
    }

    try {
      await this.metricService.cleanupOldMetrics(this.config.config.cleanup.retentionDays);
    } catch (error) {
      const errorInfo = this.getErrorInfo(error);
      this.deps?.logger.error('Failed to perform cleanup', errorInfo);
    }
  }

  /**
   * Check health of database and service.
   * @returns Health check results.
   */
  private async checkHealth(): Promise<{
    healthy: boolean;
    databaseHealthy: boolean;
    serviceHealthy: boolean;
  }> {
    let databaseHealthy = true;
    let serviceHealthy = true;

    try {
      if (this.deps === undefined) {
        throw new Error('Dependencies not available');
      }
      const adapter = this.deps.database.getAdapter('monitor');
      if (adapter !== null
          && adapter !== undefined
          && typeof adapter === 'object'
          && 'query' in adapter
          && typeof adapter.query === 'function') {
        await adapter.query('SELECT 1');
      }
    } catch {
      databaseHealthy = false;
      serviceHealthy = false;
    }

    return {
      healthy: databaseHealthy && serviceHealthy,
      databaseHealthy,
      serviceHealthy
    };
  }

  /**
   * Sets up the module context during initialization.
   * @param context - Initialization context containing config and dependencies.
   * @param context.config - Module configuration.
   * @param context.deps - Module dependencies.
   */
  private setupContext(
    context: { config: MonitorModuleConfig; deps: MonitorModuleDependencies }
  ): void {
    const { config, deps } = context;
    this.config = config;
    this.deps = deps;
  }

  /**
   * Initializes the repository and metric service.
   * @throws Error if context is not properly set up.
   */
  private initializeServices(): void {
    if (this.deps === undefined || this.config === undefined) {
      throw new Error('Context not properly set up');
    }

    const adapter = this.deps.database.getAdapter('monitor');
    const repository = new MonitorRepositoryImpl(adapter as IDatabaseAdapter);

    this.metricService = MetricService.getInstance();
    this.metricService.setDependencies(
      repository,
      this.deps.logger,
      {
        metrics: {
          flushInterval: this.config.config.metrics.flushInterval,
          bufferSize: this.config.config.metrics.bufferSize || 1000,
          collectSystem: this.config.config.metrics.collectSystem || false
        }
      }
    );
  }

  /**
   * Finalizes the initialization process.
   * @throws Error if services are not properly initialized.
   */
  private finalizeInitialization(): void {
    if (this.metricService === undefined || this.deps === undefined) {
      throw new Error('Services not properly initialized');
    }

    this.moduleExports = {
      MonitorService: this.metricService
    };

    this.status = ModulesStatus.STOPPED;
    this.deps.logger.info('Monitor module initialized');
  }

  /**
   * Handles initialization errors.
   * @param error - The error that occurred during initialization.
   */
  private handleInitializationError(error: unknown): void {
    this.status = ModulesStatus.ERROR;
    const errorInfo = this.getErrorInfo(error);
    this.deps?.logger.error('Failed to initialize Monitor module', errorInfo);
  }

  /**
   * Get error information from unknown error.
   * @param error - Unknown error.
   * @returns Error information object.
   */
  private getErrorInfo(error: unknown): { message: string; stack?: string } | { error: unknown } {
    return error instanceof Error ? {
      message: error.message,
      ...error.stack !== null && error.stack !== undefined && error.stack !== '' && { stack: error.stack }
    } : { error };
  }
}

/**
 * Factory function for creating the module.
 * @returns Monitor module instance.
 */
export const createModule = (): MonitorModule => {
  return new MonitorModule();
};

/**
 * Initialize function for core module pattern.
 * @returns Initialized monitor module.
 */
export const initialize = async (): Promise<MonitorModule> => {
  const monitorModule = new MonitorModule();
  await monitorModule.initialize();
  return monitorModule;
};

/**
 * Gets the Monitor module with type safety and validation.
 * This should only be used after bootstrap when the module loader is available.
 * @returns The Monitor module with guaranteed typed exports.
 * @throws {Error} If Monitor module is not available or missing required exports.
 */
export function getMonitorModule(): IModule<IMonitorModuleExports> {
  const { getModuleRegistry } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/module-names.types');

  const registry = getModuleRegistry();
  const monitorModule = registry.get(ModuleName.MONITOR);

  if (!monitorModule.exports?.MonitorService) {
    throw new Error('Monitor module missing required MonitorService export');
  }

  return monitorModule as IModule<IMonitorModuleExports>;
}
