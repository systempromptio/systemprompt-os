/**
 * Module Integration Bridge Tests
 * 
 * These tests verify the module bridge functionality:
 * - Dynamic endpoint registration
 * - Request routing to modules
 * - Response handling
 * - Cross-module communication
 * - Error propagation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServerCore } from '@/server/core/server';
import { ModuleBridge } from '@/server/integration/module-bridge';
import { EndpointRegistry } from '@/server/integration/endpoint-registry';
import { ServerEvents } from '@/server/core/types/events.types';
import { 
  EndpointDefinition, 
  ModuleRequest, 
  ModuleResponse 
} from '@/server/integration/types/integration.types';

describe('Module Integration Bridge Tests', () => {
  let server: ServerCore;
  let bridge: ModuleBridge;
  let registry: EndpointRegistry;

  beforeEach(async () => {
    server = new ServerCore({ port: 0 });
    bridge = new ModuleBridge(server.eventBus);
    registry = bridge.getEndpointRegistry();
    
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('Endpoint Registration', () => {
    it('should register endpoints from modules via events', async () => {
      const endpoints: EndpointDefinition[] = [
        {
          protocol: 'http',
          method: 'GET',
          path: '/api/users',
          handler: 'users.list',
          auth: { required: true },
          rateLimit: { window: 60000, max: 100 },
          description: 'List all users'
        },
        {
          protocol: 'http',
          method: 'POST',
          path: '/api/users',
          handler: 'users.create',
          auth: { required: true, roles: ['admin'] },
          validation: {
            body: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' }
              },
              required: ['name', 'email']
            }
          }
        }
      ];

      // Emit registration event
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'users',
        endpoints
      });

      // Wait for async registration
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify endpoints are registered
      const registered = registry.getEndpoints();
      expect(registered).toHaveLength(2);
      expect(registered[0]).toMatchObject({
        moduleId: 'users',
        path: '/api/users',
        method: 'GET',
        handler: 'users.list'
      });
    });

    it('should handle endpoint conflicts', async () => {
      // Register first endpoint
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'module1',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/resource',
          handler: 'module1.get'
        }]
      });

      // Try to register conflicting endpoint
      let errorEvent;
      server.eventBus.on(ServerEvents.REGISTRATION_ERROR, (event) => {
        errorEvent = event;
      });

      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'module2',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/resource',
          handler: 'module2.get'
        }]
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorEvent).toBeDefined();
      expect(errorEvent.error).toContain('conflict');
      expect(errorEvent.moduleId).toBe('module2');
    });

    it('should support wildcard and regex paths', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'files',
        endpoints: [
          {
            protocol: 'http',
            method: 'GET',
            path: '/api/files/*',
            handler: 'files.serve',
            description: 'Serve any file'
          },
          {
            protocol: 'http',
            method: 'GET',
            path: /^\/api\/regex\/\d+$/,
            handler: 'files.regex',
            description: 'Regex path matching'
          }
        ]
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Test wildcard matching
      const match1 = registry.matchEndpoint('GET', '/api/files/documents/report.pdf');
      expect(match1).toBeDefined();
      expect(match1?.handler).toBe('files.serve');

      // Test regex matching
      const match2 = registry.matchEndpoint('GET', '/api/regex/123');
      expect(match2).toBeDefined();
      expect(match2?.handler).toBe('files.regex');

      const match3 = registry.matchEndpoint('GET', '/api/regex/abc');
      expect(match3).toBeNull();
    });

    it('should unregister endpoints when module shuts down', async () => {
      // Register endpoints
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'temp',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/temp',
          handler: 'temp.get'
        }]
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(registry.getEndpoints()).toHaveLength(1);

      // Module shutdown event
      server.eventBus.emit(ServerEvents.MODULE_SHUTDOWN, {
        moduleId: 'temp'
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(registry.getEndpoints()).toHaveLength(0);
    });
  });

  describe('Request Routing', () => {
    beforeEach(() => {
      // Register test endpoints
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [
          {
            protocol: 'http',
            method: 'GET',
            path: '/api/test/:id',
            handler: 'test.get'
          },
          {
            protocol: 'http',
            method: 'POST',
            path: '/api/test',
            handler: 'test.create'
          }
        ]
      });
    });

    it('should route requests to correct module handler', async () => {
      let receivedEvents: any[] = [];

      // Set up handlers
      server.eventBus.on('test.get', (event) => {
        receivedEvents.push({ handler: 'get', event });
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { id: event.params.id }
        });
      });

      server.eventBus.on('test.create', (event) => {
        receivedEvents.push({ handler: 'create', event });
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { created: true, ...event.body }
        });
      });

      // Route GET request
      const getRequest: ModuleRequest = {
        requestId: 'req-1',
        method: 'GET',
        path: '/api/test/123',
        params: { id: '123' },
        query: {},
        headers: {},
        body: null
      };

      const getResponse = await bridge.handleRequest(getRequest);
      
      expect(getResponse.data).toEqual({ id: '123' });
      expect(receivedEvents[0].handler).toBe('get');

      // Route POST request
      const postRequest: ModuleRequest = {
        requestId: 'req-2',
        method: 'POST',
        path: '/api/test',
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
        body: { name: 'Test Item' }
      };

      const postResponse = await bridge.handleRequest(postRequest);
      
      expect(postResponse.data).toEqual({ created: true, name: 'Test Item' });
      expect(receivedEvents[1].handler).toBe('create');
    });

    it('should include authentication context in routed requests', async () => {
      let receivedAuth;

      server.eventBus.on('test.get', (event) => {
        receivedAuth = event.auth;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { authenticated: true }
        });
      });

      const request: ModuleRequest = {
        requestId: 'req-auth',
        method: 'GET',
        path: '/api/test/123',
        params: { id: '123' },
        query: {},
        headers: {},
        body: null,
        auth: {
          authenticated: true,
          userId: 'user-456',
          scopes: ['read', 'write'],
          sessionId: 'session-789'
        }
      };

      await bridge.handleRequest(request);

      expect(receivedAuth).toEqual({
        authenticated: true,
        userId: 'user-456',
        scopes: ['read', 'write'],
        sessionId: 'session-789'
      });
    });

    it('should handle request timeouts', async () => {
      // Register endpoint with short timeout
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'slow',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/slow',
          handler: 'slow.get',
          timeout: 50 // 50ms timeout
        }]
      });

      // Handler that takes too long
      server.eventBus.on('slow.get', async (event) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { slow: true }
        });
      });

      const request: ModuleRequest = {
        requestId: 'req-timeout',
        method: 'GET',
        path: '/api/slow',
        params: {},
        query: {},
        headers: {},
        body: null
      };

      const response = await bridge.handleRequest(request);
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('TIMEOUT');
      expect(response.error?.statusCode).toBe(504);
    });

    it('should handle missing handlers gracefully', async () => {
      // Remove handler
      server.eventBus.off('test.get');

      const request: ModuleRequest = {
        requestId: 'req-no-handler',
        method: 'GET',
        path: '/api/test/123',
        params: { id: '123' },
        query: {},
        headers: {},
        body: null
      };

      const response = await bridge.handleRequest(request);
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('HANDLER_NOT_FOUND');
      expect(response.error?.message).toContain('No handler registered');
    });
  });

  describe('Response Handling', () => {
    it('should handle successful responses', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/success',
          handler: 'test.success'
        }]
      });

      server.eventBus.on('test.success', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: {
            success: true,
            timestamp: new Date().toISOString(),
            metadata: { version: '1.0' }
          }
        });
      });

      const request: ModuleRequest = {
        requestId: 'req-success',
        method: 'GET',
        path: '/api/test/success',
        params: {},
        query: {},
        headers: {},
        body: null
      };

      const response = await bridge.handleRequest(request);
      
      expect(response.data).toMatchObject({
        success: true,
        timestamp: expect.any(String),
        metadata: { version: '1.0' }
      });
      expect(response.error).toBeUndefined();
    });

    it('should handle error responses with proper status codes', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'POST',
          path: '/api/test/error',
          handler: 'test.error'
        }]
      });

      const errorCases = [
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          statusCode: 400
        },
        {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          statusCode: 404
        },
        {
          code: 'FORBIDDEN',
          message: 'Access denied',
          statusCode: 403
        }
      ];

      let currentError = 0;
      server.eventBus.on('test.error', (event) => {
        const error = errorCases[currentError];
        server.eventBus.emit(`response.${event.requestId}`, {
          error
        });
      });

      for (let i = 0; i < errorCases.length; i++) {
        currentError = i;
        const response = await bridge.handleRequest({
          requestId: `req-error-${i}`,
          method: 'POST',
          path: '/api/test/error',
          params: {},
          query: {},
          headers: {},
          body: {}
        });

        expect(response.error).toEqual(errorCases[i]);
      }
    });

    it('should handle streaming responses', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'stream',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/stream',
          handler: 'stream.data',
          streaming: true
        }]
      });

      const chunks: any[] = [];
      
      server.eventBus.on('stream.data', async (event) => {
        // Send multiple chunks
        for (let i = 0; i < 3; i++) {
          server.eventBus.emit(`stream.${event.requestId}`, {
            chunk: `Data chunk ${i}\n`,
            done: false
          });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // End stream
        server.eventBus.emit(`stream.${event.requestId}`, {
          done: true
        });
      });

      const request: ModuleRequest = {
        requestId: 'req-stream',
        method: 'GET',
        path: '/api/stream',
        params: {},
        query: {},
        headers: {},
        body: null
      };

      // Set up stream listener
      server.eventBus.on(`stream.${request.requestId}`, (data) => {
        if (!data.done) {
          chunks.push(data.chunk);
        }
      });

      const response = await bridge.handleRequest(request);
      
      expect(response.streaming).toBe(true);
      
      // Wait for all chunks to be received
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(chunks).toEqual([
        'Data chunk 0\n',
        'Data chunk 1\n',
        'Data chunk 2\n'
      ]);
    });
  });

  describe('Cross-Module Communication', () => {
    beforeEach(() => {
      // Register endpoints for multiple modules
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'users',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/users/:id',
          handler: 'users.get'
        }]
      });

      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'posts',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/posts/by-user/:userId',
          handler: 'posts.byUser'
        }]
      });

      // Set up handlers
      server.eventBus.on('users.get', (event) => {
        const userId = event.params.id;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: {
            id: userId,
            name: 'John Doe',
            email: 'john@example.com'
          }
        });
      });

      server.eventBus.on('posts.byUser', async (event) => {
        const userId = event.params.userId;
        
        // Call users module to get user info
        const userResponse = await server.eventBus.emitAndWait(
          'users.get',
          {
            requestId: `internal-${event.requestId}`,
            params: { id: userId }
          },
          { timeout: 1000 }
        );

        if (userResponse.error) {
          server.eventBus.emit(`response.${event.requestId}`, {
            error: { code: 'USER_NOT_FOUND', statusCode: 404 }
          });
          return;
        }

        // Return posts with user info
        server.eventBus.emit(`response.${event.requestId}`, {
          data: {
            user: userResponse.data,
            posts: [
              { id: 1, title: 'First Post', userId },
              { id: 2, title: 'Second Post', userId }
            ]
          }
        });
      });
    });

    it('should enable modules to call each other via events', async () => {
      const request: ModuleRequest = {
        requestId: 'req-cross-module',
        method: 'GET',
        path: '/api/posts/by-user/123',
        params: { userId: '123' },
        query: {},
        headers: {},
        body: null
      };

      const response = await bridge.handleRequest(request);
      
      expect(response.data).toMatchObject({
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        posts: [
          { id: 1, title: 'First Post', userId: '123' },
          { id: 2, title: 'Second Post', userId: '123' }
        ]
      });
    });
  });

  describe('Middleware Support', () => {
    it('should support pre-request middleware', async () => {
      const middlewareLog: string[] = [];

      // Register middleware
      server.eventBus.on(ServerEvents.REQUEST_MIDDLEWARE, async (event) => {
        middlewareLog.push(`pre-${event.request.path}`);
        
        // Modify request
        event.request.headers['x-middleware'] = 'processed';
        
        // Continue processing
        event.continue();
      });

      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/middleware',
          handler: 'test.middleware'
        }]
      });

      let receivedHeaders;
      server.eventBus.on('test.middleware', (event) => {
        receivedHeaders = event.headers;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { processed: true }
        });
      });

      const request: ModuleRequest = {
        requestId: 'req-middleware',
        method: 'GET',
        path: '/api/test/middleware',
        params: {},
        query: {},
        headers: { 'x-original': 'value' },
        body: null
      };

      await bridge.handleRequest(request);
      
      expect(middlewareLog).toContain('pre-/api/test/middleware');
      expect(receivedHeaders).toMatchObject({
        'x-original': 'value',
        'x-middleware': 'processed'
      });
    });

    it('should support response transformation middleware', async () => {
      // Register response transformer
      server.eventBus.on(ServerEvents.RESPONSE_MIDDLEWARE, async (event) => {
        if (event.response.data) {
          event.response.data.transformed = true;
          event.response.data.timestamp = new Date().toISOString();
        }
        event.continue();
      });

      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/transform',
          handler: 'test.transform'
        }]
      });

      server.eventBus.on('test.transform', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { original: true }
        });
      });

      const request: ModuleRequest = {
        requestId: 'req-transform',
        method: 'GET',
        path: '/api/test/transform',
        params: {},
        query: {},
        headers: {},
        body: null
      };

      const response = await bridge.handleRequest(request);
      
      expect(response.data).toMatchObject({
        original: true,
        transformed: true,
        timestamp: expect.any(String)
      });
    });
  });

  describe('Performance and Monitoring', () => {
    it('should emit performance metrics', async () => {
      const metrics: any[] = [];

      server.eventBus.on(ServerEvents.REQUEST_METRICS, (event) => {
        metrics.push(event);
      });

      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/metrics',
          handler: 'test.metrics'
        }]
      });

      server.eventBus.on('test.metrics', async (event) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { metrics: true }
        });
      });

      const request: ModuleRequest = {
        requestId: 'req-metrics',
        method: 'GET',
        path: '/api/test/metrics',
        params: {},
        query: {},
        headers: {},
        body: null
      };

      await bridge.handleRequest(request);
      
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        requestId: 'req-metrics',
        path: '/api/test/metrics',
        method: 'GET',
        moduleId: 'test',
        handler: 'test.metrics',
        duration: expect.any(Number),
        success: true
      });
      expect(metrics[0].duration).toBeGreaterThanOrEqual(50);
    });

    it('should track endpoint usage statistics', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/test/stats',
          handler: 'test.stats'
        }]
      });

      server.eventBus.on('test.stats', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { count: 1 }
        });
      });

      // Make multiple requests
      for (let i = 0; i < 5; i++) {
        await bridge.handleRequest({
          requestId: `req-stats-${i}`,
          method: 'GET',
          path: '/api/test/stats',
          params: {},
          query: {},
          headers: {},
          body: null
        });
      }

      const stats = registry.getEndpointStats('/api/test/stats');
      expect(stats).toMatchObject({
        totalRequests: 5,
        successfulRequests: 5,
        failedRequests: 0,
        averageResponseTime: expect.any(Number)
      });
    });
  });
});