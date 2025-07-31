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
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

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
  private initialized = false;
  private started = false;
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
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Monitor module already initialized');
    }

    try {
      this.status = ModulesStatus.INITIALIZING;

      this.metricService = MetricService.getInstance();
      this.moduleExports = {
        MonitorService: this.metricService
      };

      this.status = ModulesStatus.STOPPED;
      this.initialized = true;
    } catch (error) {
      const errorInfo = this.getErrorInfo(error);
      const logger = LoggerService.getInstance();
      logger.warn(LogSource.MODULES, 'Monitor module initialization incomplete', errorInfo);

      this.metricService = MetricService.getInstance();
      this.moduleExports = {
        MonitorService: this.metricService
      };
      this.status = ModulesStatus.STOPPED;
      this.initialized = true;
    }
  }

  /**
   * Starts the monitor module.
   */
  async start(): Promise<void> {
    try {
      if (this.status === ModulesStatus.INITIALIZING) {
        while (this.status === ModulesStatus.INITIALIZING) {
          await new Promise(resolve => { return setTimeout(resolve, 10) });
        }
        if (this.status === ModulesStatus.RUNNING && this.started) {
          return;
        }
        if (this.status === ModulesStatus.ERROR) {
          throw new Error('Module failed to start during concurrent initialization');
        }
      }

      if (this.status !== ModulesStatus.STOPPED) {
        throw new Error(`Cannot start module in ${this.status} state`);
      }

      if (!this.initialized) {
        throw new Error('Module not initialized');
      }

      if (this.started) {
        return;
      }

      this.status = ModulesStatus.INITIALIZING;

      if (this.deps?.database) {
        try {
          const adapter = await this.deps.database.createModuleAdapter('monitor');
          if (adapter) {
            const repository = new MonitorRepositoryImpl(adapter as any);
            this.metricService!.setDependencies(
              repository,
              this.deps.logger,
              {
                metrics: {
                  flushInterval: this.config?.config.metrics.flushInterval || 60000,
                  bufferSize: this.config?.config.metrics.bufferSize || 1000,
                  collectSystem: this.config?.config.metrics.collectSystem || false
                }
              }
            );
          }
        } catch (error) {
          const logger = LoggerService.getInstance();
          logger.warn(LogSource.MODULES, 'Monitor module starting without database', { error: error instanceof Error ? error : new Error(String(error)) });
        }
      }

      this.metricService!.initialize();

      if (this.config?.config.cleanup.interval) {
        this.cleanupInterval = setInterval(
          (): void => {
            this.performCleanup().catch((error: unknown): void => {
              const errorInfo = error instanceof Error ? {
                message: error.message,
                ...error.stack !== null && error.stack !== undefined && error.stack !== '' && { stack: error.stack }
              } : { error };
              const logger = LoggerService.getInstance();
              logger.error(LogSource.MODULES, 'Cleanup interval error', errorInfo as any);
            });
          },
          this.config.config.cleanup.interval
        );
      }

      this.status = ModulesStatus.RUNNING;
      this.started = true;
      const logger = LoggerService.getInstance();
      logger.info(LogSource.MODULES, 'Monitor module started');
      await Promise.resolve();
    } catch (error) {
      this.status = ModulesStatus.STOPPED;
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
        this.cleanupInterval = undefined as any;
      }

      if (this.metricService !== undefined) {
        await this.metricService.shutdown();
      }

      this.status = ModulesStatus.STOPPED;
      this.started = false;
      const logger = LoggerService.getInstance();
      logger.info(LogSource.MODULES, 'Monitor module stopped');
    } catch (error) {
      this.status = ModulesStatus.ERROR;
      const errorInfo = this.getErrorInfo(error);
      const logger = LoggerService.getInstance();
      logger.error(LogSource.MODULES, 'Failed to stop Monitor module', errorInfo as any);
      throw error;
    }
  }

  /**
   * Performs a health check on the monitor module.
   * @returns Health check result.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      if (this.status === ModulesStatus.PENDING || !this.initialized) {
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

    if (this.deps !== undefined && this.deps.database !== undefined) {
      try {
        const adapter = await this.deps.database.createModuleAdapter('monitor');
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
    }

    return {
      healthy: databaseHealthy && serviceHealthy,
      databaseHealthy,
      serviceHealthy
    };
  }

  /**
   * Set module context after initialization.
   * This is called by the module system when dependencies are available.
   * @param config - Module configuration.
   * @param deps - Module dependencies.
   */
  setContext(config: MonitorModuleConfig, deps: MonitorModuleDependencies): void {
    this.config = config;
    this.deps = deps;
  }

  /**
   * Get error information from unknown error.
   * @param error - Unknown error.
   * @returns Error information object.
   */
  private getErrorInfo(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
      return {
        message: error.message,
        ...error.stack !== null && error.stack !== undefined && error.stack !== '' && { stack: error.stack }
      };
    }
    return { message: String(error) };
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
