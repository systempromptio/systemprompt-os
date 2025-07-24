/**
 * @fileoverview Main MCP service for coordinating tools, prompts, and resources
 * @module modules/core/mcp/services
 */

import type { Logger } from '../../../types.js';
import type {
  MCPConfig,
  MCPContext,
  MCPExecutionResult,
  MCPPromptRow,
  MCPPromptDetailRow,
  MCPResourceRow,
} from '../types/index.js';
import type { MCPRegistryService } from './registry.service.js';
import type { MCPCacheService } from './cache.service.js';
import type { MCPStatsService } from './stats.service.js';
import type { IDatabaseService } from '@/modules/core/database/types/index.js';
// Services from consolidated modules are now handled internally

export class MCPService {
  // Services are now handled internally within MCP module
  private readonly servers: Map<string, any> = new Map();
  private readonly databaseService?: IDatabaseService;

  constructor(
    private readonly config: MCPConfig,
    private readonly registryService: MCPRegistryService,
    private readonly cacheService: MCPCacheService,
    private readonly statsService: MCPStatsService,
    private readonly logger: Logger,
    databaseService?: IDatabaseService,
  ) {
    this.databaseService = databaseService;
  }

  async startServers(): Promise<void> {
    // MCP now handles tools, prompts, and resources internally
    this.logger.info('MCP service starting servers');

    // Start local server if enabled
    if (this.config.servers.local.enabled) {
      try {
        const { createLocalServer } = await import('../servers/local.server.js');
        const localServer = await createLocalServer(this, this.config, this.logger);
        this.servers.set('local', localServer);
        this.logger.info('Local MCP server started');
      } catch (error) {
        this.logger.error('Failed to start local MCP server', error);
      }
    }

    // Start remote server if enabled
    if (this.config.servers.remote.enabled) {
      try {
        const { createRemoteServer } = await import('../servers/remote.server.js');
        const remoteServer = await createRemoteServer(this, this.config, this.logger);
        this.servers.set('remote', remoteServer);
        this.logger.info('Remote MCP server started', {
          host: this.config.servers.remote.host,
          port: this.config.servers.remote.port,
        });
      } catch (error) {
        this.logger.error('Failed to start remote MCP server', error);
      }
    }
  }

  async stopServers(): Promise<void> {
    for (const [name, server] of this.servers) {
      try {
        if (server.stop) {
          await server.stop();
        }
        this.logger.info(`${name} MCP server stopped`);
      } catch (error) {
        this.logger.error(`Failed to stop ${name} MCP server`, error);
      }
    }
    this.servers.clear();
  }

