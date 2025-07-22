/**
 * @fileoverview Scheduler module for managing scheduled tasks and cron jobs
 * @module modules/core/scheduler
 */

import { SchedulerService } from './services/scheduler-service.js';
import { SchedulerRepository } from './repositories/scheduler-repository.js';
import { CronEngine } from './services/cron-engine.js';
import { createModuleAdapter } from '../database/adapters/module-adapter.js';

export interface ModuleInterface {
  name: string;
  version: string;
  type: 'service' | 'daemon' | 'plugin' | 'core' | 'extension';
  dependencies?: string[];
  exports?: any;
  initialize(context: { config?: any; logger?: any }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

export class SchedulerModule implements ModuleInterface {
  name = 'scheduler';
  version = '1.0.0';
  type = 'daemon' as const;
  dependencies = ['database', 'logger'];

  private config: any;
  private logger: any;
  private schedulerService?: SchedulerService;
  private schedulerRepository?: SchedulerRepository;
  private cronEngine?: CronEngine;
  private database?: any;

  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.config = context.config || {};
    this.logger = context.logger;

    try {
      // Initialize database adapter
      this.database = await createModuleAdapter('scheduler');
      
      // Initialize repository, engine and service
      this.schedulerRepository = new SchedulerRepository(this.database);
      this.cronEngine = new CronEngine(this.schedulerRepository, this.logger);
      this.schedulerService = new SchedulerService(
        this.schedulerRepository, 
        this.cronEngine,
        this.logger
      );

      this.logger?.info('Scheduler module initialized', { module: this.name });
    } catch (error) {
      this.logger?.error('Failed to initialize scheduler module', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      // Start cron engine
      await this.cronEngine?.start();
      
      // Load and activate all scheduled tasks
      await this.schedulerService?.loadScheduledTasks();
      
      this.logger?.info('Scheduler module started', { module: this.name });
    } catch (error) {
      this.logger?.error('Failed to start scheduler module', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop all scheduled tasks
      await this.schedulerService?.stopAllTasks();
      
      // Stop cron engine
      await this.cronEngine?.stop();
      
      this.logger?.info('Scheduler module stopped', { module: this.name });
    } catch (error) {
      this.logger?.error('Error stopping scheduler module', { error });
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check database connection
      const dbHealthy = await this.database?.query('SELECT 1');
      
      // Check engine health
      const engineHealthy = this.cronEngine?.isHealthy() ?? false;

      const healthy = !!dbHealthy && engineHealthy;
      
      return {
        healthy,
        message: healthy ? 'Scheduler module is healthy' : 'Scheduler module health check failed'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  get exports() {
    return {
      SchedulerService: this.schedulerService,
      SchedulerRepository: this.schedulerRepository,
      CronEngine: this.cronEngine
    };
  }
}