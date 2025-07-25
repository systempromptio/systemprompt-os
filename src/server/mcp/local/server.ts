/**
 * Local MCP server implementation for STDIO transport providing full access to all tools.
 * @file Local MCP server implementation for STDIO transport.
 * @module server/mcp/local/server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type CallToolResult,
  type GetPromptRequest,
  GetPromptRequestSchema,
  type GetPromptResult,
  ListPromptsRequestSchema,
  type ListPromptsResult,
  ListResourcesRequestSchema,
  type ListResourcesResult,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ListToolsResult,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
  type ReadResourceResult,
  type ServerCapabilities
} from '@modelcontextprotocol/sdk/types.js';
import {
  handleListResources,
  handleResourceCall
} from '@/server/mcp/core/handlers/resource-handlers';
import { handleGetPrompt, handleListPrompts } from '@/server/mcp/core/handlers/prompt-handlers';
import { handleListTools, handleToolCall } from '@/server/mcp/core/handlers/tool-handlers';
import type { IMCPToolContext } from '@/server/mcp/core/types/request-context';

/**
 * Local MCP Server implementation.
 * Provides full access to all tools via STDIO transport.
 */
export class LocalMcpServer {
  private readonly server: Server;
  private isRunning = false;

  /**
   * Constructor.
   */
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

  /**
   * Sets up request handlers for resources, prompts, and tools
   * All handlers use the 'local' scope for tool filtering.
   */
  private setupHandlers(): void {
    this.setupResourceHandlers();
    this.setupPromptHandlers();
    this.setupToolHandlers();
  }

  /**
   * Setup resource handlers.
   */
  private setupResourceHandlers(): void {
    this.server.setRequestHandler(
      ListResourcesRequestSchema,
      async (): Promise<ListResourcesResult> => {
        return await handleListResources();
      }
    );

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request: ReadResourceRequest): Promise<ReadResourceResult> => {
        return await handleResourceCall(request);
      }
    );
  }

  /**
   * Setup prompt handlers.
   */
  private setupPromptHandlers(): void {
    this.server.setRequestHandler(
      ListPromptsRequestSchema,
      async (): Promise<ListPromptsResult> => {
        return await handleListPrompts();
      }
    );

    this.server.setRequestHandler(
      GetPromptRequestSchema,
      async (request: GetPromptRequest): Promise<GetPromptResult> => {
        return await handleGetPrompt(request);
      }
    );
  }

  /**
   * Setup tool handlers.
   */
  private setupToolHandlers(): void {
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async (request: ListToolsRequest): Promise<ListToolsResult> => {
        const context = this.createLocalContext();

        return await handleListTools(request, context);
      }
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest): Promise<CallToolResult> => {
        const context = this.createLocalContext();
        return await handleToolCall(request, context);
      }
    );
  }

  /**
   * Create local context for tool execution.
   * @returns Local tool context.
   */
  private createLocalContext(): IMCPToolContext {
    return {
      sessionId: 'local-stdio',
      userId: 'local-admin'
    };
  }
}
