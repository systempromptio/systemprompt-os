/**
 * @fileoverview Prompts module for MCP prompt management
 * @module prompts
 */

import { PromptService } from './services/prompt.service.js';
import { createModuleAdapter, type ModuleDatabaseAdapter } from '../database/adapters/module-adapter.js';
import type { 
  CreatePromptData, 
  UpdatePromptData 
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
 * Module exports interface for the prompts module
 */
export interface PromptsModuleExports {
  listPrompts: () => ReturnType<PromptService['listPrompts']>;
  getPrompt: (name: string) => ReturnType<PromptService['getPrompt']>;
  createPrompt: (data: CreatePromptData) => ReturnType<PromptService['createPrompt']>;
  updatePrompt: (name: string, data: UpdatePromptData) => ReturnType<PromptService['updatePrompt']>;
  deletePrompt: (name: string) => ReturnType<PromptService['deletePrompt']>;
}

/**
 * Prompts module implementation
 * Provides MCP prompt management functionality with database persistence
 */
export class PromptsModule implements ModuleInterface {
  readonly name = 'prompts';
  readonly version = '1.0.0';
  readonly type = 'service' as const;
  
  private promptService: PromptService | null = null;
  private dbAdapter: ModuleDatabaseAdapter | null = null;
  private logger?: Console;
  
  /**
   * Initializes the prompts module
   * @param context - Module initialization context
   * @param context.config - Module configuration
   * @param context.logger - Logger instance
   */
  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.logger = context.logger;
    
    try {
      this.dbAdapter = createModuleAdapter();
      this.promptService = new PromptService(this.dbAdapter);
      
      this.logger?.info('Prompts module initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize prompts module', error);
      throw error;
    }
  }
  
  /**
   * Starts the prompts module
   */
  async start(): Promise<void> {
    this.logger?.info('Prompts module started');
  }
  
  /**
   * Stops the prompts module
   */
  async stop(): Promise<void> {
    this.logger?.info('Prompts module stopped');
  }
  
  /**
   * Performs a health check on the module
   * @returns Health check result
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.promptService) {
      return { 
        healthy: false, 
        message: 'Prompt service not initialized' 
      };
    }
    
    try {
      await this.promptService.listPrompts();
      return { 
        healthy: true, 
        message: 'Prompts module is operational' 
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
  get exports(): PromptsModuleExports {
    if (!this.promptService) {
      throw new Error('Prompts module not initialized');
    }
    
    const service = this.promptService;
    
    return {
      listPrompts: () => service.listPrompts(),
      getPrompt: (name: string) => service.getPrompt(name),
      createPrompt: (data: CreatePromptData) => service.createPrompt(data),
      updatePrompt: (name: string, data: UpdatePromptData) => service.updatePrompt(name, data),
      deletePrompt: (name: string) => service.deletePrompt(name)
    };
  }
}