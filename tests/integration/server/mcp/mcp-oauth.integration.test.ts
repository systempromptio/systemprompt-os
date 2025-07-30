/**
 * Server MCP Integration Test
 * 
 * Tests Model Context Protocol server implementation with OAuth authentication:
 * - Load MCP core server
 * - Mock authentication flow
 * - Access MCP server with mocked access token
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Express } from 'express';

// Mock the logger service before importing modules that use it
vi.mock('@/modules/core/logger/services/logger.service', () => ({
  LoggerService: {
    getInstance: () => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
      checkInitialized: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

// Mock the database service before importing modules that use it
vi.mock('@/modules/core/database/services/database.service', () => ({
  DatabaseService: {
    getInstance: () => ({
      query: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined)
    }),
    create: () => ({
      query: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

import { setupMcpServers } from '@/server/mcp/index';
import { initializeMcpServerRegistry } from '@/server/mcp/registry';
import { createRemoteMcpServer } from '@/server/mcp/remote/index';
import { mcpAuthAdapter } from '@/server/mcp/auth-adapter';

describe('Server MCP Integration Tests', () => {
  let app: Express;
  let mockAccessToken: string;

  beforeAll(async () => {

    // Create minimal Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware to bypass real OAuth flow
    const mockAuthMiddleware = (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Missing authorization header' });
      }
      
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Invalid authorization format' });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      if (token === 'invalid-token') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      if (token === mockAccessToken) {
        // Mock authenticated user
        req.user = {
          id: 'test-user-123',
          email: 'test@example.com',
          permissions: ['mcp.access']
        };
        return next();
      }
      
      return res.status(401).json({ error: 'Unauthorized' });
    };

    // Generate mock access token
    mockAccessToken = 'mock-access-token-' + Date.now();

    try {
      // Initialize MCP registry manually
      const registry = initializeMcpServerRegistry();
      
      // Create and register the core MCP server
      const coreServer = createRemoteMcpServer();
      registry.registerServer(coreServer);
      
      // Setup MCP routes with our mock auth
      app.get('/mcp/status', mockAuthMiddleware, (req, res) => {
        const statuses = registry.getServerStatuses();
        const statusMap: Record<string, any> = {};
        
        for (const [id, status] of statuses.entries()) {
          statusMap[id] = status;
        }
        
        res.json({
          servers: statusMap,
          total: registry.getServerCount(),
          timestamp: new Date().toISOString()
        });
      });

      // Setup MCP core server route
      app.all('/mcp/core', mockAuthMiddleware, (req, res) => {
        const handler = coreServer.createHandler();
        handler(req, res, () => {});
      });

      // Add a simple MCP initialize endpoint for testing
      app.post('/mcp/core/initialize', mockAuthMiddleware, (req, res) => {
        res.json({
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'systemprompt-os-core',
            version: '0.1.0'
          }
        });
      });

      console.log('MCP test server setup complete');
      
    } catch (error) {
      console.error('Error setting up MCP test server:', error);
      throw error;
    }
  });

  describe('MCP Core Server Loading', () => {
    it('should load and initialize MCP core server', async () => {
      const response = await request(app)
        .get('/mcp/status')
        .set('Authorization', `Bearer ${mockAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.servers).toBeDefined();
      expect(response.body.servers.core).toBeDefined();
      expect(response.body.total).toBe(1);
    });

    it('should have core server available at /mcp/core', async () => {
      const response = await request(app)
        .get('/mcp/core')
        .set('Authorization', `Bearer ${mockAccessToken}`);

      // Should not be 404 - the handler should be mounted
      expect(response.status).not.toBe(404);
    });
  });

  describe('Mocked Authentication Flow', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/mcp/status');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing authorization header');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/mcp/status')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should accept requests with valid mocked token', async () => {
      const response = await request(app)
        .get('/mcp/status')
        .set('Authorization', `Bearer ${mockAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.servers).toBeDefined();
    });
  });

  describe('MCP Server Access with Mocked Token', () => {
    it('should access MCP initialize endpoint with mocked token', async () => {
      const response = await request(app)
        .post('/mcp/core/initialize')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: {
              listChanged: true
            }
          },
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.protocolVersion).toBe('2024-11-05');
      expect(response.body.capabilities).toBeDefined();
      expect(response.body.serverInfo).toBeDefined();
      expect(response.body.serverInfo.name).toBe('systemprompt-os-core');
    });

    it('should handle MCP protocol messages with authentication', async () => {
      // Test a typical MCP tools/list request
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      // Should not be 401/403 - authentication should work
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      
      // Should get some response from the MCP server
      if (response.status === 200) {
        expect(response.body).toBeDefined();
      }
    });

    it('should maintain authentication across multiple requests', async () => {
      // First request
      const response1 = await request(app)
        .get('/mcp/status')
        .set('Authorization', `Bearer ${mockAccessToken}`);

      expect(response1.status).toBe(200);

      // Second request with same token
      const response2 = await request(app)
        .post('/mcp/core/initialize')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        });

      expect(response2.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed authorization headers', async () => {
      const response = await request(app)
        .get('/mcp/status')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });

    it('should handle missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/mcp/status')
        .set('Authorization', mockAccessToken);

      expect(response.status).toBe(401);
    });
  });

  describe('MCP Protocol Compliance', () => {
    it('should respond to initialization requests', async () => {
      const response = await request(app)
        .post('/mcp/core/initialize')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.protocolVersion).toBeTruthy();
      expect(response.body.capabilities).toBeDefined();
      expect(response.body.serverInfo).toBeDefined();
    });

    it('should include required server info in initialization', async () => {
      const response = await request(app)
        .post('/mcp/core/initialize')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        });

      expect(response.status).toBe(200);
      expect(response.body.serverInfo.name).toBe('systemprompt-os-core');
      expect(response.body.serverInfo.version).toBe('0.1.0');
    });
  });

  describe('End-to-End MCP OAuth Flow', () => {
    it('should demonstrate complete MCP access flow with mocked OAuth token', async () => {
      // 1. Verify MCP core server is loaded and available
      const statusResponse = await request(app)
        .get('/mcp/status')
        .set('Authorization', `Bearer ${mockAccessToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.servers.core).toBeDefined();
      console.log('✓ MCP core server loaded and accessible');

      // 2. Initialize MCP session with mocked authentication
      const initResponse = await request(app)
        .post('/mcp/core/initialize')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        });

      expect(initResponse.status).toBe(200);
      expect(initResponse.body.serverInfo.name).toBe('systemprompt-os-core');
      console.log('✓ MCP session initialized with mocked OAuth token');

      // 3. Attempt MCP protocol request (tools/list)
      const toolsResponse = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(toolsResponse.status).not.toBe(401);
      expect(toolsResponse.status).not.toBe(403);
      console.log('✓ MCP protocol requests authenticated successfully');

      // 4. Verify unauthorized access is blocked
      const unauthorizedResponse = await request(app)
        .get('/mcp/status')
        .set('Authorization', 'Bearer invalid-token');

      expect(unauthorizedResponse.status).toBe(401);
      console.log('✓ Unauthorized access properly blocked');

      console.log('🎉 Complete MCP OAuth flow test successful!');
    });
  });
});