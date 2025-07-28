/**
 * @file Monitor module entry point and implementation.
 * @module modules/core/monitor
 * @description Monitor module provides system monitoring and observability features.
 */

import { EventEmitter } from 'events';
import { type IModule, ModuleStatusEnum } from '@/modules/core/modules/types/index';
import { MetricService } from '@/modules/core/monitor/services/metric.service';
import type {
  HealthCheckResult,
  IMetricData,
  IMetricQuery,
  IMonitorModuleExports,
  MonitorModuleConfig,
  MonitorModuleDependencies,
  MonitorRepository
} from '@/modules/core/monitor/types/index';

/**
 * Mock repository implementation for monitor data.
 */
class MockMonitorRepository implements MonitorRepository {
  /**
   * Creates a new mock monitor repository.
   * @param _db - Database adapter instance (unused in mock implementation).
   */
  constructor(_db: unknown) {
    void _db;
  }

  /**
   * Records a metric data point.
   * @param data - Metric data to record.
   */
  async recordMetric(data: IMetricData): Promise<void> {
    void data;
    await Promise.resolve();
  }

  /**
   * Retrieves metrics based on query criteria.
   * @param query - Query parameters for filtering metrics.
   * @returns Array of metric data.
   */
  async getMetrics(query: IMetricQuery): Promise<IMetricData[]> {
    void query;
    return await Promise.resolve([]);
  }

  /**
   * Gets all available metric names.
   * @returns Array of metric names.
   */
  async getMetricNames(): Promise<string[]> {
    return await Promise.resolve(['cpu_usage', 'memory_usage', 'disk_usage']);
  }

  /**
   * Deletes metrics older than retention period.
   * @param retentionDays - Number of days to retain metrics.
   */
  async deleteOldMetrics(retentionDays: number): Promise<void> {
    void retentionDays;
    await Promise.resolve();
  }
}

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
  public readonly type = 'daemon';
  public status: ModuleStatusEnum = ModuleStatusEnum.PENDING;
  private moduleExports?: IMonitorModuleExports;
  private config?: MonitorModuleConfig;
  private deps?: MonitorModuleDependencies;
  private repository?: MonitorRepository;
  private metricService?: MetricService;
  private cleanupInterval?: NodeJS.Timeout | undefined;
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
      this.status = ModuleStatusEnum.INITIALIZING;

      if (context === undefined) {
        throw new Error('Monitor module requires initialization context');
      }

      const { config, deps } = context;
      this.config = config;
      this.deps = deps;

      const dbAdapter = deps.database.getAdapter('monitor');
      this.repository = new MockMonitorRepository(dbAdapter);

      this.metricService = new MetricService(
        this.repository,
        deps.logger,
        {
          metrics: {
            flushInterval: config.config.metrics.flushInterval,
            bufferSize: config.config.metrics.bufferSize ?? 1000,
            collectSystem: config.config.metrics.collectSystem ?? true
          }
        }
      );

      this.moduleExports = {
        MonitorService: this.metricService
      };

      this.status = ModuleStatusEnum.STOPPED;
      deps.logger.info('Monitor module initialized');
    } catch (error) {
      this.status = ModuleStatusEnum.ERROR;
      const errorInfo = this.getErrorInfo(error);
      this.deps?.logger.error('Failed to initialize Monitor module', errorInfo);
      throw error;
    }
  }

  /**
   * Starts the monitor module.
   */
  async start(): Promise<void> {
    try {
      if (this.status !== ModuleStatusEnum.STOPPED) {
        throw new Error(`Cannot start module in ${this.status} state`);
      }

      if (this.metricService === undefined || this.config === undefined) {
        throw new Error('Module not properly initialized');
      }

      this.status = ModuleStatusEnum.INITIALIZING;
      await this.metricService.initialize();

      this.cleanupInterval = setInterval(
        (): void => {
          this.performCleanup().catch((error: unknown) => {
            const errorInfo = error instanceof Error ? {
              message: error.message,
              ...error.stack && { stack: error.stack }
            } : { error };
            this.deps?.logger.error('Cleanup interval error', errorInfo);
          });
        },
        this.config.config.cleanup.interval
      );

      this.status = ModuleStatusEnum.RUNNING;
      this.deps?.logger.info('Monitor module started');
    } catch (error) {
      this.status = ModuleStatusEnum.ERROR;
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
      this.status = ModuleStatusEnum.STOPPING;

      if (this.cleanupInterval !== undefined) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      if (this.metricService !== undefined) {
        await this.metricService.shutdown();
      }

      this.status = ModuleStatusEnum.STOPPED;
      this.deps?.logger.info('Monitor module stopped');
    } catch (error) {
      this.status = ModuleStatusEnum.ERROR;
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
      if (this.status === ModuleStatusEnum.PENDING || this.deps === undefined) {
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
      const status = this.status === ModuleStatusEnum.RUNNING ? 'running' : 'stopped';

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
    status: ModuleStatusEnum;
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
   * Get error information from unknown error.
   * @param error - Unknown error.
   * @returns Error information object.
   */
  private getErrorInfo(error: unknown): { message: string; stack?: string } | { error: unknown } {
    return error instanceof Error ? {
      message: error.message,
      ...error.stack && { stack: error.stack }
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
