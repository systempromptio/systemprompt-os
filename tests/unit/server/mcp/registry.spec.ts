/**
 * @fileoverview Unit tests for MCP Server Registry
 * @module tests/unit/server/mcp/registry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { 
  McpServerRegistry, 
  initializeMcpServerRegistry, 
  getMcpServerRegistry 
} from '../../../../src/server/mcp/registry.js';
import { 
  McpServerTypeEnum, 
  type ILocalMcpServer, 
  type IRemoteMcpServer,
  type McpServer
} from '../../../../src/server/mcp/types.js';
import { DEFAULT_PROXY_TIMEOUT } from '../../../../src/server/constants/mcp.constants.js';

// Mock dependencies
vi.mock('../../../../src/server/mcp/auth-adapter', () => ({
  mcpAuthAdapter: vi.fn((_req: any, _res: any, next: any) => next())
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock global fetch
global.fetch = vi.fn();

// Mock Response constructor for Node.js environment
if (!global.Response) {
  (global as any).Response = class MockResponse {
    body: string;
    status: number;
    headers: Map<string, string>;
    
    constructor(body: string, init?: { status?: number; headers?: any }) {
      this.body = body;
      this.status = init?.status || 200;
      this.headers = new Map();
      
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value: string, key: string) => {
            this.headers.set(key, value);
          });
        } else {
          Object.entries(init.headers).forEach(([key, value]) => {
            this.headers.set(key, value as string);
          });
        }
      }
    }
    
    async text() {
      return this.body;
    }
  };
}

// Mock Headers if needed
if (!global.Headers) {
  (global as any).Headers = Map;
}

describe('McpServerRegistry', () => {
  let registry: McpServerRegistry;
  let mockApp: any;
  let mockLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    
    registry = new McpServerRegistry();
    
    // Mock Express app
    mockApp = {
      all: vi.fn(),
      get: vi.fn()
    };
    
    // Get mock logger instance
    const { LoggerService } = vi.mocked(await import('../../../../src/modules/core/logger/index'));
    mockLogger = LoggerService.getInstance();
    
    // Setup mock timers for timeout tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('registerServer', () => {
    it('should register a local server successfully', async () => {
      const server: LocalMCPServer = {
        id: 'test-local',
        name: 'Test Local Server',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        description: 'Test server',
        createHandler: vi.fn()
      };

      await registry.registerServer(server);

      expect(registry.getServer('test-local')).toBe(server);
    });

    it('should register a remote server successfully', async () => {
      const server: RemoteMCPServer = {
        id: 'test-remote',
        name: 'Test Remote Server',
        type: MCPServerType.REMOTE,
        version: '1.0.0',
        description: 'Remote test server',
        config: {
          url: 'http://remote.example.com/mcp'
        }
      };

      await registry.registerServer(server);

      expect(registry.getServer('test-remote')).toBe(server);
    });

    it('should throw error when registering duplicate server ID', async () => {
      const server: LocalMCPServer = {
        id: 'duplicate',
        name: 'Duplicate Server',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn()
      };

      await registry.registerServer(server);
      
      await expect(registry.registerServer(server)).rejects.toThrow(
        "Server with ID 'duplicate' is already registered"
      );
    });
  });

  describe('setupRoutes', () => {
    it('should setup routes for registered servers', async () => {
      const mockHandler = vi.fn();
      const localServer: LocalMCPServer = {
        id: 'test-server',
        name: 'Test Server',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: () => mockHandler
      };

      await registry.registerServer(localServer);
      await registry.setupRoutes(mockApp);

      expect(mockApp.all).toHaveBeenCalledWith(
        '/mcp/test-server',
        expect.any(Function),
        mockHandler
      );
      expect(mockApp.get).toHaveBeenCalledWith(
        '/mcp/status',
        expect.any(Function)
      );
    });

    it('should setup core server at both /mcp/core and /mcp', async () => {
      const mockHandler = vi.fn();
      const coreServer: LocalMCPServer = {
        id: 'core',
        name: 'Core Server',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: () => mockHandler
      };

      await registry.registerServer(coreServer);
      await registry.setupRoutes(mockApp);

      expect(mockApp.all).toHaveBeenCalledWith(
        '/mcp/core',
        expect.any(Function),
        mockHandler
      );
      expect(mockApp.all).toHaveBeenCalledWith(
        '/mcp',
        expect.any(Function),
        mockHandler
      );
    });

    it('should setup proxy routes for remote servers', async () => {
      const remoteServer: RemoteMCPServer = {
        id: 'remote',
        name: 'Remote Server',
        type: MCPServerType.REMOTE,
        version: '1.0.0',
        config: {
          url: 'http://remote.example.com/mcp'
        }
      };

      await registry.registerServer(remoteServer);
      await registry.setupRoutes(mockApp);

      expect(mockApp.all).toHaveBeenCalledWith(
        '/mcp/remote',
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('status handling', () => {
    it('should return server statuses', async () => {
      const localServer: LocalMCPServer = {
        id: 'local',
        name: 'Local Server',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn(),
        getActiveSessionCount: vi.fn().mockReturnValue(5)
      };

      const remoteServer: RemoteMCPServer = {
        id: 'remote',
        name: 'Remote Server',
        type: MCPServerType.REMOTE,
        version: '2.0.0',
        config: {
          url: 'http://remote.example.com'
        }
      };

      await registry.registerServer(localServer);
      await registry.registerServer(remoteServer);

      const statuses = await registry.getServerStatuses();

      expect(statuses.size).toBe(2);
      
      const localStatus = statuses.get('local');
      expect(localStatus).toMatchObject({
        id: 'local',
        name: 'Local Server',
        status: 'running',
        version: '1.0.0',
        type: MCPServerType.LOCAL,
        transport: 'http',
        sessions: 5
      });

      const remoteStatus = statuses.get('remote');
      expect(remoteStatus).toMatchObject({
        id: 'remote',
        name: 'Remote Server',
        status: 'running',
        version: '2.0.0',
        type: MCPServerType.REMOTE,
        transport: 'http',
        sessions: 0,
        url: 'http://remote.example.com'
      });
    });

    it('should handle status endpoint', async () => {
      const server: LocalMCPServer = {
        id: 'test',
        name: 'Test Server',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn()
      };

      await registry.registerServer(server);
      await registry.setupRoutes(mockApp);

      // Get the status handler
      const statusHandler = mockApp.get.mock.calls.find(
        call => call[0] === '/mcp/status'
      )?.[1];

      expect(statusHandler).toBeDefined();

      // Test the handler
      const mockReq = {} as Request;
      const mockRes = {
        json: vi.fn()
      } as unknown as Response;

      await statusHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        servers: expect.objectContaining({
          test: expect.objectContaining({
            id: 'test',
            name: 'Test Server',
            status: 'running'
          })
        })
      });
    });
  });

  describe('proxy handling', () => {
    it('should forward requests to remote servers', async () => {
      const mockResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        text: vi.fn().mockResolvedValue(JSON.stringify({ result: 'success' }))
      };
      
      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const remoteServer: RemoteMCPServer = {
        id: 'remote',
        name: 'Remote Server',
        type: MCPServerType.REMOTE,
        version: '1.0.0',
        config: {
          url: 'http://remote.example.com/mcp',
          headers: { 'X-Custom': 'value' }
        }
      };

      await registry.registerServer(remoteServer);
      await registry.setupRoutes(mockApp);

      // Get the proxy handler
      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'POST',
        body: { jsonrpc: '2.0', method: 'test', id: 1 }
      } as unknown as Request;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        send: vi.fn()
      } as unknown as Response;

      await proxyHandler(mockReq, mockRes);

      expect(global.fetch).toHaveBeenCalledWith('http://remote.example.com/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom': 'value'
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'test', id: 1 }),
        signal: expect.any(AbortSignal)
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('{"result":"success"}');
    });

    it('should handle proxy timeouts', async () => {
      vi.mocked(global.fetch).mockRejectedValue(
        Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
      );

      const remoteServer: RemoteMCPServer = {
        id: 'remote',
        name: 'Remote Server',
        type: MCPServerType.REMOTE,
        version: '1.0.0',
        config: {
          url: 'http://remote.example.com/mcp',
          timeout: 5000
        }
      };

      await registry.registerServer(remoteServer);
      await registry.setupRoutes(mockApp);

      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'POST',
        body: { id: 1 }
      } as unknown as Request;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await proxyHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(504);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Request to remote server timed out after 5000ms'
        },
        id: 1
      });
    });

    it('should handle proxy errors', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const remoteServer: RemoteMCPServer = {
        id: 'remote',
        name: 'Remote Server',
        type: MCPServerType.REMOTE,
        version: '1.0.0',
        config: {
          url: 'http://remote.example.com/mcp'
        }
      };

      await registry.registerServer(remoteServer);
      await registry.setupRoutes(mockApp);

      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'POST',
        body: { id: 1 }
      } as unknown as Request;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      await proxyHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(502);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Failed to proxy request to remote server: Network error'
        },
        id: 1
      });
    });

    it('should handle authentication headers', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        status: 200,
        headers: new Map(),
        text: vi.fn().mockResolvedValue('{}')
      } as any);

      const remoteServer: RemoteMCPServer = {
        id: 'remote',
        name: 'Remote Server',
        type: MCPServerType.REMOTE,
        version: '1.0.0',
        config: {
          url: 'http://remote.example.com/mcp',
          auth: {
            type: 'bearer',
            token: 'secret-token'
          }
        }
      };

      await registry.registerServer(remoteServer);
      await registry.setupRoutes(mockApp);

      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'GET'
      } as unknown as Request;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        send: vi.fn()
      } as unknown as Response;

      await proxyHandler(mockReq, mockRes);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://remote.example.com/mcp',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer secret-token'
          })
        })
      );
    });

    it('should handle basic authentication', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        status: 200,
        headers: new Map(),
        text: vi.fn().mockResolvedValue('{}')
      } as any);

      const remoteServer: RemoteMCPServer = {
        id: 'remote',
        name: 'Remote Server',
        type: MCPServerType.REMOTE,
        version: '1.0.0',
        config: {
          url: 'http://remote.example.com/mcp',
          auth: {
            type: 'basic',
            username: 'user',
            password: 'pass'
          }
        }
      };

      await registry.registerServer(remoteServer);
      await registry.setupRoutes(mockApp);

      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'GET'
      } as unknown as Request;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        send: vi.fn()
      } as unknown as Response;

      await proxyHandler(mockReq, mockRes);

      const expectedAuth = Buffer.from('user:pass').toString('base64');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://remote.example.com/mcp',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Basic ${expectedAuth}`
          })
        })
      );
    });
  });

  describe('server management', () => {
    it('should get all servers', async () => {
      const server1: LocalMCPServer = {
        id: 'server1',
        name: 'Server 1',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn()
      };

      const server2: RemoteMCPServer = {
        id: 'server2',
        name: 'Server 2',
        type: MCPServerType.REMOTE,
        version: '2.0.0',
        config: { url: 'http://example.com' }
      };

      await registry.registerServer(server1);
      await registry.registerServer(server2);

      const servers = registry.getAllServers();
      expect(servers).toHaveLength(2);
      expect(servers).toContain(server1);
      expect(servers).toContain(server2);
    });

    it('should get server count', async () => {
      expect(registry.getServerCount()).toBe(0);

      await registry.registerServer({
        id: 'test',
        name: 'Test',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn()
      });

      expect(registry.getServerCount()).toBe(1);
    });

    it('should return undefined for non-existent server', () => {
      expect(registry.getServer('non-existent')).toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown all local servers', async () => {
      const shutdownFn1 = vi.fn().mockResolvedValue(undefined);
      const shutdownFn2 = vi.fn().mockResolvedValue(undefined);

      const server1: LocalMCPServer = {
        id: 'server1',
        name: 'Server 1',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn(),
        shutdown: shutdownFn1
      };

      const server2: LocalMCPServer = {
        id: 'server2',
        name: 'Server 2',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn(),
        shutdown: shutdownFn2
      };

      const remoteServer: RemoteMCPServer = {
        id: 'remote',
        name: 'Remote Server',
        type: MCPServerType.REMOTE,
        version: '1.0.0',
        config: { url: 'http://example.com' }
      };

      await registry.registerServer(server1);
      await registry.registerServer(server2);
      await registry.registerServer(remoteServer);

      await registry.shutdown();

      expect(shutdownFn1).toHaveBeenCalled();
      expect(shutdownFn2).toHaveBeenCalled();
      expect(registry.getServerCount()).toBe(0);
    });

    it('should handle shutdown errors gracefully', async () => {
      const shutdownFn = vi.fn().mockRejectedValue(new Error('Shutdown failed'));

      const server: LocalMCPServer = {
        id: 'server',
        name: 'Server',
        type: MCPServerType.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn(),
        shutdown: shutdownFn
      };

      await registry.registerServer(server);
      
      // Should not throw
      await expect(registry.shutdown()).resolves.not.toThrow();
      expect(shutdownFn).toHaveBeenCalled();
    });
  });

  describe('singleton pattern', () => {
    beforeEach(() => {
      // Clear any existing module cache to ensure fresh module state
      vi.resetModules();
    });

    it('should initialize registry singleton', async () => {
      const { initializeMCPServerRegistry } = await import('../../../../src/server/mcp/registry');
      
      const registry1 = initializeMCPServerRegistry();
      const registry2 = initializeMCPServerRegistry();
      
      expect(registry1).toBe(registry2);
    });

    it('should get existing registry', async () => {
      const { initializeMCPServerRegistry, getMCPServerRegistry } = await import('../../../../src/server/mcp/registry');
      
      const initialized = initializeMCPServerRegistry();
      const retrieved = getMCPServerRegistry();
      
      expect(retrieved).toBe(initialized);
    });

    it('should throw error when getting registry before initialization', async () => {
      // Import fresh module instance
      const { getMCPServerRegistry: getRegistry } = await import('../../../../src/server/mcp/registry');
      
      expect(() => getRegistry()).toThrow(
        'MCP Server Registry not initialized'
      );
    });
  });
});