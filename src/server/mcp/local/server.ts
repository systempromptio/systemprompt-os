/**
 * @file Local MCP server implementation for STDIO transport.
 * @module server/mcp/local/server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type {ServerCapabilities} from '@modelcontextprotocol/sdk/types.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type GetPromptRequest,
  GetPromptRequestSchema,
  type ListPromptsRequest,
  ListPromptsRequestSchema,
  type ListResourcesRequest,
  ListResourcesRequestSchema,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ReadResourceRequest,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import {
  handleListResources,
  handleResourceCall
} from '@/server/mcp/core/handlers/resource-handlers.js';
import { handleGetPrompt, handleListPrompts } from '@/server/mcp/core/handlers/prompt-handlers.js';
import { handleListTools, handleToolCall } from '@/server/mcp/core/handlers/tool-handlers.js';
import type { MCPToolContext } from '@/server/mcp/core/types/request-context.js';

/**
 * Local MCP Server implementation.
 * Provides full access to all tools via STDIO transport.
 */
export class LocalMCPServer {
  private readonly server: Server;
  private isRunning = false;

  constructor() {
    const capabilities: ServerCapabilities = {
      resources: {},
      prompts: {},
      tools: {}
    };

    this.server = new Server(
      {
        name: 'systemprompt-os-local',
        version: '0.1.0'
      },
      {
        capabilities
      }
    );

    this.setupHandlers();
  }

  /**
   * Sets up request handlers for resources, prompts, and tools
   * All handlers use the 'local' scope for tool filtering.
   */
  private setupHandlers(): void {
    this.setupResourceHandlers();
    this.setupPromptHandlers();
    this.setupToolHandlers();
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(
      ListResourcesRequestSchema,
      async (_request: ListResourcesRequest) => { return await handleListResources() }
    );

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request: ReadResourceRequest) => { return await handleResourceCall(request) }
    );
  }

  private setupPromptHandlers(): void {
    this.server.setRequestHandler(
      ListPromptsRequestSchema,
      async (_request: ListPromptsRequest) => { return await handleListPrompts() }
    );

    this.server.setRequestHandler(
      GetPromptRequestSchema,
      async (request: GetPromptRequest) => { return await handleGetPrompt(request) }
    );
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async (request: ListToolsRequest) => {
        const context = this.createLocalContext();

        return await handleListTools(request, context);
      }
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        const context = this.createLocalContext();
        return await handleToolCall(request, context);
      }
    );
  }

  private createLocalContext(): MCPToolContext {
    return {
      sessionId: 'local-stdio',
      userId: 'local-admin'
    };
  }

  /**
   * Start the STDIO server.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    const transport = new StdioServerTransport();
    this.isRunning = true;

    try {
      await this.server.connect(transport);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop the server.
   */
  async stop(): Promise<void> {
    if (this.isRunning) {
      await this.server.close();
      this.isRunning = false;
    }
  }
}
