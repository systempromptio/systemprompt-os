import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { createMCPServer, CoreMcpServer as CoreMCPServer } from '../../../../../src/server/mcp/remote/core-server.js';
import type { IServerConfig } from '../../../../../src/server/mcp/remote/types.js';
import { HTTP_INTERNAL_SERVER_ERROR, HTTP_NOT_FOUND } from '../../../../../src/modules/core/auth/constants/index.js';

// Mock the logger
vi.mock('../../../../../src/modules/core/logger/index.js', () => ({
  LoggerService: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn()
    }))
  },
  LogSource: {
    MCP: 'MCP'
  }
}));

// Mock the handlers
vi.mock('../../../../../src/server/mcp/core/handlers/tool-handlers.js', () => ({
  handleListTools: vi.fn(),
  handleToolCall: vi.fn()
}));

vi.mock('../../../../../src/server/mcp/core/handlers/prompt-handlers.js', () => ({
  handleGetPrompt: vi.fn(),
  handleListPrompts: vi.fn()
}));

vi.mock('../../../../../src/server/mcp/core/handlers/resource-handlers.js', () => ({
  handleListResources: vi.fn(),
  handleResourceCall: vi.fn()
}));

// Mock the MCP SDK
const mockTransport = {
  handleRequest: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined)
};

const mockServer = {
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  setRequestHandler: vi.fn()
};

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(() => mockTransport)
}));

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => mockServer)
}));

