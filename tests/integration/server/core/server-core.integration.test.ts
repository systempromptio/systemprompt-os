/**
 * Server Core Integration Tests
 * 
 * These tests verify the core server functionality:
 * - Server lifecycle management
 * - Event bus communication
 * - Protocol registration
 * - Service registry
 * 
 * These tests will fail initially and drive the implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServerCore } from '@/server/core/server';
import { EventBus } from '@/server/core/services/event-bus.service';
import { ServiceRegistry } from '@/server/core/services/registry.service';
import { IProtocolHandler } from '@/server/core/types/server.types';
import { ServerEvents } from '@/server/core/types/events.types';

describe('Server Core Integration Tests', () => {
  let server: ServerCore;

  beforeEach(() => {
    server = new ServerCore({ 
      port: 0, // Random port
      name: 'test-server'
    });
  });

  afterEach(async () => {
    if (server && server.getStatus() === 'running') {
      await server.stop();
    }
  });

  describe('Server Lifecycle', () => {
    it('should start without knowing about modules', async () => {
      // Server should be completely independent of modules
      await server.start();
      
      expect(server.getStatus()).toBe('running');
      expect(server.getPort()).toBeGreaterThan(0);
      
      // Should not have any module references
      const serverCode = server.constructor.toString();
      expect(serverCode).not.toContain('getModuleRegistry');
      expect(serverCode).not.toContain('import.*modules');
    });

    it('should stop gracefully with active connections', async () => {
      await server.start();
      
      // Simulate active connections
      const mockConnection = { id: 'conn-1', close: vi.fn() };
      server.trackConnection(mockConnection);
      
      await server.stop();
      
      expect(server.getStatus()).toBe('stopped');
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should emit lifecycle events', async () => {
      const events: string[] = [];
      
      server.eventBus.on(ServerEvents.STARTING, () => events.push('starting'));
      server.eventBus.on(ServerEvents.STARTED, () => events.push('started'));
      server.eventBus.on(ServerEvents.STOPPING, () => events.push('stopping'));
      server.eventBus.on(ServerEvents.STOPPED, () => events.push('stopped'));
      
      await server.start();
      await server.stop();
      
      expect(events).toEqual(['starting', 'started', 'stopping', 'stopped']);
    });

    it('should handle restart correctly', async () => {
      await server.start();
      const firstPort = server.getPort();
      
      await server.restart();
      
      expect(server.getStatus()).toBe('running');
      expect(server.getPort()).toBe(firstPort); // Should reuse same port
    });
  });

  describe('Event Bus', () => {
    it('should have a functional event bus', async () => {
      await server.start();
      
      const received: any[] = [];
      
      // Subscribe to event
      server.eventBus.on('test.event', (data) => {
        received.push(data);
      });
      
      // Emit event
      server.eventBus.emit('test.event', { message: 'hello' });
      
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ message: 'hello' });
    });

    it('should support request/response pattern', async () => {
      await server.start();
      
      // Handler that responds to requests
      server.eventBus.on('math.add', async (event) => {
        const result = event.a + event.b;
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { result }
        });
      });
      
      // Make a request and wait for response
      const response = await server.eventBus.emitAndWait(
        'math.add',
        { a: 5, b: 3, requestId: 'req-123' },
        { timeout: 1000 }
      );
      
      expect(response.data.result).toBe(8);
    });

    it('should handle timeouts in request/response', async () => {
      await server.start();
      
      // No handler registered - will timeout
      await expect(
        server.eventBus.emitAndWait(
          'no.handler',
          { requestId: 'req-timeout' },
          { timeout: 100 }
        )
      ).rejects.toThrow('Request timeout');
    });

    it('should support event namespaces', async () => {
      await server.start();
      
      const moduleEvents: any[] = [];
      const serverEvents: any[] = [];
      
      server.eventBus.on('module.*', (event) => {
        moduleEvents.push(event);
      });
      
      server.eventBus.on('server.*', (event) => {
        serverEvents.push(event);
      });
      
      server.eventBus.emit('module.initialized', { name: 'test' });
      server.eventBus.emit('server.ready', { port: 3000 });
      server.eventBus.emit('other.event', { data: 'ignored' });
      
      expect(moduleEvents).toHaveLength(1);
      expect(serverEvents).toHaveLength(1);
    });
  });

  describe('Protocol Registration', () => {
    it('should register protocol handlers dynamically', async () => {
      await server.start();
      
      // Create a mock protocol handler
      const mockHttpHandler: IProtocolHandler = {
        name: 'http',
        async initialize(server: ServerCore) {
          // Protocol-specific initialization
          return true;
        },
        async start() {
          // Start handling requests
        },
        async stop() {
          // Stop handling requests
        },
        getStatus() {
          return 'running';
        }
      };
      
      await server.registerProtocol('http', mockHttpHandler);
      
      expect(server.getProtocols()).toContain('http');
      expect(server.getProtocolHandler('http')).toBe(mockHttpHandler);
    });

    it('should initialize protocols on registration', async () => {
      await server.start();
      
      let initialized = false;
      const mockHandler: IProtocolHandler = {
        name: 'test',
        async initialize() {
          initialized = true;
          return true;
        },
        async start() {},
        async stop() {},
        getStatus: () => 'running'
      };
      
      await server.registerProtocol('test', mockHandler);
      
      expect(initialized).toBe(true);
    });

    it('should start/stop protocols with server', async () => {
      const events: string[] = [];
      
      const mockHandler: IProtocolHandler = {
        name: 'test',
        async initialize() { return true; },
        async start() { events.push('protocol-start'); },
        async stop() { events.push('protocol-stop'); },
        getStatus: () => 'running'
      };
      
      await server.registerProtocol('test', mockHandler);
      
      await server.start();
      expect(events).toContain('protocol-start');
      
      await server.stop();
      expect(events).toContain('protocol-stop');
    });
  });

  describe('Service Registry', () => {
    it('should have a service registry', async () => {
      await server.start();
      
      const registry = server.getServiceRegistry();
      
      expect(registry).toBeDefined();
      expect(registry).toBeInstanceOf(ServiceRegistry);
    });

    it('should register and retrieve services', async () => {
      await server.start();
      
      const mockService = {
        name: 'test-service',
        doSomething: () => 'result'
      };
      
      server.registerService('test', mockService);
      
      const retrieved = server.getService('test');
      expect(retrieved).toBe(mockService);
      expect(retrieved.doSomething()).toBe('result');
    });

    it('should emit events when services are registered', async () => {
      await server.start();
      
      let registeredService;
      server.eventBus.on(ServerEvents.SERVICE_REGISTERED, (event) => {
        registeredService = event;
      });
      
      const mockService = { name: 'test' };
      server.registerService('test', mockService);
      
      expect(registeredService).toEqual({
        name: 'test',
        service: mockService
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const errorHandler: IProtocolHandler = {
        name: 'error',
        async initialize() {
          throw new Error('Initialization failed');
        },
        async start() {},
        async stop() {},
        getStatus: () => 'error'
      };
      
      await expect(
        server.registerProtocol('error', errorHandler)
      ).rejects.toThrow('Initialization failed');
      
      // Server should still be functional
      expect(server.getStatus()).toBe('initialized');
    });

    it('should emit error events', async () => {
      await server.start();
      
      let errorEvent;
      server.eventBus.on(ServerEvents.ERROR, (event) => {
        errorEvent = event;
      });
      
      // Trigger an error
      server.eventBus.emit('internal.error', new Error('Test error'));
      
      expect(errorEvent).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should accept and use configuration', async () => {
      const customServer = new ServerCore({
        port: 3456,
        name: 'custom-server',
        eventBus: {
          maxListeners: 100,
          wildcard: true
        }
      });
      
      await customServer.start();
      
      expect(customServer.getPort()).toBe(3456);
      expect(customServer.getName()).toBe('custom-server');
      
      await customServer.stop();
    });

    it('should validate configuration', () => {
      expect(() => {
        new ServerCore({
          port: -1, // Invalid port
          name: 'test'
        });
      }).toThrow('Invalid port number');
    });
  });

  describe('Health Checks', () => {
    it('should provide health status', async () => {
      await server.start();
      
      const health = await server.getHealth();
      
      expect(health).toEqual({
        status: 'healthy',
        uptime: expect.any(Number),
        protocols: expect.any(Array),
        services: expect.any(Array),
        eventBus: {
          status: 'active',
          pendingEvents: expect.any(Number)
        }
      });
    });

    it('should include protocol health in overall health', async () => {
      const unhealthyHandler: IProtocolHandler = {
        name: 'unhealthy',
        async initialize() { return true; },
        async start() {},
        async stop() {},
        getStatus: () => 'error',
        async getHealth() {
          return { healthy: false, reason: 'Connection failed' };
        }
      };
      
      await server.registerProtocol('unhealthy', unhealthyHandler);
      await server.start();
      
      const health = await server.getHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.protocols).toContainEqual({
        name: 'unhealthy',
        status: 'error',
        health: { healthy: false, reason: 'Connection failed' }
      });
    });
  });

  describe('Graceful Shutdown', () => {
    it('should drain event queue on shutdown', async () => {
      await server.start();
      
      const processed: number[] = [];
      
      // Handler that takes time
      server.eventBus.on('slow.process', async (data) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        processed.push(data.value);
      });
      
      // Queue up events
      server.eventBus.emit('slow.process', { value: 1 });
      server.eventBus.emit('slow.process', { value: 2 });
      server.eventBus.emit('slow.process', { value: 3 });
      
      // Stop should wait for events to process
      await server.stop({ gracefulTimeout: 200 });
      
      expect(processed).toEqual([1, 2, 3]);
    });

    it('should force shutdown after timeout', async () => {
      await server.start();
      
      // Handler that never completes
      server.eventBus.on('never.complete', async () => {
        await new Promise(() => {}); // Never resolves
      });
      
      server.eventBus.emit('never.complete', {});
      
      const startTime = Date.now();
      await server.stop({ gracefulTimeout: 100 });
      const stopTime = Date.now();
      
      // Should timeout and force stop
      expect(stopTime - startTime).toBeLessThan(200);
      expect(server.getStatus()).toBe('stopped');
    });
  });
});