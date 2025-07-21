import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { MCPHandler, setMCPHandlerInstance, getMCPHandlerInstance } from '../../../src/server/mcp';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js');
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));
vi.mock('../../../src/server/mcp/core/handlers/prompt-handlers');
vi.mock('../../../src/server/mcp/core/handlers/resource-handlers');
vi.mock('../../../src/server/mcp/core/handlers/resource-templates-handler');
vi.mock('../../../src/server/mcp/core/handlers/roots-handlers');
vi.mock('../../../src/server/mcp/core/handlers/tool-handlers');

describe('MCPHandler', () => {
  let handler: MCPHandler;
  let mockApp: any;
  let mockServer: any;
  let mockTransport: any;

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockServer = {
      setRequestHandler: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn()
    };
    
    mockTransport = {
      handleRequest: vi.fn().mockImplementation(async (req, res) => {
        // Simulate what the transport does
        const sessionId = req.headers['mcp-session-id'] || req.headers['x-session-id'];
        if (!sessionId) {
          // This is an init request, set the session ID
          const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          res.setHeader('mcp-session-id', newSessionId);
          res.setHeader('x-session-id', newSessionId);
        }
      }),
      close: vi.fn()
    };
    
    vi.mocked(Server).mockImplementation(() => mockServer);
    vi.mocked(StreamableHTTPServerTransport).mockImplementation((options: any) => {
      // Call the sessionIdGenerator if provided
      if (options?.sessionIdGenerator) {
        const sessionId = options.sessionIdGenerator();
        // Modify handleRequest to set the session ID headers
        mockTransport.handleRequest = vi.fn().mockImplementation(async (req, res) => {
          res.setHeader('mcp-session-id', sessionId);
          res.setHeader('x-session-id', sessionId);
        });
      }
      return mockTransport;
    });
    
    mockApp = {
      all: vi.fn()
    };
    
    handler = new MCPHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should set up cleanup interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      new MCPHandler();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
    });
  });

  describe('setupRoutes', () => {
    it('should set up routes on the Express app', async () => {
      await handler.setupRoutes(mockApp);
      
      expect(mockApp.all).toHaveBeenCalledWith(
        '/mcp',
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('getServerForSession', () => {
    it('should return undefined for non-existent session', () => {
      const server = handler.getServerForSession('non-existent');
      expect(server).toBeUndefined();
    });

    it('should return server for existing session', async () => {
      // First create a session without session ID to trigger new session creation
      const req: any = {
        method: 'POST',
        headers: {}
      };
      
      const res: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false
      };

      // Setup routes first
      await handler.setupRoutes(mockApp);
      
      // Get the request handler
      const routeHandler = mockApp.all.mock.calls[0][4];
      
      // Handle request to create session
      await routeHandler(req, res);
      
      // Get the session ID that was generated
      const sessionId = res.setHeader.mock.calls.find((call: any) => call[0] === 'mcp-session-id')?.[1];
      
      // Now test that we can retrieve the server for this session
      const server = handler.getServerForSession(sessionId);
      expect(server).toBeDefined();
      expect(server).toBe(mockServer);
    });
  });

  describe('getAllServers', () => {
    it('should return empty array when no sessions exist', () => {
      const servers = handler.getAllServers();
      expect(servers).toEqual([]);
    });
  });

  describe('getServer', () => {
    it('should return new server when no sessions exist', () => {
      const server = handler.getServer();
      expect(server).toBeDefined();
      expect(vi.mocked(Server)).toHaveBeenCalled();
    });

    it('should return existing server when sessions exist', async () => {
      // Create a session first
      const req: any = {
        method: 'POST',
        headers: {}
      };
      
      const res: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false
      };

      await handler.setupRoutes(mockApp);
      const routeHandler = mockApp.all.mock.calls[0][4];
      
      
      await routeHandler(req, res);
      
      const server = handler.getServer();
      expect(server).toBe(mockServer);
    });
  });

  describe('cleanupSession', () => {
    it('should remove session from sessions map', async () => {
      // Create a session first
      const req: any = {
        method: 'POST',
        headers: {}
      };
      
      const res: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false
      };

      await handler.setupRoutes(mockApp);
      const routeHandler = mockApp.all.mock.calls[0][4];
      
      
      await routeHandler(req, res);
      
      // Get the generated session ID from response headers
      const sessionId = res.setHeader.mock.calls.find((call: any) => call[0] === 'mcp-session-id')?.[1];
      
      expect(handler.getActiveSessionCount()).toBe(1);
      
      handler.cleanupSession(sessionId);
      
      expect(handler.getActiveSessionCount()).toBe(0);
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return 0 when no sessions exist', () => {
      expect(handler.getActiveSessionCount()).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should clear cleanup interval', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      handler.shutdown();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    it('should create new session for request without session ID', async () => {
      const req: any = {
        method: 'POST',
        headers: {}
      };
      
      const res: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false
      };

      await handler.setupRoutes(mockApp);
      const routeHandler = mockApp.all.mock.calls[0][4];
      
      
      await routeHandler(req, res);
      
      expect(res.setHeader).toHaveBeenCalledWith('mcp-session-id', expect.stringContaining('session_'));
      expect(res.setHeader).toHaveBeenCalledWith('x-session-id', expect.stringContaining('session_'));
      expect(handler.getActiveSessionCount()).toBe(1);
    });

    it('should reuse existing session for request with session ID', async () => {
      // First create a session
      const req1: any = {
        method: 'POST',
        headers: {}
      };
      
      const res1: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false
      };

      await handler.setupRoutes(mockApp);
      const routeHandler = mockApp.all.mock.calls[0][4];
      
      // First request creates session
      await routeHandler(req1, res1);
      const countAfterFirst = handler.getActiveSessionCount();
      
      // Get the generated session ID
      const sessionId = res1.setHeader.mock.calls.find((call: any) => call[0] === 'mcp-session-id')?.[1];
      
      // Second request with the same session ID
      const req2: any = {
        method: 'POST',
        headers: {
          'mcp-session-id': sessionId
        }
      };
      
      const res2: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false
      };
      
      // Second request reuses session
      await routeHandler(req2, res2);
      const countAfterSecond = handler.getActiveSessionCount();
      
      expect(countAfterFirst).toBe(1);
      expect(countAfterSecond).toBe(1);
    });

    it('should clean up old sessions', async () => {
      // Mock Date.now() to control time
      const originalDateNow = Date.now;
      let mockTime = originalDateNow();
      Date.now = vi.fn(() => mockTime);
      
      // Create a session
      const req: any = {
        method: 'POST',
        headers: {}
      };
      
      const res: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false
      };

      await handler.setupRoutes(mockApp);
      const routeHandler = mockApp.all.mock.calls[0][4];
      
      await routeHandler(req, res);
      
      expect(handler.getActiveSessionCount()).toBe(1);
      
      // Advance mock time beyond session timeout
      mockTime += 61 * 60 * 1000;
      
      // Advance timers to trigger cleanup interval
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      // Cleanup should have been triggered
      expect(handler.getActiveSessionCount()).toBe(0);
      
      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('request handlers', () => {
    it('should register all required request handlers', async () => {
      // Creating the handler will create a server and register handlers
      const newHandler = new MCPHandler();
      
      // The createServer method is called when a new session is created
      // Let's trigger it by making a request
      const req: any = {
        method: 'POST',
        headers: {}
      };
      
      const res: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false
      };

      await newHandler.setupRoutes(mockApp);
      const routeHandler = mockApp.all.mock.calls[0][4];
      
      // This will trigger createServer
      await routeHandler(req, res);
      
      // Now check if handlers were registered
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(8);
      
      const handlerCalls = mockServer.setRequestHandler.mock.calls;
      const schemas = handlerCalls.map((call: any) => call[0]);
      
      expect(schemas.length).toBe(8);
    });
  });

  describe('error handling', () => {

    it('should handle non-existent session', async () => {
      const req: any = {
        method: 'POST',
        headers: {
          'mcp-session-id': 'non-existent-session'
        }
      };
      
      const res: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler.setupRoutes(mockApp);
      const routeHandler = mockApp.all.mock.calls[0][4];
      
      await routeHandler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Session not found'
        },
        id: null
      });
    });

    it('should handle transport errors', async () => {
      const req: any = {
        method: 'POST',
        headers: {}
      };
      
      const res: any = {
        header: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        headersSent: false
      };

      // Override the transport mock to throw an error
      vi.mocked(StreamableHTTPServerTransport).mockImplementationOnce((options: any) => {
        const errorTransport = {
          handleRequest: vi.fn().mockRejectedValue(new Error('Transport error')),
          close: vi.fn()
        };
        // Call the sessionIdGenerator if provided
        if (options?.sessionIdGenerator) {
          options.sessionIdGenerator();
        }
        return errorTransport;
      });

      await handler.setupRoutes(mockApp);
      const routeHandler = mockApp.all.mock.calls[0][4];
      
      await routeHandler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error'
        },
        id: null
      });
    });
  });
});

describe('Global MCP Handler instance', () => {
  it('should set and get MCP handler instance', () => {
    const handler = new MCPHandler();
    
    setMCPHandlerInstance(handler);
    
    const retrievedHandler = getMCPHandlerInstance();
    expect(retrievedHandler).toBe(handler);
  });

  it('should return null when no instance is set', () => {
    // Reset the global instance
    setMCPHandlerInstance(null as any);
    
    const handler = getMCPHandlerInstance();
    expect(handler).toBeNull();
  });
});