/**
 * @fileoverview Agents module for managing autonomous agents
 * @module modules/core/agents
 */

import { AgentService } from './services/agent-service.js';
import { AgentRepository } from './repositories/agent-repository.js';
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

export class AgentsModule implements ModuleInterface {
  name = 'agents';
  version = '1.0.0';
  type = 'service' as const;
  dependencies = ['database', 'logger', 'auth'];

  private config: any;
  private logger: any;
  private agentService?: AgentService;
  private agentRepository?: AgentRepository;
  private database?: any;

  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.config = context.config || {};
    this.logger = context.logger;

    try {
      // Initialize database adapter
      this.database = await createModuleAdapter('agents');
      
      // Initialize repository and service
      this.agentRepository = new AgentRepository(this.database);
      this.agentService = new AgentService(this.agentRepository, this.logger);

      this.logger?.info('Agents module initialized', { module: this.name });
    } catch (error) {
      this.logger?.error('Failed to initialize agents module', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      // Start any background services
      await this.agentService?.startMonitoring();
      this.logger?.info('Agents module started', { module: this.name });
    } catch (error) {
      this.logger?.error('Failed to start agents module', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop monitoring and cleanup
      await this.agentService?.stopMonitoring();
      this.logger?.info('Agents module stopped', { module: this.name });
    } catch (error) {
      this.logger?.error('Error stopping agents module', { error });
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check database connection
      const dbHealthy = await this.database?.query('SELECT 1');
      
      // Check service health
      const serviceHealthy = this.agentService?.isHealthy() ?? false;

      const healthy = !!dbHealthy && serviceHealthy;
      
      return {
        healthy,
        message: healthy ? 'Agents module is healthy' : 'Agents module health check failed'
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
      AgentService: this.agentService,
      AgentRepository: this.agentRepository
    };
  }
}