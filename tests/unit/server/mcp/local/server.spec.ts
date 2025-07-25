import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type CallToolResult,
  type GetPromptRequest,
  type GetPromptResult,
  type ListPromptsResult,
  type ListResourcesResult,
  type ListToolsRequest,
  type ListToolsResult,
  type ReadResourceRequest,
  type ReadResourceResult,
  type ServerCapabilities
} from '@modelcontextprotocol/sdk/types.js';

import { LocalMcpServer } from '../../../../../src/server/mcp/local/server.js';

// Mock the external dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('@/server/mcp/core/handlers/resource-handlers');
vi.mock('@/server/mcp/core/handlers/prompt-handlers');
vi.mock('@/server/mcp/core/handlers/tool-handlers');

// Import the mocked handlers
import {
  handleListResources,
  handleResourceCall
} from '@/server/mcp/core/handlers/resource-handlers';
import { handleGetPrompt, handleListPrompts } from '@/server/mcp/core/handlers/prompt-handlers';
import { handleListTools, handleToolCall } from '@/server/mcp/core/handlers/tool-handlers';

describe('LocalMcpServer', () => {
  let localServer: LocalMcpServer;
  let mockServer: {
    connect: Mock;
    close: Mock;
    setRequestHandler: Mock;
  };
  let mockTransport: StdioServerTransport;

  // Mock handler results
  const mockListResourcesResult: ListResourcesResult = {
    resources: [
      { uri: 'resource://test', name: 'Test Resource' }
    ]
  };

  const mockReadResourceResult: ReadResourceResult = {
    contents: [
      { type: 'text', text: 'Resource content' }
    ]
  };

  const mockListPromptsResult: ListPromptsResult = {
    prompts: [
      { name: 'test-prompt', description: 'Test prompt' }
    ]
  };

  const mockGetPromptResult: GetPromptResult = {
    messages: [
      { role: 'user', content: { type: 'text', text: 'Test prompt content' } }
    ]
  };

  const mockListToolsResult: ListToolsResult = {
    tools: [
      { name: 'test-tool', description: 'Test tool' }
    ]
  };

  const mockCallToolResult: CallToolResult = {
    content: [
      { type: 'text', text: 'Tool result' }
    ]
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock server
    mockServer = {
      connect: vi.fn(),
      close: vi.fn(),
      setRequestHandler: vi.fn()
    };

    // Setup mock transport
    mockTransport = {} as StdioServerTransport;

    // Mock constructors
    (Server as unknown as Mock).mockImplementation(() => mockServer);
    (StdioServerTransport as unknown as Mock).mockImplementation(() => mockTransport);

    // Mock handlers
    (handleListResources as Mock).mockResolvedValue(mockListResourcesResult);
    (handleResourceCall as Mock).mockResolvedValue(mockReadResourceResult);
    (handleListPrompts as Mock).mockResolvedValue(mockListPromptsResult);
    (handleGetPrompt as Mock).mockResolvedValue(mockGetPromptResult);
    (handleListTools as Mock).mockResolvedValue(mockListToolsResult);
    (handleToolCall as Mock).mockResolvedValue(mockCallToolResult);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor', () => {
    it('should create server with correct metadata and capabilities', () => {
      // Act
      localServer = new LocalMcpServer();

      // Assert
      expect(Server).toHaveBeenCalledWith(
        {
          name: 'systemprompt-os-local',
          version: '0.1.0'
        },
        {
          capabilities: {
            resources: {},
            prompts: {},
            tools: {}
          }
        }
      );
    });

    it('should initialize isRunning as false', () => {
      // Act
      localServer = new LocalMcpServer();

      // Assert - access private property for testing
      expect((localServer as any).isRunning).toBe(false);
    });

    it('should call setupHandlers during construction', () => {
      // Arrange - spy on setupHandlers method
      const setupHandlersSpy = vi.spyOn(LocalMcpServer.prototype as any, 'setupHandlers');

      // Act
      localServer = new LocalMcpServer();

      // Assert
      expect(setupHandlersSpy).toHaveBeenCalledOnce();
    });
  });

  describe('start()', () => {
    beforeEach(() => {
      localServer = new LocalMcpServer();
    });

    it('should successfully start server when not already running', async () => {
      // Arrange
      mockServer.connect.mockResolvedValue(undefined);

      // Act
      await localServer.start();

      // Assert
      expect(StdioServerTransport).toHaveBeenCalledOnce();
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
      expect((localServer as any).isRunning).toBe(false); // Reset in finally block
    });

    it('should throw error when server is already running', async () => {
      // Arrange
      (localServer as any).isRunning = true;

      // Act & Assert
      await expect(localServer.start()).rejects.toThrow('Server is already running');
      expect(mockServer.connect).not.toHaveBeenCalled();
    });

    it('should set isRunning to true during connection and reset in finally', async () => {
      // Arrange
      let isRunningDuringConnection = false;
      mockServer.connect.mockImplementation(async () => {
        isRunningDuringConnection = (localServer as any).isRunning;
        throw new Error('Connection failed');
      });

      // Act & Assert
      await expect(localServer.start()).rejects.toThrow('Connection failed');
      expect(isRunningDuringConnection).toBe(true);
      expect((localServer as any).isRunning).toBe(false); // Reset in finally
    });

    it('should reset isRunning to false even if connection succeeds', async () => {
      // Arrange
      mockServer.connect.mockResolvedValue(undefined);

      // Act
      await localServer.start();

      // Assert
      expect((localServer as any).isRunning).toBe(false);
    });
  });

  describe('stop()', () => {
    beforeEach(() => {
      localServer = new LocalMcpServer();
    });

    it('should stop server when running', async () => {
      // Arrange
      (localServer as any).isRunning = true;
      mockServer.close.mockResolvedValue(undefined);

      // Act
      await localServer.stop();

      // Assert
      expect(mockServer.close).toHaveBeenCalledOnce();
      expect((localServer as any).isRunning).toBe(false);
    });

    it('should not call close when server is not running', async () => {
      // Arrange
      (localServer as any).isRunning = false;

      // Act
      await localServer.stop();

      // Assert
      expect(mockServer.close).not.toHaveBeenCalled();
    });

    it('should handle errors during server close', async () => {
      // Arrange
      (localServer as any).isRunning = true;
      const closeError = new Error('Close failed');
      mockServer.close.mockRejectedValue(closeError);

      // Act & Assert
      await expect(localServer.stop()).rejects.toThrow('Close failed');
      expect((localServer as any).isRunning).toBe(true); // Remains true on error
    });
  });

  describe('setupHandlers()', () => {
    let setupResourceHandlersSpy: Mock;
    let setupPromptHandlersSpy: Mock;
    let setupToolHandlersSpy: Mock;

    beforeEach(() => {
      setupResourceHandlersSpy = vi.spyOn(LocalMcpServer.prototype as any, 'setupResourceHandlers');
      setupPromptHandlersSpy = vi.spyOn(LocalMcpServer.prototype as any, 'setupPromptHandlers');
      setupToolHandlersSpy = vi.spyOn(LocalMcpServer.prototype as any, 'setupToolHandlers');
    });

    it('should call all handler setup methods', () => {
      // Act
      localServer = new LocalMcpServer();

      // Assert
      expect(setupResourceHandlersSpy).toHaveBeenCalledOnce();
      expect(setupPromptHandlersSpy).toHaveBeenCalledOnce();
      expect(setupToolHandlersSpy).toHaveBeenCalledOnce();
    });
  });

  describe('setupResourceHandlers()', () => {
    beforeEach(() => {
      localServer = new LocalMcpServer();
    });

    it('should register ListResourcesRequestSchema handler', () => {
      // Assert
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        ListResourcesRequestSchema,
        expect.any(Function)
      );
    });

    it('should register ReadResourceRequestSchema handler', () => {
      // Assert
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        ReadResourceRequestSchema,
        expect.any(Function)
      );
    });

    it('should call handleListResources when list resources handler is invoked', async () => {
      // Arrange
      const handlerCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === ListResourcesRequestSchema
      );
      const handler = handlerCall![1];

      // Act
      const result = await handler();

      // Assert
      expect(handleListResources).toHaveBeenCalledOnce();
      expect(result).toEqual(mockListResourcesResult);
    });

    it('should call handleResourceCall when read resource handler is invoked', async () => {
      // Arrange
      const handlerCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === ReadResourceRequestSchema
      );
      const handler = handlerCall![1];
      const mockRequest: ReadResourceRequest = {
        method: 'resources/read',
        params: { uri: 'resource://test' }
      };

      // Act
      const result = await handler(mockRequest);

      // Assert
      expect(handleResourceCall).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockReadResourceResult);
    });
  });

  describe('setupPromptHandlers()', () => {
    beforeEach(() => {
      localServer = new LocalMcpServer();
    });

    it('should register ListPromptsRequestSchema handler', () => {
      // Assert
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        ListPromptsRequestSchema,
        expect.any(Function)
      );
    });

    it('should register GetPromptRequestSchema handler', () => {
      // Assert
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        GetPromptRequestSchema,
        expect.any(Function)
      );
    });

    it('should call handleListPrompts when list prompts handler is invoked', async () => {
      // Arrange
      const handlerCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === ListPromptsRequestSchema
      );
      const handler = handlerCall![1];

      // Act
      const result = await handler();

      // Assert
      expect(handleListPrompts).toHaveBeenCalledOnce();
      expect(result).toEqual(mockListPromptsResult);
    });

    it('should call handleGetPrompt when get prompt handler is invoked', async () => {
      // Arrange
      const handlerCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === GetPromptRequestSchema
      );
      const handler = handlerCall![1];
      const mockRequest: GetPromptRequest = {
        method: 'prompts/get',
        params: { name: 'test-prompt' }
      };

      // Act
      const result = await handler(mockRequest);

      // Assert
      expect(handleGetPrompt).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockGetPromptResult);
    });
  });

  describe('setupToolHandlers()', () => {
    beforeEach(() => {
      localServer = new LocalMcpServer();
    });

    it('should register ListToolsRequestSchema handler', () => {
      // Assert
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        ListToolsRequestSchema,
        expect.any(Function)
      );
    });

    it('should register CallToolRequestSchema handler', () => {
      // Assert
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        CallToolRequestSchema,
        expect.any(Function)
      );
    });

    it('should call handleListTools with local context when list tools handler is invoked', async () => {
      // Arrange
      const handlerCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === ListToolsRequestSchema
      );
      const handler = handlerCall![1];
      const mockRequest: ListToolsRequest = {
        method: 'tools/list',
        params: {}
      };

      // Act
      const result = await handler(mockRequest);

      // Assert
      expect(handleListTools).toHaveBeenCalledWith(mockRequest, {
        sessionId: 'local-stdio',
        userId: 'local-admin'
      });
      expect(result).toEqual(mockListToolsResult);
    });

    it('should call handleToolCall with local context when call tool handler is invoked', async () => {
      // Arrange
      const handlerCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === CallToolRequestSchema
      );
      const handler = handlerCall![1];
      const mockRequest: CallToolRequest = {
        method: 'tools/call',
        params: { name: 'test-tool', arguments: {} }
      };

      // Act
      const result = await handler(mockRequest);

      // Assert
      expect(handleToolCall).toHaveBeenCalledWith(mockRequest, {
        sessionId: 'local-stdio',
        userId: 'local-admin'
      });
      expect(result).toEqual(mockCallToolResult);
    });
  });

  describe('createLocalContext()', () => {
    beforeEach(() => {
      localServer = new LocalMcpServer();
    });

    it('should return correct local context', () => {
      // Act
      const context = (localServer as any).createLocalContext();

      // Assert
      expect(context).toEqual({
        sessionId: 'local-stdio',
        userId: 'local-admin'
      });
    });

    it('should return same context on multiple calls', () => {
      // Act
      const context1 = (localServer as any).createLocalContext();
      const context2 = (localServer as any).createLocalContext();

      // Assert
      expect(context1).toEqual(context2);
      expect(context1).toEqual({
        sessionId: 'local-stdio',
        userId: 'local-admin'
      });
    });
  });

  describe('Integration Tests', () => {
    beforeEach(() => {
      localServer = new LocalMcpServer();
    });

    it('should setup all handlers during construction and be ready to start', () => {
      // Assert
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(6);
      
      // Verify all expected schemas are registered
      const registeredSchemas = mockServer.setRequestHandler.mock.calls.map(call => call[0]);
      expect(registeredSchemas).toContain(ListResourcesRequestSchema);
      expect(registeredSchemas).toContain(ReadResourceRequestSchema);
      expect(registeredSchemas).toContain(ListPromptsRequestSchema);
      expect(registeredSchemas).toContain(GetPromptRequestSchema);
      expect(registeredSchemas).toContain(ListToolsRequestSchema);
      expect(registeredSchemas).toContain(CallToolRequestSchema);
    });

    it('should handle complete start-stop lifecycle', async () => {
      // Arrange
      mockServer.connect.mockResolvedValue(undefined);
      mockServer.close.mockResolvedValue(undefined);

      // Act - Start server
      await localServer.start();
      expect((localServer as any).isRunning).toBe(false); // Reset after connection

      // Set as running to test stop
      (localServer as any).isRunning = true;
      await localServer.stop();

      // Assert
      expect(mockServer.connect).toHaveBeenCalledOnce();
      expect(mockServer.close).toHaveBeenCalledOnce();
      expect((localServer as any).isRunning).toBe(false);
    });

    it('should properly handle errors and maintain state consistency', async () => {
      // Arrange
      const connectionError = new Error('Connection failed');
      mockServer.connect.mockRejectedValue(connectionError);

      // Act & Assert - Start should fail but state should be consistent
      await expect(localServer.start()).rejects.toThrow('Connection failed');
      expect((localServer as any).isRunning).toBe(false);

      // Should be able to try starting again
      mockServer.connect.mockResolvedValue(undefined);
      await localServer.start();
      expect(mockServer.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      localServer = new LocalMcpServer();
    });

    it('should propagate handler errors', async () => {
      // Arrange
      const handlerError = new Error('Handler failed');
      (handleListResources as Mock).mockRejectedValue(handlerError);
      
      const handlerCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === ListResourcesRequestSchema
      );
      const handler = handlerCall![1];

      // Act & Assert
      await expect(handler()).rejects.toThrow('Handler failed');
    });

    it('should propagate tool handler errors', async () => {
      // Arrange
      const toolError = new Error('Tool execution failed');
      (handleToolCall as Mock).mockRejectedValue(toolError);
      
      const handlerCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === CallToolRequestSchema
      );
      const handler = handlerCall![1];
      const mockRequest: CallToolRequest = {
        method: 'tools/call',
        params: { name: 'failing-tool', arguments: {} }
      };

      // Act & Assert
      await expect(handler(mockRequest)).rejects.toThrow('Tool execution failed');
    });
  });
});