describe('MCPServer', () => {
  let server: CoreMCPServer;

  beforeEach(() => {
    server = createMCPServer();
  });

  afterEach(() => {
    if (server && typeof server.shutdown === 'function') {
      server.shutdown();
    }
  });

  describe('initialization', () => {
    it('should create server with correct metadata', () => {
      // Assert
      expect(server).toBeDefined();
      expect(server.name).toBe('systemprompt-os-core');
      expect(server.version).toBe('0.1.0');
    });

    it('should initialize with empty session state', () => {
      // Assert
      expect(server.getActiveSessionCount()).toBe(0);
    });

    it('should expose required session management methods', () => {
      // Assert
      expect(server.handleRequest).toBeInstanceOf(Function);
      expect(server.shutdown).toBeInstanceOf(Function);
      expect(server.getActiveSessionCount).toBeInstanceOf(Function);
      expect(server.getSessionStats).toBeInstanceOf(Function);
    });

    it('should create server with custom config', () => {
      // Arrange
      const customConfig: IServerConfig = {
        name: 'custom-server',
        version: '1.0.0',
        sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
        cleanupIntervalMs: 2 * 60 * 1000,  // 2 minutes
      };

      // Act
      const customServer = createMCPServer(customConfig);

      // Assert
      expect(customServer.name).toBe('custom-server');
      expect(customServer.version).toBe('1.0.0');
      
      // Cleanup
      customServer.shutdown();
    });

    it('should create server with partial config', () => {
      // Arrange
      const partialConfig: IServerConfig = {
        name: 'partial-server',
      };

      // Act
      const partialServer = createMCPServer(partialConfig);

      // Assert
      expect(partialServer.name).toBe('partial-server');
      expect(partialServer.version).toBe('0.1.0'); // Default value
      
      // Cleanup
      partialServer.shutdown();
    });

    it('should start session cleanup on initialization', () => {
      // Arrange
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      // Act
      const newServer = createMCPServer();
      
      // Assert
      expect(setIntervalSpy).toHaveBeenCalled();
      
      // Cleanup
      newServer.shutdown();
      setIntervalSpy.mockRestore();
    });
  });

  describe('session management', () => {
    const createMockSession = (sessionId: string, createdTime = new Date()) => ({
      server: {
        close: vi.fn()
      },
      transport: {
        close: vi.fn()
      },
      createdAt: createdTime,
      lastAccessed: createdTime
    });

    it('should track active sessions correctly', () => {
      // Arrange
      const sessionId = 'test-session-123';
      const mockSession = createMockSession(sessionId);

      // Act - Access private sessions map
      (server as any).sessions.set(sessionId, mockSession);

      // Assert
      expect(server.getActiveSessionCount()).toBe(1);
      expect((server as any).sessions.has(sessionId)).toBe(true);
    });

    it('should clean up old sessions', () => {
      // Arrange
      const oldSession = {
        server: { close: vi.fn().mockResolvedValue(undefined) },
        transport: { close: vi.fn().mockResolvedValue(undefined) },
        createdAt: new Date(Date.now() - 65 * 60 * 1000),
        lastAccessed: new Date(Date.now() - 65 * 60 * 1000) // 65 minutes ago (older than 1 hour timeout)
      };
      const newSession = {
        server: { close: vi.fn().mockResolvedValue(undefined) },
        transport: { close: vi.fn().mockResolvedValue(undefined) },
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      (server as any).sessions.set('old-session', oldSession);
      (server as any).sessions.set('new-session', newSession);

      // Act
      (server as any).cleanupExpiredSessions();

      // Assert
      expect((server as any).sessions.has('old-session')).toBe(false);
      expect((server as any).sessions.has('new-session')).toBe(true);
      expect(server.getActiveSessionCount()).toBe(1);
      expect(oldSession.server.close).toHaveBeenCalled();
      expect(oldSession.transport.close).toHaveBeenCalled();
    });
  });

  describe('getSessionStats', () => {
    it('should return empty array when no sessions exist', () => {
      // Act
      const stats = server.getSessionStats();

      // Assert
      expect(stats).toEqual([]);
    });

    it('should return session statistics for active sessions', () => {
      // Arrange
      const now = new Date();
      const mockSession = {
        server: { close: vi.fn() },
        transport: { close: vi.fn() },
        createdAt: now,
        lastAccessed: now
      };

      (server as any).sessions.set('test-session', mockSession);

      // Act
      const stats = server.getSessionStats();

      // Assert
      expect(stats).toHaveLength(1);
      expect(stats[0]).toMatchObject({
        sessionId: 'test-session',
        createdAt: now,
        lastAccessed: now,
      });
      expect(typeof stats[0].age).toBe('number');
      expect(stats[0].age).toBeGreaterThanOrEqual(0);
    });
  });

  describe('handleRequest', () => {
    let mockReq: Partial<ExpressRequest>;
    let mockRes: Partial<ExpressResponse>;

    beforeEach(() => {
      mockReq = {
        headers: {},
        body: {}
      };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
        headersSent: false
      };
      
      // Clear previous calls on global mocks
      mockTransport.handleRequest.mockClear();
      mockServer.connect.mockClear();
    });

    it('should handle new session creation when no session ID provided', async () => {
      // Arrange
      const generateSessionIdSpy = vi.spyOn(server as any, 'generateSessionId').mockReturnValue('new-session-123');
      const createServerSpy = vi.spyOn(server as any, 'createServer');
      
      // Ensure clean request object with no session headers
      mockReq.headers = {};

      // Act & Assert - Should not throw
      await expect(server.handleRequest(mockReq as ExpressRequest, mockRes as ExpressResponse)).resolves.not.toThrow();

      // Assert - Check that new session flow was followed
      expect(generateSessionIdSpy).toHaveBeenCalled();
      expect(createServerSpy).toHaveBeenCalledWith('new-session-123', undefined);
      
      // Cleanup  
      generateSessionIdSpy.mockRestore();
      createServerSpy.mockRestore();
    });

    it('should handle existing session when valid session ID provided', async () => {
      // Arrange
      const sessionId = 'existing-session';
      const mockSessionInfo = {
        server: { close: vi.fn() },
        transport: { 
          handleRequest: vi.fn().mockResolvedValue(undefined),
          close: vi.fn()
        },
        createdAt: new Date(),
        lastAccessed: new Date(Date.now() - 1000) // 1 second ago
      };

      (server as any).sessions.set(sessionId, mockSessionInfo);
      mockReq.headers = { 'mcp-session-id': sessionId };

      // Act
      await server.handleRequest(mockReq as ExpressRequest, mockRes as ExpressResponse);

      // Assert
      expect(mockSessionInfo.transport.handleRequest).toHaveBeenCalledWith(mockReq, mockRes, mockReq.body);
      expect(mockSessionInfo.lastAccessed.getTime()).toBeGreaterThan(Date.now() - 100); // Recently updated
    });

    it('should handle alternative session ID header', async () => {
      // Arrange
      const sessionId = 'alt-session';
      const mockSessionInfo = {
        server: { close: vi.fn() },
        transport: { 
          handleRequest: vi.fn().mockResolvedValue(undefined),
          close: vi.fn()
        },
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      (server as any).sessions.set(sessionId, mockSessionInfo);
      mockReq.headers = { 'x-session-id': sessionId };

      // Act
      await server.handleRequest(mockReq as ExpressRequest, mockRes as ExpressResponse);

      // Assert
      expect(mockSessionInfo.transport.handleRequest).toHaveBeenCalledWith(mockReq, mockRes, mockReq.body);
    });

    it('should return 404 for non-existent session', async () => {
      // Arrange
      mockReq.headers = { 'mcp-session-id': 'non-existent-session' };

      // Act
      await server.handleRequest(mockReq as ExpressRequest, mockRes as ExpressResponse);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(HTTP_NOT_FOUND);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Session not found',
        },
        id: null,
      });
    });

    it('should handle request errors and send error response', async () => {
      // Arrange
      const error = new Error('Test error');
      mockReq.headers = { 'mcp-session-id': 'error-session' };
      const mockSessionInfo = {
        server: { close: vi.fn() },
        transport: { 
          handleRequest: vi.fn().mockRejectedValue(error),
          close: vi.fn()
        },
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      (server as any).sessions.set('error-session', mockSessionInfo);

      // Act
      await server.handleRequest(mockReq as ExpressRequest, mockRes as ExpressResponse);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(HTTP_INTERNAL_SERVER_ERROR);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Test error',
        },
        id: null,
      });
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      const error = 'String error';
      mockReq.headers = { 'mcp-session-id': 'string-error-session' };
      const mockSessionInfo = {
        server: { close: vi.fn() },
        transport: { 
          handleRequest: vi.fn().mockRejectedValue(error),
          close: vi.fn()
        },
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      (server as any).sessions.set('string-error-session', mockSessionInfo);

      // Act
      await server.handleRequest(mockReq as ExpressRequest, mockRes as ExpressResponse);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(HTTP_INTERNAL_SERVER_ERROR);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
        },
        id: null,
      });
    });

    it('should not send error response if headers already sent', async () => {
      // Arrange
      const error = new Error('Test error');
      mockReq.headers = { 'mcp-session-id': 'headers-sent-session' };
      mockRes.headersSent = true;
      
      const mockSessionInfo = {
        server: { close: vi.fn() },
        transport: { 
          handleRequest: vi.fn().mockRejectedValue(error),
          close: vi.fn()
        },
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      (server as any).sessions.set('headers-sent-session', mockSessionInfo);

      // Act
      await server.handleRequest(mockReq as ExpressRequest, mockRes as ExpressResponse);

      // Assert
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should extract user ID from request and pass to createServer', async () => {
      // Arrange
      const userId = 'user-123';
      mockReq = {
        ...mockReq,
        user: { sub: userId }
      } as any;

      const generateSessionIdSpy = vi.spyOn(server as any, 'generateSessionId').mockReturnValue('new-session-456');
      const createServerSpy = vi.spyOn(server as any, 'createServer');
      
      // Clear previous calls
      mockTransport.handleRequest.mockClear();

      // Act
      await server.handleRequest(mockReq as ExpressRequest, mockRes as ExpressResponse);

      // Assert
      expect(createServerSpy).toHaveBeenCalledWith('new-session-456', userId);
      
      // Cleanup
      generateSessionIdSpy.mockRestore();
      createServerSpy.mockRestore();
    });

    it('should handle empty session ID headers', async () => {
      // Arrange
      mockReq.headers = { 'mcp-session-id': '' };
      const generateSessionIdSpy = vi.spyOn(server as any, 'generateSessionId').mockReturnValue('empty-session-123');
      const createServerSpy = vi.spyOn(server as any, 'createServer');
      
      // Clear previous calls
      mockTransport.handleRequest.mockClear();

      // Act
      await server.handleRequest(mockReq as ExpressRequest, mockRes as ExpressResponse);

      // Assert
      expect(createServerSpy).toHaveBeenCalledWith('empty-session-123', undefined);
      
      // Cleanup
      generateSessionIdSpy.mockRestore();
      createServerSpy.mockRestore();
    });
  });

  describe('private methods', () => {
    describe('generateSessionId', () => {
      it('should generate unique session IDs', () => {
        // Act
        const id1 = (server as any).generateSessionId();
        const id2 = (server as any).generateSessionId();

        // Assert
        expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
        expect(id2).toMatch(/^session_\d+_[a-z0-9]+$/);
        expect(id1).not.toBe(id2);
      });
    });

    describe('terminateSession', () => {
      it('should terminate session and clean up resources', () => {
        // Arrange
        const sessionId = 'test-terminate';
        const mockSessionInfo = {
          server: { close: vi.fn().mockResolvedValue(undefined) },
          transport: { close: vi.fn().mockResolvedValue(undefined) },
          createdAt: new Date(),
          lastAccessed: new Date()
        };
        
        (server as any).sessions.set(sessionId, mockSessionInfo);

        // Act
        (server as any).terminateSession(sessionId, mockSessionInfo);

        // Assert
        expect(mockSessionInfo.server.close).toHaveBeenCalled();
        expect(mockSessionInfo.transport.close).toHaveBeenCalled();
        expect((server as any).sessions.has(sessionId)).toBe(false);
      });

      it('should handle errors during session termination', () => {
        // Arrange
        const sessionId = 'error-terminate';
        const mockSessionInfo = {
          server: { close: vi.fn().mockRejectedValue(new Error('Close error')) },
          transport: { close: vi.fn().mockResolvedValue(undefined) },
          createdAt: new Date(),
          lastAccessed: new Date()
        };
        
        (server as any).sessions.set(sessionId, mockSessionInfo);

        // Act & Assert - Should not throw
        expect(() => {
          (server as any).terminateSession(sessionId, mockSessionInfo);
        }).not.toThrow();

        // Session should still be removed despite error
        expect((server as any).sessions.has(sessionId)).toBe(false);
      });
    });

    describe('extractSessionId', () => {
      it('should extract session ID from mcp-session-id header', () => {
        // Arrange
        const mockReq = { headers: { 'mcp-session-id': 'test-session-123' } };

        // Act
        const sessionId = (server as any).extractSessionId(mockReq);

        // Assert
        expect(sessionId).toBe('test-session-123');
      });

      it('should extract session ID from x-session-id header as fallback', () => {
        // Arrange
        const mockReq = { headers: { 'x-session-id': 'fallback-session-456' } };

        // Act
        const sessionId = (server as any).extractSessionId(mockReq);

        // Assert
        expect(sessionId).toBe('fallback-session-456');
      });

      it('should prefer mcp-session-id over x-session-id', () => {
        // Arrange
        const mockReq = { 
          headers: { 
            'mcp-session-id': 'primary-session',
            'x-session-id': 'fallback-session'
          } 
        };

        // Act
        const sessionId = (server as any).extractSessionId(mockReq);

        // Assert
        expect(sessionId).toBe('primary-session');
      });

      it('should return undefined when no session headers present', () => {
        // Arrange
        const mockReq = { headers: {} };

        // Act
        const sessionId = (server as any).extractSessionId(mockReq);

        // Assert
        expect(sessionId).toBeUndefined();
      });
    });

    describe('cleanupExpiredSessions edge cases', () => {
      it('should handle sessions exactly at timeout threshold', () => {
        // Arrange - Sessions older than the timeout should be cleaned up
        const thresholdTime = new Date(Date.now() - (server as any).sessionTimeoutMs - 1); // Make it 1ms older than threshold
        const sessionAtThreshold = {
          server: { close: vi.fn().mockResolvedValue(undefined) },
          transport: { close: vi.fn().mockResolvedValue(undefined) },
          createdAt: new Date(),
          lastAccessed: thresholdTime
        };

        (server as any).sessions.set('threshold-session', sessionAtThreshold);

        // Act
        (server as any).cleanupExpiredSessions();

        // Assert - Sessions older than threshold should be cleaned up
        expect((server as any).sessions.has('threshold-session')).toBe(false);
        expect(sessionAtThreshold.server.close).toHaveBeenCalled();
      });

      it('should not clean up sessions just under timeout threshold', () => {
        // Arrange
        const justUnderThreshold = new Date(Date.now() - (server as any).sessionTimeoutMs + 1000);
        const sessionUnderThreshold = {
          server: { close: vi.fn() },
          transport: { close: vi.fn() },
          createdAt: new Date(),
          lastAccessed: justUnderThreshold
        };

        (server as any).sessions.set('under-threshold-session', sessionUnderThreshold);

        // Act
        (server as any).cleanupExpiredSessions();

        // Assert - Sessions under threshold should remain
        expect((server as any).sessions.has('under-threshold-session')).toBe(true);
        expect(sessionUnderThreshold.server.close).not.toHaveBeenCalled();
      });
    });
  });

  describe('shutdown', () => {
    it('should clear all sessions on shutdown', () => {
      // Arrange
      const session1 = {
        server: { close: vi.fn().mockResolvedValue(undefined) },
        transport: { close: vi.fn().mockResolvedValue(undefined) },
        createdAt: new Date(),
        lastAccessed: new Date()
      };
      const session2 = {
        server: { close: vi.fn().mockResolvedValue(undefined) },
        transport: { close: vi.fn().mockResolvedValue(undefined) },
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      (server as any).sessions.set('session-1', session1);
      (server as any).sessions.set('session-2', session2);

      // Act
      server.shutdown();

      // Assert
      expect((server as any).sessions.size).toBe(0);
      expect(server.getActiveSessionCount()).toBe(0);
      expect(session1.server.close).toHaveBeenCalled();
      expect(session1.transport.close).toHaveBeenCalled();
      expect(session2.server.close).toHaveBeenCalled();
      expect(session2.transport.close).toHaveBeenCalled();
    });

    it('should clear cleanup interval on shutdown', () => {
      // Arrange
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      // Create a new server to ensure interval is set
      const newServer = createMCPServer();
      
      // Act
      newServer.shutdown();

      // Assert
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });
});