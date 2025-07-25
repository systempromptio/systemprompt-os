/**
 * MCP module - Model Context Protocol integration for managing AI model contexts.
 * @file MCP module entry point.
 * @module modules/core/mcp
 */

import type { IModule, ModuleStatus } from '@/modules/core/modules/types/index';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Strongly typed exports interface for MCP module.
 */
export interface IMCPModuleExports {
  readonly service: () => MCPService;
}

/**
 * MCP module implementation.
 */
export class MCPModule implements IModule<IMCPModuleExports> {
  public readonly name = 'mcp';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Model Context Protocol integration for managing AI model contexts';
  public readonly dependencies = ['logger', 'database', 'modules'];
  public status: ModuleStatus = 'stopped' as ModuleStatus;
  private mcpService!: MCPService;
  private logger!: ILogger;
  private initialized = false;
  private started = false;

  get exports(): IMCPModuleExports {
    return {
      service: () => { return this.getService(); },
    };
  }

  /**
   * Initialize the MCP module.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('MCP module already initialized');
    }

    this.logger = LoggerService.getInstance();
    this.mcpService = MCPService.getInstance();

    try {
      await this.mcpService.initialize();
      this.initialized = true;
      this.logger.info(LogSource.MCP, 'MCP module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize MCP module: ${errorMessage}`);
    }
  }

  /**
   * Start the MCP module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('MCP module not initialized');
    }

    if (this.started) {
      throw new Error('MCP module already started');
    }

    this.status = 'running';
    this.started = true;
    this.logger.info(LogSource.MCP, 'MCP module started');
  }

  /**
   * Stop the MCP module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = 'stopped';
      this.started = false;
      this.logger.info(LogSource.MCP, 'MCP module stopped');
    }
  }

  /**
   * Health check for the MCP module.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return { healthy: false, message: 'MCP module not initialized' };
    }
    if (!this.started) {
      return { healthy: false, message: 'MCP module not started' };
    }
    return { healthy: true, message: 'MCP module is healthy' };
  }

  /**
   * Get the MCP service.
   */
  getService(): MCPService {
    if (!this.initialized) {
      throw new Error('MCP module not initialized');
    }
    return this.mcpService;
  }
}

/**
 * Factory function for creating the module.
 */
export const createModule = (): MCPModule => {
  return new MCPModule();
};

/**
 * Initialize function for core module pattern.
 */
export const initialize = async (): Promise<MCPModule> => {
  const mcpModule = new MCPModule();
  await mcpModule.initialize();
  return mcpModule;
};

/**
 * Re-export enums for convenience.
 */
export {
  MCPRoleEnum,
  MCPSessionStatusEnum
} from '@/modules/core/mcp/types/index';