  async listTools(context?: MCPContext): Promise<any[]> {
    const cacheKey = `tools:list:${context?.userId || 'anonymous'}`;

    // Check cache
    const cached = this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get tools from registry only
      const tools = Array.from(this.registryService.getTools().values());

      // TODO: Implement permission filtering when permissions service is available
      // For now, return all tools

      // Cache result
      this.cacheService.set(cacheKey, tools);

      return tools;
    } catch (error) {
      this.logger.error('Failed to list tools', error);
      throw error;
    }
  }

  async executeTool(name: string, args: any, context?: MCPContext): Promise<MCPExecutionResult> {
    const startTime = Date.now();

    try {
      // TODO: Implement permission checking when permissions service is available
      // For now, skip permission checks

      // Get tool from registry
      const tool = this.registryService.getTool(name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Validate arguments
      if (tool.inputSchema) {
        this.validateArguments(args, tool.inputSchema);
      }

      // Execute tool
      let result: any;
      if (typeof tool.handler === 'function') {
        result = await tool.handler(args, context || this.createDefaultContext());
      } else if (typeof tool.handler === 'string') {
        // TODO: Implement tool execution through a tool service when available
        throw new Error(`String handler not supported: ${name}`);
      } else {
        throw new Error(`Invalid tool handler: ${name}`);
      }

      // Record stats
      await this.statsService.recordToolExecution(name, true, Date.now() - startTime);

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      // Record failure stats
      await this.statsService.recordToolExecution(name, false, Date.now() - startTime);

      return {
        success: false,
        error: {
          code: error.code || 'EXECUTIONerror',
          message: error.message,
          details: error.details,
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  async getToolInfo(name: string): Promise<any> {
    try {
      // Get tool from registry
      const tool = this.registryService.getTool(name);
      if (!tool) {
        return null;
      }

      // Get statistics if available
      const stats = await this.statsService.getComponentStats('tool', name);

      return {
        name: tool.name,
        description: tool.description,
        enabled: true, // TODO: Add enabled property to MCPTool type
        inputSchema: tool.inputSchema,
        metadata: tool.metadata,
        stats: stats,
      };
    } catch (error) {
      this.logger.error('Failed to get tool info', { name, error });
      throw error;
    }
  }

  async enableTool(name: string, _force?: boolean): Promise<boolean> {
    try {
      // TODO: Implement tool enabling when tools service is available
      throw new Error('Tool enabling not implemented');
    } catch (error) {
      this.logger.error('Failed to enable tool', { name, error });
      throw error;
    }
  }

  async disableTool(name: string): Promise<boolean> {
    try {
      // TODO: Implement tool disabling when tools service is available
      throw new Error('Tool disabling not implemented');
    } catch (error) {
      this.logger.error('Failed to disable tool', { name, error });
      throw error;
    }
  }

  async refreshTools(): Promise<any> {
    try {
      // TODO: Implement tool discovery when discovery service is available
      const tools = Array.from(this.registryService.getTools().keys());

      // Clear cache after refresh
      this.cacheService.clear();

      return {
        total: tools.length,
        discovered: [],
        updated: [],
        removed: [],
        tools: tools,
      };
    } catch (error) {
      this.logger.error('Failed to refresh tools', error);
      throw error;
    }
  }

  async listPrompts(context?: MCPContext): Promise<any[]> {
    const cacheKey = `prompts:list:${context?.userId || 'anonymous'}`;

    // Check cache
    const cached = this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const db = this.databaseService!;
      const dbPrompts = await db.all<MCPPromptRow>(`
        SELECT name, description, arguments, metadata
        FROM mcp_prompts
        ORDER BY name
      `);

      const prompts = dbPrompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments ? JSON.parse(p.arguments) : undefined,
        metadata: p.metadata ? JSON.parse(p.metadata) : undefined,
      }));

      // Cache result
      this.cacheService.set(cacheKey, prompts);

      return prompts;
    } catch (error) {
      this.logger.error('Failed to list prompts', error);
      throw error;
    }
  }

  async getPrompt(name: string, args?: Record<string, any>, _context?: MCPContext): Promise<any> {
    try {
      const db = this.databaseService!;
      const dbPrompt = await db.get<MCPPromptDetailRow>(
        `
        SELECT name, description, messages, arguments, metadata
        FROM mcp_prompts
        WHERE name = ?
        LIMIT 1
      `,
        [name],
      );

      if (!dbPrompt) {
        throw new Error(`Prompt not found: ${name}`);
      }

      const prompt = {
        name: dbPrompt.name,
        description: dbPrompt.description,
        messages: dbPrompt.messages ? JSON.parse(dbPrompt.messages) : [],
        arguments: dbPrompt.arguments ? JSON.parse(dbPrompt.arguments) : undefined,
        metadata: dbPrompt.metadata ? JSON.parse(dbPrompt.metadata) : undefined,
      };

      // Record stats
      await this.statsService.recordPromptExecution(name);

      // Process messages with arguments if provided
      let processedMessages = prompt.messages;
      if (args && Object.keys(args).length > 0) {
        processedMessages = prompt.messages.map((msg: any) => ({
          ...msg,
          content: this.interpolateTemplate(msg.content, args),
        }));
      }

      return {
        messages: processedMessages,
        description: prompt.description,
        arguments: prompt.arguments,
        metadata: prompt.metadata,
      };
    } catch (error) {
      this.logger.error('Failed to get prompt', { name, error });
      throw error;
    }
  }

  /**
   * Simple template interpolation for prompt arguments
   */
  private interpolateTemplate(template: string, args: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => args[key] !== undefined ? String(args[key]) : match);
  }

  async createPrompt(_data: any): Promise<any> {
    try {
      // TODO: Implement prompt creation when prompts service is available
      throw new Error('Prompt creation not implemented');
    } catch (error) {
      this.logger.error('Failed to create prompt', { error });
      throw error;
    }
  }

  async updatePrompt(name: string, _data: any): Promise<any> {
    try {
      // TODO: Implement prompt update when prompts service is available
      throw new Error('Prompt update not implemented');
    } catch (error) {
      this.logger.error('Failed to update prompt', { name, error });
      throw error;
    }
  }

  async deletePrompt(name: string): Promise<boolean> {
    try {
      // TODO: Implement prompt deletion when prompts service is available
      throw new Error('Prompt deletion not implemented');
    } catch (error) {
      this.logger.error('Failed to delete prompt', { name, error });
      throw error;
    }
  }

  async listResources(context?: MCPContext): Promise<any[]> {
    const cacheKey = `resources:list:${context?.userId || 'anonymous'}`;

    // Check cache
    const cached = this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const db = this.databaseService!;
      const dbResources = await db.all<MCPResourceRow>(`
        SELECT uri, name, description, mime_type as mimeType, size, metadata
        FROM mcp_resources
        ORDER BY name
      `);

      const resources = dbResources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
        size: r.size,
        metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      }));

      // Cache result
      this.cacheService.set(cacheKey, resources);

      return resources;
    } catch (error) {
      this.logger.error('Failed to list resources', error);
      throw error;
    }
  }

  async readResource(uri: string, _context?: MCPContext): Promise<any> {
    try {
      const db = this.databaseService!;
      const resource = await db.get(
        `
        SELECT uri, name, description, mime_type as mimeType, 
               content_type as contentType, content, blob_content as blobContent
        FROM mcp_resources
        WHERE uri = ?
        LIMIT 1
      `,
        [uri],
      );

      if (!resource) {
        throw new Error(`Resource not found: ${uri}`);
      }

      await this.statsService.recordResourceAccess(uri, 'read', true);

      // Return content based on content type
      const contents = [];

      if (resource.contentType === 'text') {
        contents.push({
          uri: resource.uri,
          mimeType: resource.mimeType || 'text/plain',
          text: resource.content || '',
        });
      } else if (resource.contentType === 'blob' && resource.blobContent) {
        // Convert blob to base64 for binary content
        const base64Content = Buffer.from(resource.blobContent).toString('base64');
        contents.push({
          uri: resource.uri,
          mimeType: resource.mimeType || 'application/octet-stream',
          blob: base64Content,
        });
      }

      return {
        contents,
      };
    } catch (error) {
      await this.statsService.recordResourceAccess(uri, 'read', false);
      this.logger.error('Failed to read resource', { uri, error });
      throw error;
    }
  }

  async createResource(_data: any): Promise<any> {
    try {
      // TODO: Implement resource creation when resources service is available
      throw new Error('Resource creation not implemented');
    } catch (error) {
      this.logger.error('Failed to create resource', { error });
      throw error;
    }
  }

  async updateResource(uri: string, _data: any): Promise<any> {
    try {
      // TODO: Implement resource update when resources service is available
      throw new Error('Resource update not implemented');
    } catch (error) {
      await this.statsService.recordResourceAccess(uri, 'write', false);
      this.logger.error('Failed to update resource', { uri, error });
      throw error;
    }
  }

  async deleteResource(uri: string): Promise<boolean> {
    try {
      // TODO: Implement resource deletion when resources service is available
      throw new Error('Resource deletion not implemented');
    } catch (error) {
      await this.statsService.recordResourceAccess(uri, 'write', false);
      this.logger.error('Failed to delete resource', { uri, error });
      throw error;
    }
  }

  async subscribeResource(uri: string, _context?: MCPContext): Promise<void> {
    // TODO: Implement resource subscriptions
    this.logger.warn('Resource subscriptions not yet implemented', { uri });
  }

  // TODO: Uncomment and implement when permission checking is needed
  // private async _checkToolPermission(_toolName: string, context: MCPContext): Promise<void> {
  //   // TODO: Implement permission checking when permissions service is available
  //   if (!context.userId) {
  //     throw new Error('Authentication required');
  //   }
  //
  //   const tool = this.registryService.getTool(_toolName);
  //   if (!tool) {
  //     throw new Error(`Tool not found: ${_toolName}`);
  //   }
  //
  //   // For now, allow all authenticated users to use tools
  //   // TODO: Implement proper permission checking
  // }

  private validateArguments(args: any, schema: any): void {
    // Basic validation - could be enhanced with ajv or similar
    if (schema.type === 'object' && schema.required) {
      for (const required of schema.required) {
        if (!(required in args)) {
          throw new Error(`Missing required argument: ${required}`);
        }
      }
    }
  }

  private createDefaultContext(): MCPContext {
    return {
      logger: this.logger,
      metadata: {},
    };
  }

  // Search methods
  async searchTools(query: string, context?: MCPContext): Promise<any[]> {
    try {
      // Search in registry tools only
      const tools = await this.listTools(context);
      const lowerQuery = query.toLowerCase();

      return tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(lowerQuery) ||
          (tool.description?.toLowerCase().includes(lowerQuery)),
      );
    } catch (error) {
      this.logger.error('Failed to search tools', { query, error });
      throw error;
    }
  }

  async searchPrompts(query: string, _context?: MCPContext): Promise<any[]> {
    // TODO: Implement prompt search when prompts service is available
    // For now, return empty array
    return [];
  }

  async searchResources(query: string, _context?: MCPContext): Promise<any[]> {
    // TODO: Implement resource search when resources service is available
    // For now, return empty array
    return [];
  }
}
