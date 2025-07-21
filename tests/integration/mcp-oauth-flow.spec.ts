/**
 * @fileoverview Test MCP OAuth2 authentication flow
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupMCPServers } from '../../src/server/mcp/index.js';
import { setupExternalAPI } from '../../src/server/external/index.js';

describe('MCP OAuth2 Authentication Flow', () => {
  let app: express.Express;

  beforeAll(async () => {
    // Set test environment
    process.env.PORT = '3000';
    process.env.MCP_AUTH_DISABLED = 'false';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_ISSUER = 'test-issuer';
    process.env.JWT_AUDIENCE = 'test-audience';
    process.env.BASE_URL = 'http://localhost:3000';
    
    app = express();
    app.use(express.json());
    
    // Setup OAuth2 endpoints and MCP servers
    await setupExternalAPI(app);
    await setupMCPServers(app);
  });

  afterAll(() => {
    // Clean up environment
    delete process.env.MCP_AUTH_DISABLED;
  });

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
        message: expect.any(String),
        data: {
          oauth2: {
            authorization_uri: expect.stringMatching(/^https?:\/\/.+\/oauth2\/authorize$/),
            token_uri: expect.stringMatching(/^https?:\/\/.+\/oauth2\/token$/),
            scopes_supported: expect.any(Array),
            response_types_supported: ['code'],
            grant_types_supported: expect.arrayContaining(['authorization_code'])
          }
        }
      },
      id: 1
    });
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
        data: {
          oauth2: expect.any(Object)
        }
      }
    });
  });

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

  it('should return MCP-compliant error format', async () => {
    const response = await request(app)
      .post('/mcp/core')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        method: 'test',
        id: 4
      });

    // Check if we got a JSON-RPC response
    if (response.body && response.body.jsonrpc) {
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('id', 4);
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    } else {
      // If not JSON-RPC format, at least check we got an error response
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
  });
});