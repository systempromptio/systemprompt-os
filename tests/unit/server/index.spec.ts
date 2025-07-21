/**
 * @fileoverview Unit tests for Server Index
 * @module tests/unit/server
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';

// Mock express module
const mockApp = {
  use: vi.fn(),
  listen: vi.fn((port, host, cb) => {
    if (cb) cb();
    return { 
      close: vi.fn((cb) => cb && cb())
    };
  }),
  get: vi.fn(),
  post: vi.fn(),
  all: vi.fn()
};

const expressMock = Object.assign(
  vi.fn(() => mockApp),
  {
    json: vi.fn(() => 'json-middleware'),
    urlencoded: vi.fn(() => 'urlencoded-middleware')
  }
);

vi.mock('express', () => ({
  default: expressMock
}));

vi.mock('cors', () => ({
  default: vi.fn(() => 'cors-middleware')
}));

vi.mock('../../../src/server/config', () => ({
  CONFIG: {
    HOST: '0.0.0.0',
    PORT: '3000',
    SERVER_NAME: 'test-server'
  }
}));

const mockModuleLoader = {
  loadModules: vi.fn(() => Promise.resolve(undefined)),
  getModule: vi.fn(),
  shutdown: vi.fn(() => Promise.resolve(undefined))
};

vi.mock('../../../src/modules/loader', () => ({
  getModuleLoader: vi.fn(() => mockModuleLoader)
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/server/external', () => ({
  setupExternalAPI: vi.fn(() => Promise.resolve(undefined))
}));

vi.mock('../../../src/server/mcp', () => ({
  setupMCPServers: vi.fn(() => Promise.resolve(undefined))
}));

describe('Server', () => {
  let mockSetTimeout: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Mock setTimeout to execute immediately
    mockSetTimeout = vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      fn();
      return 1 as any;
    });
  });
  
  afterEach(async () => {
    mockSetTimeout.mockRestore();
    // Clear the MCP registry singleton
    try {
      const { getMCPServerRegistry } = await import('../../../src/server/mcp/registry');
      const registry = getMCPServerRegistry();
      await registry.shutdown();
    } catch (e) {
      // Registry might not be initialized
    }
  });

  describe('createApp', () => {
    it('should create and configure Express app', async () => {
      const { createApp } = await import('../../../src/server/index');
      const express = (await import('express')).default;
      const cors = (await import('cors')).default;
      
      const app = await createApp();
      
      expect(express).toHaveBeenCalled();
      expect(cors).toHaveBeenCalledWith({
        origin: true,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept', 'mcp-session-id', 'x-session-id'],
        exposedHeaders: ['x-session-id', 'mcp-session-id']
      });
      expect(app.use).toHaveBeenCalledWith('cors-middleware');
    });

    it('should load modules', async () => {
      const { createApp } = await import('../../../src/server/index');
      const { getModuleLoader } = await import('../../../src/modules/loader');
      
      await createApp();
      
      const moduleLoader = getModuleLoader();
      expect(moduleLoader.loadModules).toHaveBeenCalled();
    });

    it('should setup body parsing middleware', async () => {
      const { createApp } = await import('../../../src/server/index');
      
      const app = await createApp();
      
      expect(expressMock.json).toHaveBeenCalled();
      expect(expressMock.urlencoded).toHaveBeenCalledWith({ extended: true });
      expect(app.use).toHaveBeenCalledWith('json-middleware');
      expect(app.use).toHaveBeenCalledWith('urlencoded-middleware');
    });

    it('should setup external API', async () => {
      const { createApp } = await import('../../../src/server/index');
      const { setupExternalAPI } = await import('../../../src/server/external');
      const { logger } = await import('../../../src/utils/logger');
      
      const app = await createApp();
      
      expect(setupExternalAPI).toHaveBeenCalledWith(app, logger);
    });

    // Skip this test since it's already verified by other tests that MCP setup runs
    it('should setup MCP servers', async () => {
      const { createApp } = await import('../../../src/server/index');
      
      await createApp();
      
      // Verify setupMCPServers was called with the Express app
      const { setupMCPServers } = await import('../../../src/server/mcp');
      expect(setupMCPServers).toHaveBeenCalledWith(expect.objectContaining({
        use: expect.any(Function),
        get: expect.any(Function),
        post: expect.any(Function)
      }));
    });

    it('should setup root endpoint', async () => {
      const { createApp } = await import('../../../src/server/index');
      
      const app = await createApp();
      
      expect(app.get).toHaveBeenCalledWith('/', expect.any(Function));
    });
  });

  describe('startServer', () => {
    it('should start server on configured port', async () => {
      const { startServer } = await import('../../../src/server/index');
      const { logger } = await import('../../../src/utils/logger');
      const { CONFIG } = await import('../../../src/server/config');
      
      const server = await startServer();
      
      expect(mockApp.listen).toHaveBeenCalledWith(
        parseInt(CONFIG.PORT, 10),
        '0.0.0.0',
        expect.any(Function)
      );
      expect(logger.info).toHaveBeenCalledWith(
        `🚀 systemprompt-os running on port ${CONFIG.PORT}`
      );
      expect(server).toBeDefined();
      expect(server.close).toBeDefined();
    });

    it('should handle server startup errors', async () => {
      mockModuleLoader.loadModules.mockRejectedValueOnce(new Error('Module load failed'));
      
      const { startServer } = await import('../../../src/server/index');
      
      await expect(startServer()).rejects.toThrow('Module load failed');
    });

    it('should return HTTP server instance', async () => {
      const { startServer } = await import('../../../src/server/index');
      
      const server = await startServer();
      
      expect(server).toHaveProperty('close');
    });
  });

  describe('endpoints', () => {
    it('should handle root endpoint request', async () => {
      const { createApp } = await import('../../../src/server/index');
      
      const app = await createApp();
      const mockHandler = app.get.mock.calls.find(call => call[0] === '/')[1];
      
      const req = {
        get: vi.fn((header) => {
          if (header === 'x-forwarded-proto') return null;
          if (header === 'host') return 'localhost:3000';
          return null;
        }),
        protocol: 'http'
      };
      const res = {
        json: vi.fn()
      };
      
      mockHandler(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        service: 'systemprompt-os',
        version: '0.1.0',
        description: 'An operating system for autonomous agents',
        endpoints: expect.objectContaining({
          health: 'http://localhost:3000/health',
          status: 'http://localhost:3000/status',
          oauth2: expect.objectContaining({
            discovery: 'http://localhost:3000/.well-known/openid-configuration',
            authorize: 'http://localhost:3000/oauth2/authorize',
            token: 'http://localhost:3000/oauth2/token',
            userinfo: 'http://localhost:3000/oauth2/userinfo'
          }),
          mcp: expect.objectContaining({
            core: 'http://localhost:3000/mcp/core',
            custom: 'http://localhost:3000/mcp/custom/*'
          })
        })
      });
    });
  });

  describe('error handling', () => {
    it('should handle CORS errors gracefully', async () => {
      const cors = (await import('cors')).default;
      vi.mocked(cors).mockImplementationOnce(() => {
        throw new Error('CORS configuration error');
      });
      
      const { createApp } = await import('../../../src/server/index');
      
      await expect(createApp()).rejects.toThrow('CORS configuration error');
    });

    it('should handle listen errors', async () => {
      mockApp.listen.mockImplementationOnce(() => {
        throw new Error('Port already in use');
      });
      
      const { startServer } = await import('../../../src/server/index');
      
      await expect(startServer()).rejects.toThrow('Port already in use');
    });
  });
  
  describe('graceful shutdown', () => {
    it('should shutdown modules on server close', async () => {
      const { startServer } = await import('../../../src/server/index');
      
      const server = await startServer();
      const closeCb = vi.fn();
      
      // Test the overridden close method
      server.close(closeCb);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockModuleLoader.shutdown).toHaveBeenCalled();
      expect(closeCb).toHaveBeenCalled();
    });
  });
});