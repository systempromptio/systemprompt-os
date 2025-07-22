/**
 * @fileoverview Workflows module for managing workflow definitions and executions
 * @module modules/core/workflows
 */

import { WorkflowService } from './services/workflow-service.js';
import { WorkflowRepository } from './repositories/workflow-repository.js';
import { WorkflowEngine } from './services/workflow-engine.js';
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

export class WorkflowsModule implements ModuleInterface {
  name = 'workflows';
  version = '1.0.0';
  type = 'service' as const;
  dependencies = ['database', 'logger', 'agents'];

  private config: any;
  private logger: any;
  private workflowService?: WorkflowService;
  private workflowRepository?: WorkflowRepository;
  private workflowEngine?: WorkflowEngine;
  private database?: any;

  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.config = context.config || {};
    this.logger = context.logger;

    try {
      // Initialize database adapter
      this.database = await createModuleAdapter('workflows');
      
      // Initialize repository, engine and service
      this.workflowRepository = new WorkflowRepository(this.database);
      this.workflowEngine = new WorkflowEngine(this.workflowRepository, this.logger);
      this.workflowService = new WorkflowService(
        this.workflowRepository, 
        this.workflowEngine,
        this.logger
      );

      this.logger?.info('Workflows module initialized', { module: this.name });
    } catch (error) {
      this.logger?.error('Failed to initialize workflows module', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      // Start workflow engine
      await this.workflowEngine?.start();
      this.logger?.info('Workflows module started', { module: this.name });
    } catch (error) {
      this.logger?.error('Failed to start workflows module', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop workflow engine
      await this.workflowEngine?.stop();
      this.logger?.info('Workflows module stopped', { module: this.name });
    } catch (error) {
      this.logger?.error('Error stopping workflows module', { error });
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check database connection
      const dbHealthy = await this.database?.query('SELECT 1');
      
      // Check engine health
      const engineHealthy = this.workflowEngine?.isHealthy() ?? false;

      const healthy = !!dbHealthy && engineHealthy;
      
      return {
        healthy,
        message: healthy ? 'Workflows module is healthy' : 'Workflows module health check failed'
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
      WorkflowService: this.workflowService,
      WorkflowRepository: this.workflowRepository,
      WorkflowEngine: this.workflowEngine
    };
  }
}