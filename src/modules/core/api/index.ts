/**
 * @fileoverview API module for managing API keys and rate limiting
 * @module modules/core/api
 */

import { ApiKeyService } from './services/api-key-service.js';
import { RateLimitService } from './services/rate-limit-service.js';
import { ApiRepository } from './repositories/api-repository.js';

import type { ModuleInterface } from '../../../types/module.interface.js';

export class ApiModule implements ModuleInterface {
  name = 'api';
  version = '1.0.0';
  type = 'service' as const;
  dependencies = ['database', 'logger', 'auth'];

  private config: any;
  private logger: any;
  private apiKeyService?: ApiKeyService;
  private rateLimitService?: RateLimitService;
  private apiRepository?: ApiRepository;
  private database?: any;

  async initialize(config: any, deps: any): Promise<boolean> {
    this.config = config;
    this.logger = deps.logger;

    try {
      // Initialize database adapter
      this.database = deps.database.getAdapter('api');
      
      // Initialize repository and services
      this.apiRepository = new ApiRepository(this.database);
      this.rateLimitService = new RateLimitService(this.apiRepository, this.config, this.logger);
      this.apiKeyService = new ApiKeyService(
        this.apiRepository,
        this.rateLimitService,
        this.logger
      );

      this.logger?.info('API module initialized');
      return true;
    } catch (error) {
      this.logger?.error('Failed to initialize API module', { error });
      return false;
    }
  }

  async start(): Promise<boolean> {
    try {
      // Start rate limit cleanup interval
      if (this.rateLimitService && this.rateLimitService.startCleanup) {
        await this.rateLimitService.startCleanup();
      }
      
      this.logger?.info('API module started');
      return true;
    } catch (error) {
      this.logger?.error('Failed to start API module', { error });
      return false;
    }
  }

  async stop(): Promise<boolean> {
    try {
      // Stop rate limit cleanup
      if (this.rateLimitService && this.rateLimitService.stopCleanup) {
        await this.rateLimitService.stopCleanup();
      }
      
      this.logger?.info('API module stopped');
      return true;
    } catch (error) {
      this.logger?.error('Error stopping API module', { error });
      return false;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; checks: any }> {
    try {
      // Check database connection
      const dbHealthy = await this.database?.query('SELECT 1');
      
      const healthy = !!dbHealthy;
      
      return {
        healthy,
        checks: {
          services: healthy,
          database: healthy
        }
      };
    } catch (error) {
      return {
        healthy: false,
        checks: {
          services: false,
          database: false
        }
      };
    }
  }

  get exports() {
    return {
      ApiKeyService: this.apiKeyService,
      RateLimitService: this.rateLimitService,
      ApiRepository: this.apiRepository
    };
  }

  getInfo() {
    return {
      name: this.name,
      version: this.version,
      description: 'API key management and rate limiting',
      author: 'SystemPrompt OS Team'
    };
  }
}