/**
 * HTTP Protocol Handler Integration Tests
 * 
 * These tests verify the HTTP protocol handler functionality:
 * - Dynamic endpoint registration
 * - Request/response via events
 * - Authentication integration
 * - Error handling
 * - Middleware support
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServerCore } from '@/server/core/server';
import { HttpProtocolHandler } from '@/server/protocols/http/http-protocol';
import { ServerEvents } from '@/server/core/types/events.types';
import fetch from 'node-fetch';

describe('HTTP Protocol Integration Tests', () => {
  let server: ServerCore;
  let httpHandler: HttpProtocolHandler;
  let baseUrl: string;

  beforeEach(async () => {
    server = new ServerCore({ port: 0 });
    httpHandler = new HttpProtocolHandler();
    
    await server.registerProtocol('http', httpHandler);
    await server.start();
    
    const port = server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('Endpoint Registration', () => {
    it('should register endpoints dynamically via events', async () => {
      // Register endpoint
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/hello',
          handler: 'test.hello',
          auth: { required: false }
        }]
      });

      // Set up handler
      server.eventBus.on('test.hello', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { message: 'Hello, World!' }
        });
      });

      // Make request
      const response = await fetch(`${baseUrl}/api/test/hello`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'Hello, World!' });
    });

    it('should support multiple HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      const received: any[] = [];

      // Register endpoints for each method
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: methods.map(method => ({
          protocol: 'http',
          method,
          path: '/api/test/resource',
          handler: `test.${method.toLowerCase()}`,
          auth: { required: false }
        }))
      });

      // Set up handlers
      methods.forEach(method => {
        server.eventBus.on(`test.${method.toLowerCase()}`, async (event) => {
          received.push({ method, body: event.body });
          server.eventBus.emit(`response.${event.requestId}`, {
            data: { method, received: true }
          });
        });
      });

      // Test each method
      for (const method of methods) {
        const options: any = { method };
        if (method !== 'GET' && method !== 'DELETE') {
          options.body = JSON.stringify({ data: 'test' });
          options.headers = { 'Content-Type': 'application/json' };
        }

        const response = await fetch(`${baseUrl}/api/test/resource`, options);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.method).toBe(method);
      }

      expect(received).toHaveLength(methods.length);
    });

    it('should handle path parameters', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'users',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/users/:id/posts/:postId',
          handler: 'users.getPost',
          auth: { required: false }
        }]
      });

      let receivedParams;
      server.eventBus.on('users.getPost', async (event) => {
        receivedParams = event.params;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { params: event.params }
        });
      });

      const response = await fetch(`${baseUrl}/api/users/123/posts/456`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(receivedParams).toEqual({ id: '123', postId: '456' });
      expect(data.params).toEqual({ id: '123', postId: '456' });
    });

    it('should handle query parameters', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'search',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/search',
          handler: 'search.query',
          auth: { required: false }
        }]
      });

      let receivedQuery;
      server.eventBus.on('search.query', async (event) => {
        receivedQuery = event.query;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { results: [], query: event.query }
        });
      });

      const response = await fetch(`${baseUrl}/api/search?q=test&limit=10&offset=0`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(receivedQuery).toEqual({ q: 'test', limit: '10', offset: '0' });
    });
  });

  describe('Request/Response Flow', () => {
    it('should include request metadata in events', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'POST',
          path: '/api/test/metadata',
          handler: 'test.metadata',
          auth: { required: false }
        }]
      });

      let receivedEvent;
      server.eventBus.on('test.metadata', async (event) => {
        receivedEvent = event;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { received: true }
        });
      });

      const response = await fetch(`${baseUrl}/api/test/metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value'
        },
        body: JSON.stringify({ test: 'data' })
      });

      expect(response.status).toBe(200);
      expect(receivedEvent).toMatchObject({
        requestId: expect.any(String),
        method: 'POST',
        path: '/api/test/metadata',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-custom-header': 'custom-value'
        }),
        body: { test: 'data' },
        query: {},
        params: {}
      });
    });

    it('should handle timeouts gracefully', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/timeout',
          handler: 'test.timeout',
          auth: { required: false },
          timeout: 100 // 100ms timeout
        }]
      });

      // Handler that takes too long
      server.eventBus.on('test.timeout', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        // This response will be too late
      });

      const response = await fetch(`${baseUrl}/api/test/timeout`);
      const data = await response.json();

      expect(response.status).toBe(504); // Gateway timeout
      expect(data.error).toContain('timeout');
    });

    it('should handle module errors properly', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/error',
          handler: 'test.error',
          auth: { required: false }
        }]
      });

      // Handler that returns an error
      server.eventBus.on('test.error', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'TEST_ERROR',
            message: 'Something went wrong',
            statusCode: 400
          }
        });
      });

      const response = await fetch(`${baseUrl}/api/test/error`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'TEST_ERROR',
        message: 'Something went wrong'
      });
    });
  });

  describe('Authentication Integration', () => {
    beforeEach(() => {
      // Mock auth validation
      server.eventBus.on('auth.validate', async (event) => {
        if (event.token === 'valid-token') {
          server.eventBus.emit(`response.${event.requestId}`, {
            data: {
              valid: true,
              userId: 'user-123',
              scopes: ['read', 'write']
            }
          });
        } else {
          server.eventBus.emit(`response.${event.requestId}`, {
            data: { valid: false, reason: 'Invalid token' }
          });
        }
      });
    });

    it('should enforce authentication when required', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/protected',
          handler: 'test.protected',
          auth: { required: true }
        }]
      });

      // No auth header
      const response1 = await fetch(`${baseUrl}/api/test/protected`);
      expect(response1.status).toBe(401);

      // Invalid token
      const response2 = await fetch(`${baseUrl}/api/test/protected`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      expect(response2.status).toBe(401);

      // Valid token
      server.eventBus.on('test.protected', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { 
            message: 'Access granted', 
            user: event.auth ? {
              id: event.auth.userId,
              scopes: event.auth.scopes
            } : undefined
          }
        });
      });

      const response3 = await fetch(`${baseUrl}/api/test/protected`, {
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      const data = await response3.json();

      expect(response3.status).toBe(200);
      expect(data.user).toEqual({
        id: 'user-123',
        scopes: ['read', 'write']
      });
    });

    it('should check required roles', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'admin',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/admin/users',
          handler: 'admin.listUsers',
          auth: {
            required: true,
            roles: ['admin']
          }
        }]
      });

      // Mock role checking
      server.eventBus.on('auth.check.roles', async (event) => {
        const hasRole = event.userId === 'admin-user' && event.roles.includes('admin');
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { hasRoles: hasRole }
        });
      });

      // Update auth validation to include admin user
      server.eventBus.off('auth.validate');
      server.eventBus.on('auth.validate', async (event) => {
        if (event.token === 'admin-token') {
          server.eventBus.emit(`response.${event.requestId}`, {
            data: {
              valid: true,
              userId: 'admin-user',
              scopes: ['read', 'write', 'admin']
            }
          });
        } else if (event.token === 'user-token') {
          server.eventBus.emit(`response.${event.requestId}`, {
            data: {
              valid: true,
              userId: 'regular-user',
              scopes: ['read', 'write']
            }
          });
        }
      });

      // Regular user - should be forbidden
      const response1 = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { 'Authorization': 'Bearer user-token' }
      });
      expect(response1.status).toBe(403);

      // Admin user - should succeed
      server.eventBus.on('admin.listUsers', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { users: [] }
        });
      });

      const response2 = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { 'Authorization': 'Bearer admin-token' }
      });
      expect(response2.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per endpoint', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/rate-limited',
          handler: 'test.rateLimited',
          auth: { required: false },
          rateLimit: {
            window: 1000, // 1 second
            max: 2 // 2 requests per second
          }
        }]
      });

      server.eventBus.on('test.rateLimited', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { count: 1 }
        });
      });

      // First two requests should succeed
      const response1 = await fetch(`${baseUrl}/api/test/rate-limited`);
      expect(response1.status).toBe(200);

      const response2 = await fetch(`${baseUrl}/api/test/rate-limited`);
      expect(response2.status).toBe(200);

      // Third request should be rate limited
      const response3 = await fetch(`${baseUrl}/api/test/rate-limited`);
      expect(response3.status).toBe(429); // Too Many Requests

      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should work again
      const response4 = await fetch(`${baseUrl}/api/test/rate-limited`);
      expect(response4.status).toBe(200);
    });
  });

  describe('Request Validation', () => {
    it('should validate request body schema', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'POST',
          path: '/api/test/validated',
          handler: 'test.validated',
          auth: { required: false },
          validation: {
            body: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 1 },
                age: { type: 'number', minimum: 0 }
              },
              required: ['name', 'age']
            }
          }
        }]
      });

      // Invalid request - missing required field
      const response1 = await fetch(`${baseUrl}/api/test/validated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' })
      });
      expect(response1.status).toBe(400);
      const error1 = await response1.json();
      expect(error1.error).toBe('Validation error');

      // Invalid request - wrong type
      const response2 = await fetch(`${baseUrl}/api/test/validated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 'twenty' })
      });
      expect(response2.status).toBe(400);

      // Valid request
      server.eventBus.on('test.validated', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { created: true, ...event.body }
        });
      });

      const response3 = await fetch(`${baseUrl}/api/test/validated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 25 })
      });
      expect(response3.status).toBe(200);
      const data = await response3.json();
      expect(data).toEqual({ created: true, name: 'John', age: 25 });
    });
  });

  describe('CORS and Headers', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await fetch(`${baseUrl}/api/test/endpoint`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type'
        }
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    });

    it('should detect proxy headers', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/proxy-info',
          handler: 'test.proxyInfo',
          auth: { required: false }
        }]
      });

      let receivedEvent;
      server.eventBus.on('test.proxyInfo', async (event) => {
        receivedEvent = event;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: {
            clientIp: event.clientIp,
            isProxied: event.isProxied,
            protocol: event.protocol
          }
        });
      });

      const response = await fetch(`${baseUrl}/api/test/proxy-info`, {
        headers: {
          'X-Forwarded-For': '192.168.1.100',
          'X-Forwarded-Proto': 'https',
          'CF-Connecting-IP': '10.0.0.1'
        }
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.isProxied).toBe(true);
      expect(data.clientIp).toBe('10.0.0.1'); // Cloudflare IP takes precedence
      expect(data.protocol).toBe('https');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unregistered endpoints', async () => {
      const response = await fetch(`${baseUrl}/api/nonexistent/endpoint`);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('should handle malformed JSON', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'POST',
          path: '/api/test/json',
          handler: 'test.json',
          auth: { required: false }
        }]
      });

      const response = await fetch(`${baseUrl}/api/test/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }'
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('JSON');
    });

    it('should handle server errors gracefully', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/crash',
          handler: 'test.crash',
          auth: { required: false },
          timeout: 1000 // 1 second timeout
        }]
      });

      // Handler that throws  
      server.eventBus.on('test.crash', async (event) => {
        // Don't emit response, simulating a crash
        // The timeout will catch this
      });

      const response = await fetch(`${baseUrl}/api/test/crash`);
      expect(response.status).toBe(504); // Gateway timeout due to 1s timeout
      const data = await response.json();
      expect(data.error).toBe('Gateway timeout');
      expect(data.message).toBe('The request timed out');
    });
  });
});