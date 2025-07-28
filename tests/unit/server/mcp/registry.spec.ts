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

vi.mock('../../../../src/modules/core/logger/index', () => ({
  LoggerService: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }))
  },
  LogSource: {
    MCP: 'MCP'
  }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    // Setup mock timers for timeout tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('registerServer', () => {
    it('should register a local server successfully', async () => {
      const server: ILocalMcpServer = {
        id: 'test-local',
        name: 'Test Local Server',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        description: 'Test server',
        createHandler: vi.fn()
      };

      registry.registerServer(server);

      expect(registry.getServer('test-local')).toBe(server);
    });

    it('should register a remote server successfully', async () => {
      const server: IRemoteMcpServer = {
        id: 'test-remote',
        name: 'Test Remote Server',
        type: McpServerTypeEnum.REMOTE,
        version: '1.0.0',
        description: 'Remote test server',
        config: {
          name: 'Test Remote',
          url: 'http://remote.example.com/mcp'
        }
      };

      registry.registerServer(server);

      expect(registry.getServer('test-remote')).toBe(server);
    });

    it('should throw error when registering duplicate server ID', async () => {
      const server: ILocalMcpServer = {
        id: 'duplicate',
        name: 'Duplicate Server',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn()
      };

      registry.registerServer(server);
      
      expect(() => registry.registerServer(server)).toThrow(
        "Server with ID 'duplicate' is already registered"
      );
    });
  });

  describe('setupRoutes', () => {
    it('should setup routes for registered servers', async () => {
      const mockHandler = vi.fn();
      const localServer: ILocalMcpServer = {
        id: 'test-server',
        name: 'Test Server',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        createHandler: () => mockHandler
      };

      registry.registerServer(localServer);
      registry.setupRoutes(mockApp);

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
      const coreServer: ILocalMcpServer = {
        id: 'core',
        name: 'Core Server',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        createHandler: () => mockHandler
      };

      registry.registerServer(coreServer);
      registry.setupRoutes(mockApp);

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
      const remoteServer: IRemoteMcpServer = {
        id: 'remote',
        name: 'Remote Server',
        type: McpServerTypeEnum.REMOTE,
        version: '1.0.0',
        config: {
          name: 'Remote Server',
          url: 'http://remote.example.com/mcp'
        }
      };

      registry.registerServer(remoteServer);
      registry.setupRoutes(mockApp);

      expect(mockApp.all).toHaveBeenCalledWith(
        '/mcp/remote',
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('status handling', () => {
    it('should return server statuses', async () => {
      const localServer: ILocalMcpServer = {
        id: 'local',
        name: 'Local Server',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn(),
        getActiveSessionCount: vi.fn().mockReturnValue(5)
      };

      const remoteServer: IRemoteMcpServer = {
        id: 'remote',
        name: 'Remote Server',
        type: McpServerTypeEnum.REMOTE,
        version: '2.0.0',
        config: {
          name: 'Remote Server',
          url: 'http://remote.example.com'
        }
      };

      registry.registerServer(localServer);
      registry.registerServer(remoteServer);

      const statuses = registry.getServerStatuses();

      expect(statuses.size).toBe(2);
      
      const localStatus = statuses.get('local');
      expect(localStatus).toMatchObject({
        id: 'local',
        name: 'Local Server',
        status: 'running',
        version: '1.0.0',
        type: McpServerTypeEnum.LOCAL,
        transport: 'http',
        sessions: 5
      });

      const remoteStatus = statuses.get('remote');
      expect(remoteStatus).toMatchObject({
        id: 'remote',
        name: 'Remote Server',
        status: 'running',
        version: '2.0.0',
        type: McpServerTypeEnum.REMOTE,
        transport: 'http',
        sessions: 0,
        url: 'http://remote.example.com'
      });
    });

    it('should handle status endpoint', async () => {
      const server: ILocalMcpServer = {
        id: 'test',
        name: 'Test Server',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn()
      };

      registry.registerServer(server);
      registry.setupRoutes(mockApp);

      // Get the status handler
      const statusHandler = mockApp.get.mock.calls.find(
        call => call[0] === '/mcp/status'
      )?.[1];

      expect(statusHandler).toBeDefined();

      // Test the handler
      const mockReq = {} as ExpressRequest;
      const mockRes = {
        json: vi.fn()
      } as unknown as ExpressResponse;

      statusHandler(mockReq, mockRes);

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

      const remoteServer: IRemoteMcpServer = {
        id: 'remote',
        name: 'Remote Server',
        type: McpServerTypeEnum.REMOTE,
        version: '1.0.0',
        config: {
          name: 'Remote Server',
          url: 'http://remote.example.com/mcp',
          headers: { 'X-Custom': 'value' }
        }
      };

      registry.registerServer(remoteServer);
      registry.setupRoutes(mockApp);

      // Get the proxy handler
      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'POST',
        body: { jsonrpc: '2.0', method: 'test', id: 1 }
      } as unknown as ExpressRequest;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        send: vi.fn()
      } as unknown as ExpressResponse;

      await proxyHandler(mockReq, mockRes);

      expect(global.fetch).toHaveBeenCalledWith('http://remote.example.com/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
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

      const remoteServer: IRemoteMcpServer = {
        id: 'remote',
        name: 'Remote Server',
        type: McpServerTypeEnum.REMOTE,
        version: '1.0.0',
        config: {
          name: 'Remote Server',
          url: 'http://remote.example.com/mcp',
          timeout: 5000
        }
      };

      registry.registerServer(remoteServer);
      registry.setupRoutes(mockApp);

      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'POST',
        body: { id: 1 }
      } as unknown as ExpressRequest;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as ExpressResponse;

      await proxyHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(504);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Request to remote server timed out after 5000ms'
        },
        id: null
      });
    });

    it('should handle proxy errors', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const remoteServer: IRemoteMcpServer = {
        id: 'remote',
        name: 'Remote Server',
        type: McpServerTypeEnum.REMOTE,
        version: '1.0.0',
        config: {
          name: 'Remote Server',
          url: 'http://remote.example.com/mcp'
        }
      };

      registry.registerServer(remoteServer);
      registry.setupRoutes(mockApp);

      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'POST',
        body: { id: 1 }
      } as unknown as ExpressRequest;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as ExpressResponse;

      await proxyHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(502);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Failed to proxy request to remote server: Network error'
        },
        id: null
      });
    });

    it('should handle authentication headers', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        status: 200,
        headers: new Map(),
        text: vi.fn().mockResolvedValue('{}')
      } as any);

      const remoteServer: IRemoteMcpServer = {
        id: 'remote',
        name: 'Remote Server',
        type: McpServerTypeEnum.REMOTE,
        version: '1.0.0',
        config: {
          name: 'Remote Server',
          url: 'http://remote.example.com/mcp',
          auth: {
            type: 'bearer',
            token: 'secret-token'
          }
        }
      };

      registry.registerServer(remoteServer);
      registry.setupRoutes(mockApp);

      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'GET'
      } as unknown as ExpressRequest;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        send: vi.fn()
      } as unknown as ExpressResponse;

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

      const remoteServer: IRemoteMcpServer = {
        id: 'remote',
        name: 'Remote Server',
        type: McpServerTypeEnum.REMOTE,
        version: '1.0.0',
        config: {
          name: 'Remote Server',
          url: 'http://remote.example.com/mcp',
          auth: {
            type: 'basic',
            username: 'user',
            password: 'pass'
          }
        }
      };

      registry.registerServer(remoteServer);
      registry.setupRoutes(mockApp);

      const proxyHandler = mockApp.all.mock.calls.find(
        call => call[0] === '/mcp/remote'
      )?.[2];

      const mockReq = {
        method: 'GET'
      } as unknown as ExpressRequest;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        send: vi.fn()
      } as unknown as ExpressResponse;

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
      const server1: ILocalMcpServer = {
        id: 'server1',
        name: 'Server 1',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn()
      };

      const server2: IRemoteMcpServer = {
        id: 'server2',
        name: 'Server 2',
        type: McpServerTypeEnum.REMOTE,
        version: '2.0.0',
        config: { name: 'Server 2', url: 'http://example.com' }
      };

      registry.registerServer(server1);
      registry.registerServer(server2);

      const servers = registry.getAllServers();
      expect(servers).toHaveLength(2);
      expect(servers).toContain(server1);
      expect(servers).toContain(server2);
    });

    it('should get server count', async () => {
      expect(registry.getServerCount()).toBe(0);

      registry.registerServer({
        id: 'test',
        name: 'Test',
        type: McpServerTypeEnum.LOCAL,
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

      const server1: ILocalMcpServer = {
        id: 'server1',
        name: 'Server 1',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn(),
        shutdown: shutdownFn1
      };

      const server2: ILocalMcpServer = {
        id: 'server2',
        name: 'Server 2',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn(),
        shutdown: shutdownFn2
      };

      const remoteServer: IRemoteMcpServer = {
        id: 'remote',
        name: 'Remote Server',
        type: McpServerTypeEnum.REMOTE,
        version: '1.0.0',
        config: { name: 'Remote Server', url: 'http://example.com' }
      };

      registry.registerServer(server1);
      registry.registerServer(server2);
      registry.registerServer(remoteServer);

      await registry.shutdown();

      expect(shutdownFn1).toHaveBeenCalled();
      expect(shutdownFn2).toHaveBeenCalled();
      expect(registry.getServerCount()).toBe(0);
    });

    it('should handle shutdown errors gracefully', async () => {
      const shutdownFn = vi.fn().mockRejectedValue(new Error('Shutdown failed'));

      const server: ILocalMcpServer = {
        id: 'server',
        name: 'Server',
        type: McpServerTypeEnum.LOCAL,
        version: '1.0.0',
        createHandler: vi.fn(),
        shutdown: shutdownFn
      };

      registry.registerServer(server);
      
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
      const { initializeMcpServerRegistry } = await import('../../../../src/server/mcp/registry');
      
      const registry1 = initializeMcpServerRegistry();
      const registry2 = initializeMcpServerRegistry();
      
      expect(registry1).toBe(registry2);
    });

    it('should get existing registry', async () => {
      const { initializeMcpServerRegistry, getMcpServerRegistry } = await import('../../../../src/server/mcp/registry');
      
      const initialized = initializeMcpServerRegistry();
      const retrieved = getMcpServerRegistry();
      
      expect(retrieved).toBe(initialized);
    });

    it('should throw error when getting registry before initialization', async () => {
      // Import fresh module instance
      const { getMcpServerRegistry: getRegistry } = await import('../../../../src/server/mcp/registry');
      
      expect(() => getRegistry()).toThrow(
        'MCP Server Registry not initialized'
      );
    });
  });
});