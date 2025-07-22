/**
 * @fileoverview Tools module for MCP tool management
 * @module tools
 */

import { ToolService } from './services/tool.service.js';
import { createModuleAdapter, type ModuleDatabaseAdapter } from '../database/adapters/module-adapter.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ToolFilterOptions, ToolContext } from './types/index.js';

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
 * Module exports interface for the tools module
 */
export interface ToolsModuleExports {
  listTools: () => ReturnType<ToolService['listTools']>;
  getToolsByScope: (scope: 'remote' | 'local') => ReturnType<ToolService['getToolsByScope']>;
  getEnabledToolsByScope: (scope: 'remote' | 'local') => ReturnType<ToolService['getEnabledToolsByScope']>;
  getToolsWithFilters: (filters: ToolFilterOptions) => ReturnType<ToolService['getToolsWithFilters']>;
  getTool: (name: string) => ReturnType<ToolService['getTool']>;
  enableTool: (name: string) => ReturnType<ToolService['enableTool']>;
  disableTool: (name: string) => ReturnType<ToolService['disableTool']>;
  refreshTools: (force?: boolean) => ReturnType<ToolService['refreshTools']>;
  executeTool: (name: string, params: any, context?: Partial<ToolContext>) => ReturnType<ToolService['executeTool']>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Tools module implementation
 * Provides MCP tool management functionality with database persistence and scope control
 */
export class ToolsModule implements ModuleInterface {
  readonly name = 'tools';
  readonly version = '1.0.0';
  readonly type = 'service' as const;
  
  private toolService: ToolService | null = null;
  private dbAdapter: ModuleDatabaseAdapter | null = null;
  private logger?: Console;
  private baseModulesDir?: string;
  
  /**
   * Initializes the tools module
   * @param context - Module initialization context
   * @param context.config - Module configuration
   * @param context.logger - Logger instance
   */
  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.logger = context.logger;
    
    try {
      this.dbAdapter = createModuleAdapter();
      
      // Determine base modules directory
      this.baseModulesDir = process.env.NODE_ENV === 'production'
        ? '/app/build/modules'
        : join(__dirname, '../..');
      
      this.toolService = new ToolService(this.dbAdapter, this.baseModulesDir);
      
      this.logger?.info('Tools module initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize tools module', error);
      throw error;
    }
  }
  
  /**
   * Starts the tools module
   */
  async start(): Promise<void> {
    this.logger?.info('Tools module started');
    
    try {
      // Perform initial tool discovery
      const result = await this.toolService?.refreshTools();
      this.logger?.info('Initial tool discovery completed', result);
    } catch (error) {
      this.logger?.error('Error during initial tool discovery', error);
    }
  }
  
  /**
   * Stops the tools module
   */
  async stop(): Promise<void> {
    this.toolService?.clearHandlerCache();
    this.logger?.info('Tools module stopped');
  }
  
  /**
   * Performs a health check on the module
   * @returns Health check result
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.toolService) {
      return { 
        healthy: false, 
        message: 'Tool service not initialized' 
      };
    }
    
    try {
      await this.toolService.listTools();
      return { 
        healthy: true, 
        message: 'Tools module is operational' 
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
  get exports(): ToolsModuleExports {
    if (!this.toolService) {
      throw new Error('Tools module not initialized');
    }
    
    const service = this.toolService;
    
    return {
      listTools: () => service.listTools(),
      getToolsByScope: (scope: 'remote' | 'local') => service.getToolsByScope(scope),
      getEnabledToolsByScope: (scope: 'remote' | 'local') => service.getEnabledToolsByScope(scope),
      getToolsWithFilters: (filters: ToolFilterOptions) => service.getToolsWithFilters(filters),
      getTool: (name: string) => service.getTool(name),
      enableTool: (name: string) => service.enableTool(name),
      disableTool: (name: string) => service.disableTool(name),
      refreshTools: (force?: boolean) => service.refreshTools(force),
      executeTool: (name: string, params: any, context?: Partial<ToolContext>) => 
        service.executeTool(name, params, context)
    };
  }
}