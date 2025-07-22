/**
 * @fileoverview MCP (Model Context Protocol) module
 * @module modules/core/mcp
 */

import { join, resolve } from 'path';
import type { ModuleInterface } from '../../types.js';
import type { Logger } from '../../types.js';
import type { 
  MCPConfig, 
  MCPServerInfo, 
  MCPCapabilities,
  MCPStats,
  MCPContext,
  MCPExecutionResult
} from './types/index.js';
import { MCPService } from './services/mcp.service.js';
import { MCPRegistryService } from './services/registry.service.js';
import { MCPDiscoveryService } from './services/discovery.service.js';
import { MCPCacheService } from './services/cache.service.js';
import { MCPStatsService } from './services/stats.service.js';

export class MCPModule implements ModuleInterface {
  name = 'mcp';
  version = '1.0.0';
  type = 'core' as const;
  
  private config!: MCPConfig;
  private logger!: Logger;
  private mcpService!: MCPService;
  private registryService!: MCPRegistryService;
  private discoveryService!: MCPDiscoveryService;
  private cacheService!: MCPCacheService;
  private statsService!: MCPStatsService;
  private discoveryInterval?: NodeJS.Timeout;
  
  async initialize(context: { config?: any; logger?: Logger }): Promise<void> {
    this.logger = context.logger || console;
    this.config = this.buildConfig(context.config);
    
    // Initialize services
    this.cacheService = new MCPCacheService(this.config.cache, this.logger);
    this.statsService = new MCPStatsService(this.logger);
    this.registryService = new MCPRegistryService(this.logger);
    this.discoveryService = new MCPDiscoveryService(
      this.config.discovery,
      this.registryService,
      this.logger
    );
    this.mcpService = new MCPService(
      this.config,
      this.registryService,
      this.cacheService,
      this.statsService,
      this.logger
    );
    
    // Initialize database tables
    await this.initializeDatabase();
    
    this.logger.info('MCP module initialized', { version: this.version });
  }
  
  async start(): Promise<void> {
    // Run initial discovery
    await this.discoveryService.discover();
    
    // Start periodic discovery
    if (this.config.discovery.scanIntervalMs > 0) {
      this.discoveryInterval = setInterval(
        () => this.discoveryService.discover().catch(err => 
          this.logger.error('Discovery failed', err)
        ),
        this.config.discovery.scanIntervalMs
      );
    }
    
    // Initialize MCP servers if enabled
    if (this.config.servers.local.enabled || this.config.servers.remote.enabled) {
      await this.mcpService.startServers();
    }
    
    this.logger.info('MCP module started', {
      localServer: this.config.servers.local.enabled,
      remoteServer: this.config.servers.remote.enabled,
      discoveryInterval: this.config.discovery.scanIntervalMs
    });
  }
  
  async stop(): Promise<void> {
    // Stop discovery interval
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = undefined;
    }
    
    // Stop MCP servers
    await this.mcpService.stopServers();
    
    // Clear cache
    this.cacheService.clear();
    
    this.logger.info('MCP module stopped');
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const stats = await this.getStats();
      const registryHealth = this.registryService.getHealth();
      
      return {
        healthy: true,
        message: `MCP healthy. Tools: ${stats.tools.total}, Prompts: ${stats.prompts.total}, Resources: ${stats.resources.total}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `MCP unhealthy: ${error}`
      };
    }
  }
  
  // API methods
  
  async getServerInfo(): Promise<MCPServerInfo> {
    return {
      name: 'SystemPrompt OS MCP Server',
      version: this.version,
      protocolVersion: '0.1.0',
      capabilities: this.getCapabilities()
    };
  }
  
  async listTools(context?: MCPContext): Promise<any[]> {
    return this.mcpService.listTools(context);
  }
  
  async executeTool(
    name: string, 
    args: any, 
    context?: MCPContext
  ): Promise<MCPExecutionResult> {
    return this.mcpService.executeTool(name, args, context);
  }
  
  async listPrompts(context?: MCPContext): Promise<any[]> {
    return this.mcpService.listPrompts(context);
  }
  
  async getPrompt(
    name: string, 
    args?: Record<string, any>, 
    context?: MCPContext
  ): Promise<any> {
    return this.mcpService.getPrompt(name, args, context);
  }
  
  async listResources(context?: MCPContext): Promise<any[]> {
    return this.mcpService.listResources(context);
  }
  
  async readResource(
    uri: string, 
    context?: MCPContext
  ): Promise<any> {
    return this.mcpService.readResource(uri, context);
  }
  
  async subscribeResource(
    uri: string, 
    context?: MCPContext
  ): Promise<void> {
    return this.mcpService.subscribeResource(uri, context);
  }
  
  async getStats(): Promise<MCPStats> {
    return this.statsService.getStats();
  }
  
  // Utility methods
  
  async discover(): Promise<void> {
    await this.discoveryService.discover();
  }
  
  async clearCache(): Promise<void> {
    this.cacheService.clear();
  }
  
  getCacheStats(): any {
    return this.cacheService.getStats();
  }
  
  getRegistry(): MCPRegistryService {
    return this.registryService;
  }
  
  // CLI command
  
  async getCommand(): Promise<any> {
    const { createMCPCommand } = await import('./cli/index.js');
    return createMCPCommand(this);
  }
  
  // Private methods
  
  private buildConfig(contextConfig?: any): MCPConfig {
    return {
      servers: {
        local: {
          enabled: contextConfig?.servers?.local?.enabled !== false,
          stdio: contextConfig?.servers?.local?.stdio !== false
        },
        remote: {
          enabled: contextConfig?.servers?.remote?.enabled !== false,
          port: contextConfig?.servers?.remote?.port || 3001,
          host: contextConfig?.servers?.remote?.host || '0.0.0.0'
        }
      },
      discovery: {
        scanIntervalMs: contextConfig?.discovery?.scanIntervalMs || 60000,
        directories: contextConfig?.discovery?.directories || ['./src/modules']
      },
      security: {
        requireAuth: contextConfig?.security?.requireAuth !== false,
        defaultPermissions: contextConfig?.security?.defaultPermissions || ['mcp:read']
      },
      cache: {
        ttlSeconds: contextConfig?.cache?.ttlSeconds || 3600,
        maxEntries: contextConfig?.cache?.maxEntries || 1000
      }
    };
  }
  
  private getCapabilities(): MCPCapabilities {
    return {
      tools: true,
      prompts: true,
      resources: true,
      resourceTemplates: true,
      resourceSubscriptions: true,
      experimental: {
        middleware: true,
        streaming: true
      }
    };
  }
  
  private async initializeDatabase(): Promise<void> {
    try {
      const { DatabaseService } = await import('../database/services/database.service.js');
      const db = DatabaseService.getInstance();
      
      // Create MCP statistics table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS mcp_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          operation TEXT NOT NULL,
          success BOOLEAN NOT NULL,
          duration_ms INTEGER,
          error TEXT,
          context TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create MCP cache table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS mcp_cache (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_mcp_stats_type_name 
        ON mcp_stats(type, name)
      `);
      
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_mcp_stats_created_at 
        ON mcp_stats(created_at)
      `);
      
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_mcp_cache_expires_at 
        ON mcp_cache(expires_at)
      `);
      
      this.logger.info('MCP database tables initialized');
    } catch (error) {
      this.logger.error('Failed to initialize MCP database', error);
      throw error;
    }
  }
}

// Export for dynamic loading
export default MCPModule;