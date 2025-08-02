/**
 * MCP Service - Main service for managing MCP contexts and SDK integration.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type CallToolResult
} from '@modelcontextprotocol/sdk/types.js';

import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import type { IDatabaseService } from '@/modules/core/database/types/manual';
import type { IEventBus } from '@/modules/core/events/types/manual';

import {
  MCPContextRepository,
  MCPToolRepository,
  MCPResourceRepository,
  MCPPromptRepository,
  MCPPermissionRepository
} from '../repositories/mcp.repository';

import type {
  IMCPContext,
  IMCPTool,
  IMCPResource,
  IMCPPrompt
} from '../types/manual';

/**
 * MCP Service for managing contexts and SDK integration.
 */
export class MCPService {
  private static instance: MCPService;
  private logger = LoggerService.getInstance();
  
  // Repositories
  private contextRepo!: MCPContextRepository;
  private toolRepo!: MCPToolRepository;
  private resourceRepo!: MCPResourceRepository;
  private promptRepo!: MCPPromptRepository;
  private permissionRepo!: MCPPermissionRepository;
  
  // MCP SDK servers (one per context)
  private servers: Map<string, Server> = new Map();
  
  // Dependencies
  private db!: IDatabaseService;
  private eventBus!: IEventBus;
  
  private constructor() {}
  
