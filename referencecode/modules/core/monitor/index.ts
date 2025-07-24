/**
 * @fileoverview Monitor module for system observability
 * @module modules/core/monitor
 */

import { Service, Inject } from 'typedi';
import type { GlobalConfiguration } from '@/modules/core/config/types/index.js';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { IDatabaseService } from '@/modules/core/database/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { MonitorService } from './services/monitor-service.js';
import { MonitorRepository } from './repositories/monitor-repository.js';
// import { registerMonitorCommands } from './cli/index.js';

@Service()
export class MonitorModule implements IModule {
  name = 'monitor';
  version = '1.0.0';
  type = 'daemon' as const;
  status = ModuleStatus.STOPPED;
  dependencies = ['database', 'logger'];

  private config: any;
  private monitorService?: MonitorService;
  private repository?: MonitorRepository;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject(TYPES.Database) private readonly database: IDatabaseService,
    @Inject(TYPES.Config) private readonly globalConfig: GlobalConfiguration,
  ) {}

  async initialize(): Promise<void> {
    this.config = this.globalConfig?.modules?.[monitor] || {};

    try {
      // Initialize repository and service
      this.repository = new MonitorRepository(this.database);
      this.monitorService = new MonitorService(this.repository, this.logger, this.config);

      await this.monitorService.initialize();

      // CLI commands are handled by the CLI module

      this.logger.info('Monitor module initialized');
    } catch (error) {
      this.logger.error('Failed to initialize monitor module', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      // Start cleanup interval
      const cleanupInterval = this.config?.cleanup?.interval || 86400000; // 24 hours

      this.cleanupInterval = setInterval(async () => {
        try {
          await this.monitorService?.runCleanup();
        } catch (error) {
          this.logger?.error('Monitor cleanup failed', { error });
        }
      }, cleanupInterval);

      // Record startup metric
      this.monitorService?.incrementCounter('monitor.startup', { module: 'monitor' });

      this.logger?.info('Monitor module started');
    } catch (error) {
      this.logger?.error('Failed to start monitor module', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      // Shutdown service
      if (this.monitorService) {
        await this.monitorService.shutdown();
      }

      this.logger?.info('Monitor module stopped');
    } catch (error) {
      this.logger?.error('Error stopping monitor module', { error });
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check database connection
      const dbHealthy = await this.database?.get('SELECT 1 as healthy');

      // Check service status
      const status = await this.monitorService?.getStatus();

      const healthy = !!dbHealthy && !!status;

      return {
        healthy,
        message: healthy ? 'Monitor module is healthy' : 'Monitor module has issues',
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  get exports() {
    return {
      MonitorService: this.monitorService,
      // Convenience methods
      recordMetric:
        this.monitorService?.recordMetric
          ? this.monitorService.recordMetric.bind(this.monitorService)
          : undefined,
      incrementCounter:
        this.monitorService?.incrementCounter
          ? this.monitorService.incrementCounter.bind(this.monitorService)
          : undefined,
      setGauge:
        this.monitorService?.setGauge
          ? this.monitorService.setGauge.bind(this.monitorService)
          : undefined,
      recordHistogram:
        this.monitorService?.recordHistogram
          ? this.monitorService.recordHistogram.bind(this.monitorService)
          : undefined,
      startSpan:
        this.monitorService?.startSpan
          ? this.monitorService.startSpan.bind(this.monitorService)
          : undefined,
      endSpan:
        this.monitorService?.endSpan
          ? this.monitorService.endSpan.bind(this.monitorService)
          : undefined,
      traced:
        this.monitorService?.traced
          ? this.monitorService.traced.bind(this.monitorService)
          : undefined,
    };
  }

  getInfo() {
    return {
      name: this.name,
      version: this.version,
      description: 'System monitoring and observability',
      author: 'SystemPrompt OS Team',
    };
  }
}
