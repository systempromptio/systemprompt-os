/**
 * @file Monitor module implementation for system monitoring and observability.
 * @module modules/core/monitor
 */

import { EventEmitter } from 'events';
import type { IModule } from '@/modules/core/modules/types/index';
import { ModuleStatusEnum } from '@/modules/core/modules/types/index';
import { MetricService } from '@/modules/core/monitor/services/metric-service';
import type { MonitorRepository } from '@/modules/core/monitor/repositories/monitor-repository';

interface MonitorModuleConfig {
  name: string;
  type: string;
  version: string;
  config: {
    metrics: {
      enabled: boolean;
      flushInterval: number;
      bufferSize?: number;
      collectSystem?: boolean;
    };
    alerts: {
      enabled: boolean;
      evaluationInterval: number;
    };
    traces: {
      enabled: boolean;
      sampling: number;
    };
    cleanup: {
      interval: number;
      retentionDays: number;
    };
  };
}

interface MonitorModuleDependencies {
  logger: {
    info: (message: string) => void;
    error: (message: string, data?: any) => void;
    warn: (message: string) => void;
    debug: (message: string) => void;
  };
  database: {
    getAdapter: (name: string) => any;
  };
}

interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  checks?: {
    database: boolean;
    service: boolean;
    status: string;
  };
}

/**
 * Mock repository implementation for monitor data.
 */
class MockMonitorRepository implements MonitorRepository {
  constructor(private readonly db: any) {
    void this.db
  }

  async recordMetric(data: any): Promise<void> {
    void data
    await Promise.resolve();
  }

  async getMetrics(query: any): Promise<any[]> {
    void query
    return await Promise.resolve([]);
  }

  async getMetricNames(): Promise<string[]> {
    return await Promise.resolve(['cpu_usage', 'memory_usage', 'disk_usage']);
  }

  async deleteOldMetrics(retentionDays: number): Promise<void> {
    void retentionDays
    await Promise.resolve();
  }
}

/**
 * Strongly typed exports interface for Monitor module.
 */
export interface IMonitorModuleExports {
  readonly MonitorService: MetricService;
}

/**
 * Type guard to check if a module is a Monitor module.
 * @param module - Module to check.
 * @returns True if module is a Monitor module.
 */
export function isMonitorModule(module: any): module is IModule<IMonitorModuleExports> {
  return module?.name === 'monitor'
         && Boolean(module.exports)
         && typeof module.exports === 'object'
         && 'MonitorService' in module.exports;
}

export class MonitorModule extends EventEmitter implements IModule<IMonitorModuleExports> {
  public readonly name = 'monitor';
  public readonly version = '1.0.0';
  public readonly type = 'daemon';
  public status: ModuleStatusEnum = ModuleStatusEnum.PENDING;
  private config?: MonitorModuleConfig;
  private deps?: MonitorModuleDependencies;
  private repository?: MonitorRepository;
  private metricService?: MetricService;
  private cleanupInterval?: NodeJS.Timeout;
  public exports!: IMonitorModuleExports;

  constructor() {
    super();
  }

  async initialize(context?: { config: MonitorModuleConfig; deps: MonitorModuleDependencies }): Promise<void> {
    try {
      this.status = ModuleStatusEnum.INITIALIZING;

      if (!context) {
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
            bufferSize: config.config.metrics.bufferSize || 1000,
            collectSystem: config.config.metrics.collectSystem || true
          }
        }
      );

      this.exports = {
        MonitorService: this.metricService
      };

      this.status = ModuleStatusEnum.STOPPED;
      deps.logger.info('Monitor module initialized');
    } catch (error) {
      this.status = ModuleStatusEnum.ERROR;
      this.deps?.logger.error('Failed to initialize Monitor module', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      if (this.status !== ModuleStatusEnum.STOPPED) {
        throw new Error(`Cannot start module in ${this.status} state`);
      }

      if (!this.metricService || !this.config) {
        throw new Error('Module not properly initialized');
      }

      this.status = ModuleStatusEnum.INITIALIZING;
      await this.metricService.initialize();

      this.cleanupInterval = setInterval(
        async () => { await this.performCleanup(); },
        this.config.config.cleanup.interval
      );

      this.status = ModuleStatusEnum.RUNNING;
      this.deps?.logger.info('Monitor module started');
    } catch (error) {
      this.status = ModuleStatusEnum.ERROR;
      this.deps?.logger.error('Failed to start Monitor module', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.status = ModuleStatusEnum.STOPPING;

      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined as any;
      }

      if (this.metricService) {
        await this.metricService.shutdown();
      }

      this.status = ModuleStatusEnum.STOPPED;
      this.deps?.logger.info('Monitor module stopped');
    } catch (error) {
      this.status = ModuleStatusEnum.ERROR;
      this.deps?.logger.error('Failed to stop Monitor module', error);
      throw error;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      if (this.status === ModuleStatusEnum.PENDING || !this.deps) {
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

      let databaseHealthy = true;
      let serviceHealthy = true;

      try {
        const adapter = this.deps.database.getAdapter('monitor');
        await adapter.query('SELECT 1');
      } catch (error) {
        databaseHealthy = false;
        serviceHealthy = false;
      }

      const status = this.status === ModuleStatusEnum.RUNNING ? 'running' : 'stopped';

      return {
        healthy: databaseHealthy && serviceHealthy,
        message: status,
        checks: {
          database: databaseHealthy,
          service: serviceHealthy,
          status
        }
      };
    } catch (error) {
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
   */
  getInfo() {
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
    if (!this.metricService || !this.config) {
      return;
    }

    try {
      await this.metricService.cleanupOldMetrics(this.config.config.cleanup.retentionDays);
    } catch (error) {
      this.deps?.logger.error('Failed to perform cleanup', error);
    }
  }
}