  public static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }
  
  /**
   * Initialize the service with dependencies.
   */
  public async initialize(db: IDatabaseService, eventBus: IEventBus): Promise<void> {
    this.db = db;
    this.eventBus = eventBus;
    
    // Initialize repositories
    this.contextRepo = new MCPContextRepository(db);
    this.toolRepo = new MCPToolRepository(db);
    this.resourceRepo = new MCPResourceRepository(db);
    this.promptRepo = new MCPPromptRepository(db);
    this.permissionRepo = new MCPPermissionRepository(db);
    
    // Create MCP tables if they don't exist
    await this.ensureTables();
    
    this.logger.info(LogSource.MCP, 'MCP Service initialized');
  }
  
  /**
   * Ensure MCP tables exist in the database.
   */
  private async ensureTables(): Promise<void> {
    // Read schema and execute
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      // Try to find the schema file - checking both compiled and source locations
      let schemaPath = path.join(__dirname, '..', 'schema.sql');
      if (!fs.existsSync(schemaPath)) {
        // If not in dist, try the source location
        schemaPath = path.join(process.cwd(), 'src', 'modules', 'core', 'mcp', 'schema.sql');
      }
      
      const schema = await fs.promises.readFile(schemaPath, 'utf-8');
      
      if (schema) {
        // Execute schema statements one by one
        const statements = schema.split(';').filter(s => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await this.db.query(statement);
            } catch (error) {
              // Table might already exist - only log as debug
              if (!error.message?.includes('already exists')) {
                this.logger.error(LogSource.MCP, `Failed to execute schema statement: ${error.message}`);
              }
            }
          }
        }
        this.logger.info(LogSource.MCP, 'MCP tables ensured');
      }
    } catch (error) {
      this.logger.error(LogSource.MCP, 'Failed to load MCP schema', { error });
    }
  }
  
  /**
   * Get repositories for direct access.
   */
  getRepositories() {
    return {
      contexts: this.contextRepo,
      tools: this.toolRepo,
      resources: this.resourceRepo,
      prompts: this.promptRepo,
      permissions: this.permissionRepo
    };
  }
  
  /**
   * Create a new MCP context.
   */
  async createContext(data: any): Promise<any> {
    const context = await this.contextRepo.create(data);
    
    // Emit event for context creation
    this.eventBus.emit('mcp.context.created', { context });
    
    this.logger.info(LogSource.MCP, `Created MCP context: ${context.name}`);
    return context;
  }
  
  /**
   * Update an MCP context.
   */
  async updateContext(id: string, data: any): Promise<any> {
    const context = await this.contextRepo.update(id, data);
    
    // Emit event for context update
    this.eventBus.emit('mcp.context.updated', { context });
    
    this.logger.info(LogSource.MCP, `Updated MCP context: ${id}`);
    return context;
  }
  
  /**
   * Delete an MCP context.
   */
  async deleteContext(id: string): Promise<void> {
    await this.contextRepo.delete(id);
    
    // Remove any associated server
    if (this.servers.has(id)) {
      this.servers.delete(id);
    }
    
    // Emit event for context deletion
    this.eventBus.emit('mcp.context.deleted', { contextId: id });
    
    this.logger.info(LogSource.MCP, `Deleted MCP context: ${id}`);
  }
  
  /**
   * Create a tool for a context.
   */
  async createTool(contextId: string, data: any): Promise<any> {
    const tool = await this.toolRepo.create({ ...data, context_id: contextId });
    
    // Refresh server if it exists
    if (this.servers.has(contextId)) {
      this.servers.delete(contextId);
    }
    
    this.logger.info(LogSource.MCP, `Created tool ${tool.name} for context ${contextId}`);
    return tool;
  }
  
  /**
   * Create a resource for a context.
   */
  async createResource(contextId: string, data: any): Promise<any> {
    const resource = await this.resourceRepo.create({ ...data, context_id: contextId });
    
    // Refresh server if it exists
    if (this.servers.has(contextId)) {
      this.servers.delete(contextId);
    }
    
    this.logger.info(LogSource.MCP, `Created resource ${resource.uri} for context ${contextId}`);
    return resource;
  }
  
  /**
   * Create a prompt for a context.
   */
  async createPrompt(contextId: string, data: any): Promise<any> {
    const prompt = await this.promptRepo.create({ ...data, context_id: contextId });
    
    // Refresh server if it exists
    if (this.servers.has(contextId)) {
      this.servers.delete(contextId);
    }
    
    this.logger.info(LogSource.MCP, `Created prompt ${prompt.name} for context ${contextId}`);
    return prompt;
  }
  
  /**
   * Get MCP SDK compatible tools for a context.
   */
  async getToolsForContext(contextId: string): Promise<any[]> {
    const tools = await this.toolRepo.findByContextId(contextId);
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_schema
    }));
  }
  
  /**
   * Get MCP SDK compatible resources for a context.
   */
  async getResourcesForContext(contextId: string): Promise<any[]> {
    const resources = await this.resourceRepo.findByContextId(contextId);
    return resources.map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mime_type
    }));
  }
  
  /**
   * Get MCP SDK compatible prompts for a context.
   */
  async getPromptsForContext(contextId: string): Promise<any[]> {
    const prompts = await this.promptRepo.findByContextId(contextId);
    return prompts.map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments || []
    }));
  }
  
  /**
   * Create an MCP server from a context.
   */
  async createServerFromContext(contextId: string): Promise<Server> {
    return this.createServer(contextId);
  }
  
  /**
   * Create an MCP SDK server for a context.
   */
  async createServer(contextId: string): Promise<Server> {
    // Check if server already exists
    if (this.servers.has(contextId)) {
      return this.servers.get(contextId)!;
    }
    
    const context = await this.contextRepo.findById(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    // Create server with MCP SDK - use server_config if available
    const serverInfo = context.server_config || {
      name: context.name,
      version: context.version
    };
    
    const server = new Server(
      {
        name: serverInfo.name || context.name,
        version: serverInfo.version || context.version
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );
    
    // Register tool handlers
    await this.registerToolHandlers(server, contextId);
    
    // Register resource handlers
    await this.registerResourceHandlers(server, contextId);
    
    // Register prompt handlers
    await this.registerPromptHandlers(server, contextId);
    
    // Store server
    this.servers.set(contextId, server);
    
    this.logger.info(LogSource.MCP, `Created MCP server for context ${context.name}`);
    
    return server;
  }
  
  /**
   * Get or create an MCP SDK server for a context.
   */
  async getOrCreateServer(contextId: string): Promise<Server> {
    if (this.servers.has(contextId)) {
      return this.servers.get(contextId)!;
    }
    return this.createServer(contextId);
  }
  
  /**
   * Register tool handlers for a server.
   */
  private async registerToolHandlers(server: Server, contextId: string): Promise<void> {
    const tools = await this.toolRepo.findByContextId(contextId);
    
    if (tools.length > 0) {
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.input_schema
        }))
      }));
      
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const tool = tools.find(t => t.name === request.params.name);
        if (!tool) {
          throw new Error(`Tool ${request.params.name} not found`);
        }
        
        return this.executeToolHandler(tool, request.params.arguments);
      });
    }
  }
  
  /**
   * Register resource handlers for a server.
   */
  private async registerResourceHandlers(server: Server, contextId: string): Promise<void> {
    const resources = await this.resourceRepo.findByContextId(contextId);
    
    if (resources.length > 0) {
      server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: resources.map(resource => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mime_type
        }))
      }));
      
      server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const resource = resources.find(r => r.uri === request.params.uri);
        if (!resource) {
          throw new Error(`Resource ${request.params.uri} not found`);
        }
        
        const content = resource.content_type === 'static' 
          ? resource.content 
          : await this.executeDynamicResource(resource);
          
        return {
          contents: [{
            uri: resource.uri,
            mimeType: resource.mime_type,
            text: typeof content === 'string' ? content : JSON.stringify(content)
          }]
        };
      });
    }
  }
  
  /**
   * Register prompt handlers for a server.
   */
  private async registerPromptHandlers(server: Server, contextId: string): Promise<void> {
    const prompts = await this.promptRepo.findByContextId(contextId);
    
    if (prompts.length > 0) {
      server.setRequestHandler(ListPromptsRequestSchema, async () => ({
        prompts: prompts.map(prompt => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments
        }))
      }));
      
      server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const prompt = prompts.find(p => p.name === request.params.name);
        if (!prompt) {
          throw new Error(`Prompt ${request.params.name} not found`);
        }
        
        // Replace template variables
        let result = prompt.template;
        if (request.params.arguments) {
          for (const [key, value] of Object.entries(request.params.arguments)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
          }
        }
        
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: result
            }
          }]
        };
      });
    }
  }
  
  /**
   * Execute a tool handler based on its configuration.
   */
  private async executeToolHandler(tool: IMCPTool, args: any): Promise<CallToolResult> {
    this.logger.info(LogSource.MCP, `Executing tool ${tool.name} with handler type ${tool.handler_type}`);
    
    switch (tool.handler_type) {
      case 'function': {
        // For now, emit event to handle tool execution
        const result = await new Promise<CallToolResult>((resolve, reject) => {
          const handler = (data: any) => {
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data.result);
            }
          };
          
          this.eventBus.once(`mcp.tool.${tool.name}.result`, handler);
          this.eventBus.emit(`mcp.tool.${tool.name}.execute`, { args, tool });
          
          // Timeout after 30 seconds
          setTimeout(() => {
            this.eventBus.off(`mcp.tool.${tool.name}.result`, handler);
            reject(new Error('Tool execution timeout'));
          }, 30000);
        });
        
        return result;
      }
      
      case 'http': {
        // Make HTTP request
        const { url, method = 'POST', headers = {} } = tool.handler_config;
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: method !== 'GET' ? JSON.stringify(args) : undefined
        });
        
        const result = await response.json();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };
      }
      
      case 'command': {
        // Execute system command
        const { command, args: cmdArgs = [] } = tool.handler_config;
        const { spawn } = await import('child_process');
        
        return new Promise((resolve, reject) => {
          const proc = spawn(command, [...cmdArgs, ...Object.values(args || {})]);
          let stdout = '';
          let stderr = '';
          
          proc.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          proc.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          proc.on('close', (code) => {
            if (code === 0) {
              resolve({
                content: [{
                  type: 'text',
                  text: stdout
                }]
              });
            } else {
              reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
          });
        });
      }
      
      default:
        throw new Error(`Unknown handler type: ${tool.handler_type}`);
    }
  }
  
  /**
   * Execute a dynamic resource handler.
   */
  private async executeDynamicResource(resource: IMCPResource): Promise<any> {
    const { type, ...config } = resource.content;
    
    switch (type) {
      case 'function': {
        // Emit event for dynamic resource
        const result = await new Promise((resolve, reject) => {
          const handler = (data: any) => {
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data.content);
            }
          };
          
          this.eventBus.once(`mcp.resource.${resource.uri}.result`, handler);
          this.eventBus.emit(`mcp.resource.${resource.uri}.read`, { resource });
          
          // Timeout after 10 seconds
          setTimeout(() => {
            this.eventBus.off(`mcp.resource.${resource.uri}.result`, handler);
            reject(new Error('Resource read timeout'));
          }, 10000);
        });
        
        return result;
      }
      
      case 'http': {
        const response = await fetch(config.url, {
          method: config.method || 'GET',
          headers: config.headers || {}
        });
        return response.text();
      }
      
      default:
        return resource.content;
    }
  }
}