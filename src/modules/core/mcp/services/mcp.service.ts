/**
 * @fileoverview Main MCP service for coordinating tools, prompts, and resources
 * @module modules/core/mcp/services
 */

import type { Logger } from '../../../types.js';
import type {
  MCPConfig,
  MCPContext,
  MCPExecutionResult,
  MCPTool,
  MCPPrompt,
  MCPResource
} from '../types/index.js';
import { MCPRegistryService } from './registry.service.js';
import { MCPCacheService } from './cache.service.js';
import { MCPStatsService } from './stats.service.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { ToolsService } from '../../tools/services/tools.service.js';
import { PromptsService } from '../../prompts/services/prompts.service.js';
import { ResourcesService } from '../../resources/services/resources.service.js';

export class MCPService {
  private db: DatabaseService;
  private permissionsService?: PermissionsService;
  private toolsService?: ToolsService;
  private promptsService?: PromptsService;
  private resourcesService?: ResourcesService;
  private servers: Map<string, any> = new Map();
  
  constructor(
    private config: MCPConfig,
    private registryService: MCPRegistryService,
    private cacheService: MCPCacheService,
    private statsService: MCPStatsService,
    private logger: Logger
  ) {
    this.db = DatabaseService.getInstance();
  }
  
  async startServers(): Promise<void> {
    // Initialize module services
    try {
      const { PermissionsService } = await import('../../permissions/services/permissions.service.js');
      const { ToolsService } = await import('../../tools/services/tools.service.js');
      const { PromptsService } = await import('../../prompts/services/prompts.service.js');
      const { ResourcesService } = await import('../../resources/services/resources.service.js');
      
      this.permissionsService = new PermissionsService(this.logger);
      this.toolsService = new ToolsService(this.logger);
      this.promptsService = new PromptsService(this.logger);
      this.resourcesService = new ResourcesService(this.logger);
    } catch (error) {
      this.logger.warn('Some module services not available', { error });
    }
    
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
          port: this.config.servers.remote.port
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
      // Get tools from registry
      const registryTools = Array.from(this.registryService.getTools().values());
      
      // Get tools from tools service if available
      let serviceTools: any[] = [];
      if (this.toolsService) {
        const tools = await this.toolsService.getTools();
        serviceTools = tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          metadata: {
            ...tool.metadata,
            source: 'service'
          }
        }));
      }
      
      // Merge and deduplicate tools
      const allTools = [...registryTools, ...serviceTools];
      const uniqueTools = new Map<string, any>();
      for (const tool of allTools) {
        uniqueTools.set(tool.name, tool);
      }
      
      // Filter by permissions if context provided
      let tools = Array.from(uniqueTools.values());
      if (context?.userId && this.permissionsService) {
        const permissions = await this.permissionsService.getUserPermissions(context.userId);
        tools = tools.filter(tool => {
          if (!tool.metadata?.permissions) return true;
          return tool.metadata.permissions.some((perm: string) => permissions.includes(perm));
        });
      }
      
      // Cache result
      this.cacheService.set(cacheKey, tools);
      
      return tools;
    } catch (error) {
      this.logger.error('Failed to list tools', error);
      throw error;
    }
  }
  
  async executeTool(
    name: string,
    args: any,
    context?: MCPContext
  ): Promise<MCPExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Check permissions
      if (context?.userId && this.config.security.requireAuth) {
        await this.checkToolPermission(name, context);
      }
      
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
      } else if (typeof tool.handler === 'string' && this.toolsService) {
        // Execute through tools service
        result = await this.toolsService.executeTool(tool.handler, args, {
          userId: context?.userId,
          sessionId: context?.sessionId
        });
      } else {
        throw new Error(`Invalid tool handler: ${name}`);
      }
      
      // Record stats
      await this.statsService.recordToolExecution(name, true, Date.now() - startTime);
      
      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Date.now() - startTime
        }
      };
    } catch (error: any) {
      // Record failure stats
      await this.statsService.recordToolExecution(name, false, Date.now() - startTime);
      
      return {
        success: false,
        error: {
          code: error.code || 'EXECUTION_ERROR',
          message: error.message,
          details: error.details
        },
        metadata: {
          executionTimeMs: Date.now() - startTime
        }
      };
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
      // Get prompts from registry
      const registryPrompts = Array.from(this.registryService.getPrompts().values());
      
      // Get prompts from prompts service if available
      let servicePrompts: any[] = [];
      if (this.promptsService) {
        const prompts = await this.promptsService.listPrompts();
        servicePrompts = prompts.map(prompt => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
          metadata: {
            ...prompt.metadata,
            source: 'service'
          }
        }));
      }
      
      // Merge and deduplicate prompts
      const allPrompts = [...registryPrompts, ...servicePrompts];
      const uniquePrompts = new Map<string, any>();
      for (const prompt of allPrompts) {
        uniquePrompts.set(prompt.name, prompt);
      }
      
      const prompts = Array.from(uniquePrompts.values());
      
      // Cache result
      this.cacheService.set(cacheKey, prompts);
      
      return prompts;
    } catch (error) {
      this.logger.error('Failed to list prompts', error);
      throw error;
    }
  }
  
  async getPrompt(
    name: string,
    args?: Record<string, any>,
    context?: MCPContext
  ): Promise<any> {
    try {
      // Get prompt from registry
      const registryPrompt = this.registryService.getPrompt(name);
      
      // Get prompt from service if not in registry
      if (!registryPrompt && this.promptsService) {
        const prompt = await this.promptsService.getPrompt(name);
        if (!prompt) {
          throw new Error(`Prompt not found: ${name}`);
        }
        
        // Render prompt with arguments
        const rendered = await this.promptsService.renderPrompt(name, args || {});
        
        // Record stats
        await this.statsService.recordPromptExecution(name);
        
        return {
          messages: [
            {
              role: 'user',
              content: rendered
            }
          ]
        };
      }
      
      if (!registryPrompt) {
        throw new Error(`Prompt not found: ${name}`);
      }
      
      // For registry prompts, return as-is (simplified for now)
      await this.statsService.recordPromptExecution(name);
      
      return {
        messages: [
          {
            role: 'user',
            content: registryPrompt.description || name
          }
        ]
      };
    } catch (error) {
      this.logger.error('Failed to get prompt', { name, error });
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
      // Get resources from registry
      const registryResources = Array.from(this.registryService.getResources().values());
      
      // Get resources from resources service if available
      let serviceResources: any[] = [];
      if (this.resourcesService) {
        const resources = await this.resourcesService.listResources();
        serviceResources = resources.map(resource => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
          metadata: {
            ...resource.metadata,
            source: 'service'
          }
        }));
      }
      
      // Merge and deduplicate resources
      const allResources = [...registryResources, ...serviceResources];
      const uniqueResources = new Map<string, any>();
      for (const resource of allResources) {
        uniqueResources.set(resource.uri, resource);
      }
      
      const resources = Array.from(uniqueResources.values());
      
      // Cache result
      this.cacheService.set(cacheKey, resources);
      
      return resources;
    } catch (error) {
      this.logger.error('Failed to list resources', error);
      throw error;
    }
  }
  
  async readResource(uri: string, context?: MCPContext): Promise<any> {
    try {
      // Get resource from registry
      const registryResource = this.registryService.getResource(uri);
      
      // Get resource from service if not in registry
      if (!registryResource && this.resourcesService) {
        const resource = await this.resourcesService.readResource(uri);
        if (!resource) {
          throw new Error(`Resource not found: ${uri}`);
        }
        
        // Record stats
        await this.statsService.recordResourceAccess(uri, 'read', true);
        
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: resource.mimeType || 'text/plain',
              text: resource.content
            }
          ]
        };
      }
      
      if (!registryResource) {
        throw new Error(`Resource not found: ${uri}`);
      }
      
      // For registry resources, return minimal content
      await this.statsService.recordResourceAccess(uri, 'read', true);
      
      return {
        contents: [
          {
            uri: registryResource.uri,
            mimeType: registryResource.mimeType || 'text/plain',
            text: registryResource.description || ''
          }
        ]
      };
    } catch (error) {
      await this.statsService.recordResourceAccess(uri, 'read', false);
      this.logger.error('Failed to read resource', { uri, error });
      throw error;
    }
  }
  
  async subscribeResource(uri: string, context?: MCPContext): Promise<void> {
    // TODO: Implement resource subscriptions
    this.logger.warn('Resource subscriptions not yet implemented', { uri });
  }
  
  private async checkToolPermission(toolName: string, context: MCPContext): Promise<void> {
    if (!context.userId || !this.permissionsService) {
      throw new Error('Authentication required');
    }
    
    const tool = this.registryService.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    if (tool.metadata?.permissions && tool.metadata.permissions.length > 0) {
      const userPermissions = await this.permissionsService.getUserPermissions(context.userId);
      const hasPermission = tool.metadata.permissions.some(perm => userPermissions.includes(perm));
      
      if (!hasPermission) {
        throw new Error(`Insufficient permissions for tool: ${toolName}`);
      }
    }
  }
  
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
      metadata: {}
    };
  }
}