import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { getTestBaseUrl, getContainerLogs } from './bootstrap.js';

/**
 * Server External Domain E2E Tests
 * 
 * Tests the critical functionality of external server endpoints including:
 * - Health check endpoints
 * - Status endpoints
 * - CORS configuration
 * - Error handling
 * - Container health
 */
describe('[01] Server External Domain', () => {
  const baseUrl = getTestBaseUrl();
  console.log('External tests using baseUrl:', baseUrl);

  describe('Health Check Endpoints', () => {
    it('should return 200 for basic health check', async () => {
      console.log('Making request to:', baseUrl, '/health');
      const response = await request(baseUrl).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include proper health check metadata', async () => {
      const response = await request(baseUrl).get('/health');
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(response.body.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Status Endpoints', () => {
    it('should return detailed status information', async () => {
      const response = await request(baseUrl).get('/api/status');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('server');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('mcp');
    });

    it('should include server status details', async () => {
      const response = await request(baseUrl).get('/api/status');
      expect(response.body.server).toHaveProperty('status', 'running');
      expect(response.body.server).toHaveProperty('uptime');
      expect(response.body.server).toHaveProperty('version');
      expect(response.body.server.uptime).toBeGreaterThan(0);
    });

    it('should include system information', async () => {
      const response = await request(baseUrl).get('/api/status');
      expect(response.body.system).toHaveProperty('platform');
      expect(response.body.system).toHaveProperty('arch');
      expect(response.body.system).toHaveProperty('nodeVersion');
      expect(response.body.system).toHaveProperty('memory');
      expect(response.body.system.memory).toHaveProperty('total');
      expect(response.body.system.memory).toHaveProperty('free');
      expect(response.body.system.memory).toHaveProperty('used');
    });

    it('should include MCP server status', async () => {
      const response = await request(baseUrl).get('/api/status');
      expect(response.body.mcp).toHaveProperty('available', true);
      expect(response.body.mcp).toHaveProperty('version');
      expect(response.body.mcp).toHaveProperty('tools');
      expect(response.body.mcp).toHaveProperty('resources');
      expect(Array.isArray(response.body.mcp.tools)).toBe(true);
      expect(Array.isArray(response.body.mcp.resources)).toBe(true);
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(baseUrl)
        .options('/api/status')
        .set('Origin', 'http://localhost:8080')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Content-Type');
      
      expect(response.status).toBe(204);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should include CORS headers in responses', async () => {
      const response = await request(baseUrl)
        .get('/api/status')
        .set('Origin', 'http://localhost:8080');
      
      expect(response.headers).toHaveProperty('access-control-allow-origin');
      // Server returns the request origin for security, not '*'
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    });

    it('should support credentials in CORS', async () => {
      const response = await request(baseUrl)
        .get('/api/status')
        .set('Origin', 'http://localhost:8080')
        .set('Cookie', 'test=value');
      
      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });
  });

  describe('Error Handling', () => {
    it('should return 401 for unknown API routes without authentication', async () => {
      const response = await request(baseUrl).get('/api/unknown-endpoint');
      expect(response.status).toBe(401);
      // API routes require authentication
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(baseUrl)
        .post('/api/status')
        .set('Content-Type', 'application/json')
        .send('{"invalid json}');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for non-existent API routes without authentication', async () => {
      const response = await request(baseUrl).get('/api/non-existent');
      expect(response.status).toBe(401);
      // API routes require authentication
    });
  });

  describe('Response Headers', () => {
    it('should include security headers', async () => {
      const response = await request(baseUrl).get('/health');
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });

    it('should include proper content-type headers', async () => {
      const response = await request(baseUrl).get('/api/status');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Container Health', () => {
    // These tests verify Docker container health
    it('should have healthy container logs', async () => {
      const logs = await getContainerLogs();
      expect(logs).not.toContain('ERROR');
      expect(logs).not.toContain('FATAL');
      expect(logs).toContain('Server running');
    });

    it('should log startup messages', async () => {
      const logs = await getContainerLogs();
      expect(logs).toContain('SystemPrompt OS Starting');
      expect(logs).toContain('MCP server initialized');
      expect(logs).toContain('systemprompt-os running on port');
    });
  });
});