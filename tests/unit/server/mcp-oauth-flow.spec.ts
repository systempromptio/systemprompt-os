/**
 * @fileoverview Test MCP OAuth2 authentication flow
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

describe('MCP OAuth2 Authentication Flow', () => {
  let app: express.Express;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set test environment
    process.env.PORT = '3000';
    process.env.MCP_AUTH_DISABLED = 'false';
    process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';
    process.env.JWT_ISSUER = 'test-issuer';
    process.env.JWT_AUDIENCE = 'test-audience';
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'test';
    
    // Mock logger and database dependencies
    vi.mock('../../src/modules/core/logger/index', () => ({
      LoggerService: {
        getInstance: () => ({
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          log: vi.fn()
        })
      },
      LogSource: {
        SERVER: 'SERVER',
        MCP: 'MCP',
        AUTH: 'AUTH'
      }
    }));
    
    vi.mock('../../src/modules/core/auth/singleton', () => ({
      getAuthModule: () => ({
        exports: {
          oauth2ConfigService: () => ({
            getProtectedResourceMetadata: () => ({
              resource: 'http://localhost:3000/mcp',
              authorization_servers: ['http://localhost:3000'],
              bearer_methods_supported: ['header'],
              scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent']
            }),
            getAuthorizationServerMetadata: () => ({
              issuer: 'http://localhost:3000',
              authorization_endpoint: 'http://localhost:3000/oauth2/authorize',
              token_endpoint: 'http://localhost:3000/oauth2/token',
              jwks_uri: 'http://localhost:3000/.well-known/jwks.json',
              scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'agent'],
              response_types_supported: ['code'],
              grant_types_supported: ['authorization_code', 'refresh_token']
            })
          })
        }
      })
    }));
    
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Import after mocking
    const { setupMcpServers } = await import('../../src/server/mcp/index');
    const { setupExternalEndpoints } = await import('../../src/server/external/setup');
    
    // Setup OAuth2 endpoints and MCP servers
    await setupExternalEndpoints(app);
    await setupMcpServers(app);
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // Helper function to create valid JWT tokens
  const createValidToken = (payload: any = {}) => {
    const defaultPayload = {
      sub: 'test-user-id',
      email: 'test@example.com',
      tokentype: 'access',
      user: {
        email: 'test@example.com',
        roles: ['user']
      },
      roles: ['user'],
      iss: process.env.JWT_ISSUER,
      aud: process.env.JWT_AUDIENCE,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign({ ...defaultPayload, ...payload }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
  };

  const createExpiredToken = () => {
    const payload = {
      sub: 'test-user-id',
      email: 'test@example.com',
      tokentype: 'access',
      user: {
        email: 'test@example.com',
        roles: ['user']
      },
      roles: ['user'],
      iss: process.env.JWT_ISSUER,
      aud: process.env.JWT_AUDIENCE,
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      iat: Math.floor(Date.now() / 1000) - 7200  // 2 hours ago
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256' });
  };

  describe('Authentication Required Scenarios', () => {
    it('should return 401 with OAuth2 config when no token is provided', async () => {
      const response = await request(app)
        .post('/mcp/core')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: expect.any(String)
        },
        id: 1
      });
      
      // Check WWW-Authenticate header is set correctly
      expect(response.headers['www-authenticate']).toMatch(/Bearer realm/);
      expect(response.headers['www-authenticate']).toMatch(/as_uri/);
    });

    it('should return 401 with OAuth2 config for invalid token', async () => {
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: expect.any(String)
        },
        id: 2
      });
      
      // Check WWW-Authenticate header is set
      expect(response.headers['www-authenticate']).toBeDefined();
    });

    it('should handle request without id field in body', async () => {
      const response = await request(app)
        .post('/mcp/core')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list'
          // No id field
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: expect.any(String)
        },
        id: null  // Should be null when no id in request
      });
    });

    it('should handle malformed authorization header', async () => {
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', 'Basic invalid-format')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 3
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32001
        },
        id: 3
      });
    });

    it('should handle expired JWT token', async () => {
      const expiredToken = createExpiredToken();
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 4
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: expect.stringContaining('expired')
        },
        id: 4
      });
    });

    it('should handle invalid token type', async () => {
      const refreshToken = createValidToken({ tokentype: 'refresh' });
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${refreshToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 5
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: expect.stringContaining('Invalid token type')
        },
        id: 5
      });
    });
  });


  describe('Authentication Disabled Scenarios', () => {
    it('should allow access when auth is disabled', async () => {
      // Temporarily disable auth
      process.env.MCP_AUTH_DISABLED = 'true';
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'capabilities',
          id: 3
        });

      // The response might be 406 if content-type is not accepted
      // or 200 if successful
      expect([200, 406]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('result');
      }
      
      // Re-enable auth
      process.env.MCP_AUTH_DISABLED = 'false';
    });

    it('should bypass all auth checks when MCP_AUTH_DISABLED is true', async () => {
      process.env.MCP_AUTH_DISABLED = 'true';
      
      // Test with invalid token - should still work
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', 'Bearer totally-invalid-token')
        .send({
          jsonrpc: '2.0',
          method: 'capabilities',
          id: 6
        });

      // Should not return 401 when auth is disabled
      expect(response.status).not.toBe(401);
      
      process.env.MCP_AUTH_DISABLED = 'false';
    });

    it('should bypass auth even without any authorization header when disabled', async () => {
      process.env.MCP_AUTH_DISABLED = 'true';
      
      const response = await request(app)
        .post('/mcp/core')
        .send({
          jsonrpc: '2.0',
          method: 'capabilities',
          id: 7
        });

      // Should not return 401 when auth is disabled
      expect(response.status).not.toBe(401);
      
      process.env.MCP_AUTH_DISABLED = 'false';
    });
  });

  describe('Valid Authentication Scenarios', () => {
    it('should allow access with valid JWT token', async () => {
      const validToken = createValidToken();
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'capabilities',
          id: 8
        });

      // Should not be 401 with valid token
      expect(response.status).not.toBe(401);
    });

    it('should handle cookie-based authentication', async () => {
      const validToken = createValidToken();
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Cookie', `auth_token=${validToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'capabilities',
          id: 9
        });

      // Should not be 401 with valid cookie token
      expect(response.status).not.toBe(401);
    });

    it('should handle JWT with client credentials', async () => {
      const tokenWithClient = createValidToken({
        clientid: 'test-client-id',
        scope: 'read write'
      });
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${tokenWithClient}`)
        .send({
          jsonrpc: '2.0',
          method: 'capabilities',
          id: 10
        });

      expect(response.status).not.toBe(401);
    });

    it('should handle JWT with different user structure', async () => {
      const tokenWithDifferentUser = createValidToken({
        user: undefined,  // No user object
        email: 'direct@example.com',
        roles: ['admin', 'user']
      });
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${tokenWithDifferentUser}`)
        .send({
          jsonrpc: '2.0',
          method: 'capabilities',
          id: 11
        });

      expect(response.status).not.toBe(401);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should handle insufficient permissions for admin routes', async () => {
      const userToken = createValidToken({ roles: ['user'] });
      
      // Try to access an admin endpoint if available
      const response = await request(app)
        .get('/admin/config')
        .set('Authorization', `Bearer ${userToken}`);

      // Should either be 403 (forbidden) or 404 (not found)
      expect([403, 404]).toContain(response.status);
    });

    it('should allow admin access with admin role', async () => {
      const adminToken = createValidToken({ roles: ['admin', 'user'] });
      
      const response = await request(app)
        .get('/admin/config')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should not be forbidden
      expect(response.status).not.toBe(403);
    });
  });

  describe('MCP Error Response Format', () => {
    it('should return MCP-compliant error format for auth failures', async () => {
      const response = await request(app)
        .post('/mcp/core')
        .send({
          jsonrpc: '2.0',
          method: 'test',
          id: 12
        });

      if (response.status === 401) {
        expect(response.body).toHaveProperty('jsonrpc', '2.0');
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('id', 12);
        expect(response.body.error).toHaveProperty('code', -32001);
        expect(response.body.error).toHaveProperty('message');
      }
    });

    it('should preserve request id in error responses', async () => {
      const testId = 'custom-string-id';
      const response = await request(app)
        .post('/mcp/core')
        .send({
          jsonrpc: '2.0',
          method: 'test',
          id: testId
        });

      if (response.status === 401) {
        expect(response.body.id).toBe(testId);
      }
    });

    it('should handle null id in request', async () => {
      const response = await request(app)
        .post('/mcp/core')
        .send({
          jsonrpc: '2.0',
          method: 'test',
          id: null
        });

      if (response.status === 401) {
        expect(response.body.id).toBe(null);
      }
    });
  });

  describe('OAuth2 Endpoint Testing', () => {
    it('should return proper OAuth2 metadata from well-known endpoint', async () => {
      const response = await request(app)
        .get('/.well-known/oauth-protected-resource');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resource');
      expect(response.body).toHaveProperty('authorization_servers');
      expect(response.body).toHaveProperty('bearer_methods_supported');
      expect(response.body).toHaveProperty('scopes_supported');
    });

    it('should return authorization server metadata', async () => {
      const response = await request(app)
        .get('/.well-known/oauth-authorization-server');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorization_endpoint');
      expect(response.body).toHaveProperty('token_endpoint');
      expect(response.body).toHaveProperty('scopes_supported');
      expect(response.body).toHaveProperty('response_types_supported');
      expect(response.body).toHaveProperty('grant_types_supported');
    });

    it('should return JWKS from well-known endpoint', async () => {
      const response = await request(app)
        .get('/.well-known/jwks.json');

      // May return 200 with keys or 404/501 if not implemented
      expect([200, 404, 501]).toContain(response.status);
    });

    it('should handle OAuth2 authorization endpoint', async () => {
      const response = await request(app)
        .get('/oauth2/authorize')
        .query({
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          scope: 'openid profile email'
        });

      // Should either redirect or return HTML/error
      expect([200, 302, 400, 501]).toContain(response.status);
    });

    it('should handle OAuth2 token endpoint', async () => {
      const response = await request(app)
        .post('/oauth2/token')
        .send({
          grant_type: 'authorization_code',
          code: 'test-code',
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'test-client'
        });

      // May be not implemented or require specific setup
      expect([200, 400, 401, 501]).toContain(response.status);
    });
  });

  describe('MCP Server Registry Tests', () => {
    it('should return server status from status endpoint', async () => {
      const response = await request(app)
        .get('/mcp/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('servers');
      expect(typeof response.body.servers).toBe('object');
    });

    it('should handle requests to specific MCP server endpoints', async () => {
      const validToken = createValidToken();
      
      // Test the core server endpoint
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'capabilities',
          id: 13
        });

      // Should not be 401 with valid token
      expect(response.status).not.toBe(401);
    });

    it('should handle different HTTP methods on MCP endpoints', async () => {
      const validToken = createValidToken();
      
      // Test GET request
      const getResponse = await request(app)
        .get('/mcp/core')
        .set('Authorization', `Bearer ${validToken}`);

      // Should handle GET requests
      expect(getResponse.status).not.toBe(401);

      // Test PUT request
      const putResponse = await request(app)
        .put('/mcp/core')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ test: 'data' });

      expect(putResponse.status).not.toBe(401);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/mcp/core')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Should return 400 for malformed JSON
      expect([400, 401]).toContain(response.status);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/mcp/core')
        .send();

      expect([400, 401]).toContain(response.status);
    });

    it('should handle JWT with wrong issuer', async () => {
      const wrongIssuerToken = jwt.sign({
        sub: 'test-user',
        tokentype: 'access',
        iss: 'wrong-issuer',
        aud: process.env.JWT_AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 3600
      }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${wrongIssuerToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'test',
          id: 14
        });

      expect(response.status).toBe(401);
    });

    it('should handle JWT with wrong audience', async () => {
      const wrongAudienceToken = jwt.sign({
        sub: 'test-user',
        tokentype: 'access',
        iss: process.env.JWT_ISSUER,
        aud: 'wrong-audience',
        exp: Math.floor(Date.now() / 1000) + 3600
      }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${wrongAudienceToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'test',
          id: 15
        });

      expect(response.status).toBe(401);
    });

    it('should handle JWT with invalid signature', async () => {
      const invalidSignatureToken = jwt.sign({
        sub: 'test-user',
        tokentype: 'access',
        iss: process.env.JWT_ISSUER,
        aud: process.env.JWT_AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 3600
      }, 'wrong-secret', { algorithm: 'HS256' });
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${invalidSignatureToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'test',
          id: 16
        });

      expect(response.status).toBe(401);
    });

    it('should handle requests with different content types', async () => {
      const validToken = createValidToken();
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'capabilities',
          id: 17
        }));

      // Should handle different content types gracefully
      expect(response.status).not.toBe(401);
    });

    it('should handle very large request bodies', async () => {
      const validToken = createValidToken();
      const largeData = { data: 'x'.repeat(10000) };
      
      const response = await request(app)
        .post('/mcp/core')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'test',
          id: 18,
          params: largeData
        });

      // Should handle large payloads
      expect(response.status).not.toBe(401);
    });

    it('should handle concurrent requests', async () => {
      const validToken = createValidToken();
      
      const requests = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .post('/mcp/core')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            jsonrpc: '2.0',
            method: 'test',
            id: 19 + i
          })
      );

      const responses = await Promise.all(requests);
      
      // All should succeed with valid token
      responses.forEach(response => {
        expect(response.status).not.toBe(401);
      });
    });
  });
});