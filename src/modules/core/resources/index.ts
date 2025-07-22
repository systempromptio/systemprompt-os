/**
 * @fileoverview Resources module for MCP resource management
 * @module resources
 */

import { ResourceService } from './services/resource.service.js';
import { createModuleAdapter, type ModuleDatabaseAdapter } from '../database/adapters/module-adapter.js';
import type { 
  CreateResourceData, 
  UpdateResourceData,
  TemplateVariables
} from './types/index.js';

/**
 * Module interface definition for SystemPrompt OS
 */
export interface ModuleInterface {
  name: string;
  version: string;
  type: 'core' | 'service' | 'extension';
  initialize(context: { config?: any; logger?: any }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
  exports?: any;
}

/**
 * Module exports interface for the resources module
 */
export interface ResourcesModuleExports {
  listResources: () => ReturnType<ResourceService['listResources']>;
  getResource: (uri: string) => ReturnType<ResourceService['getResource']>;
  getResourcesByPattern: (pattern: string) => ReturnType<ResourceService['getResourcesByPattern']>;
  createResource: (data: CreateResourceData) => ReturnType<ResourceService['createResource']>;
  updateResource: (uri: string, data: UpdateResourceData) => ReturnType<ResourceService['updateResource']>;
  deleteResource: (uri: string) => ReturnType<ResourceService['deleteResource']>;
  processTemplateResource: (uri: string, variables: TemplateVariables) => ReturnType<ResourceService['processTemplateResource']>;
}

/**
 * Resources module implementation
 * Provides MCP resource management functionality with database persistence
 */
export class ResourcesModule implements ModuleInterface {
  readonly name = 'resources';
  readonly version = '1.0.0';
  readonly type = 'service' as const;
  
  private resourceService: ResourceService | null = null;
  private dbAdapter: ModuleDatabaseAdapter | null = null;
  private logger?: Console;
  
  /**
   * Initializes the resources module
   * @param context - Module initialization context
   * @param context.config - Module configuration
   * @param context.logger - Logger instance
   */
  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.logger = context.logger;
    
    try {
      this.dbAdapter = createModuleAdapter();
      this.resourceService = new ResourceService(this.dbAdapter);
      
      this.logger?.info('Resources module initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize resources module', error);
      throw error;
    }
  }
  
  /**
   * Starts the resources module
   */
  async start(): Promise<void> {
    this.logger?.info('Resources module started');
  }
  
  /**
   * Stops the resources module
   */
  async stop(): Promise<void> {
    this.logger?.info('Resources module stopped');
  }
  
  /**
   * Performs a health check on the module
   * @returns Health check result
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.resourceService) {
      return { 
        healthy: false, 
        message: 'Resource service not initialized' 
      };
    }
    
    try {
      await this.resourceService.listResources();
      return { 
        healthy: true, 
        message: 'Resources module is operational' 
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Health check failed: ${error}` 
      };
    }
  }
  
  /**
   * Gets the module exports
   * @returns Module exports object
   * @throws Error if the module is not initialized
   */
  get exports(): ResourcesModuleExports {
    if (!this.resourceService) {
      throw new Error('Resources module not initialized');
    }
    
    const service = this.resourceService;
    
    return {
      listResources: () => service.listResources(),
      getResource: (uri: string) => service.getResource(uri),
      getResourcesByPattern: (pattern: string) => service.getResourcesByPattern(pattern),
      createResource: (data: CreateResourceData) => service.createResource(data),
      updateResource: (uri: string, data: UpdateResourceData) => service.updateResource(uri, data),
      deleteResource: (uri: string) => service.deleteResource(uri),
      processTemplateResource: (uri: string, variables: TemplateVariables) => 
        service.processTemplateResource(uri, variables)
    };
  }
}