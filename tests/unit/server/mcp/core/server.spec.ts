import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMCPServer, CoreMCPServer } from '../../../../../src/server/mcp/core/server';

describe('MCPServer', () => {
  let server: CoreMCPServer;

  beforeEach(() => {
    server = createMCPServer();
  });

  afterEach(() => {
    if (server && typeof server.shutdown === 'function') {
      server.shutdown();
    }
  });

  describe('initialization', () => {
    it('should create server with correct metadata', () => {
      // Assert
      expect(server).toBeDefined();
      expect(server.name).toBe('systemprompt-os-core');
      expect(server.version).toBe('0.1.0');
    });

    it('should initialize with empty session state', () => {
      // Assert
      expect(server.getActiveSessionCount()).toBe(0);
    });

    it('should expose required session management methods', () => {
      // Assert
      expect(server.createServer).toBeInstanceOf(Function);
      expect(server.handleRequest).toBeInstanceOf(Function);
      expect(server.shutdown).toBeInstanceOf(Function);
    });
  });

  describe('session management', () => {
    const createMockSession = (sessionId: string, createdTime = new Date()) => ({
      server: {
        close: vi.fn()
      },
      transport: {
        close: vi.fn()
      },
      createdAt: createdTime,
      lastAccessed: createdTime
    });

    it('should track active sessions correctly', () => {
      // Arrange
      const sessionId = 'test-session-123';
      const mockSession = createMockSession(sessionId);

      // Act - Access private sessions map
      (server as any).sessions.set(sessionId, mockSession);

      // Assert
      expect(server.getActiveSessionCount()).toBe(1);
      expect((server as any).sessions.has(sessionId)).toBe(true);
    });

    it('should clean up old sessions', () => {
      // Arrange
      const oldSession = createMockSession(
        'old-session',
        new Date(Date.now() - 65 * 60 * 1000) // 65 minutes ago (older than 1 hour timeout)
      );
      const newSession = createMockSession('new-session', new Date());

      (server as any).sessions.set('old-session', oldSession);
      (server as any).sessions.set('new-session', newSession);

      // Act
      (server as any).cleanupOldSessions();

      // Assert
      expect((server as any).sessions.has('old-session')).toBe(false);
      expect((server as any).sessions.has('new-session')).toBe(true);
      expect(server.getActiveSessionCount()).toBe(1);
      expect(oldSession.server.close).toHaveBeenCalled();
      expect(oldSession.transport.close).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should clear all sessions on shutdown', () => {
      // Arrange
      const session1 = {
        server: { close: vi.fn() },
        transport: { close: vi.fn() },
        createdAt: new Date(),
        lastAccessed: new Date()
      };
      const session2 = {
        server: { close: vi.fn() },
        transport: { close: vi.fn() },
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      (server as any).sessions.set('session-1', session1);
      (server as any).sessions.set('session-2', session2);

      // Act
      server.shutdown();

      // Assert
      expect((server as any).sessions.size).toBe(0);
      expect(server.getActiveSessionCount()).toBe(0);
      expect(session1.server.close).toHaveBeenCalled();
      expect(session1.transport.close).toHaveBeenCalled();
      expect(session2.server.close).toHaveBeenCalled();
      expect(session2.transport.close).toHaveBeenCalled();
    });

    it('should clear cleanup interval on shutdown', () => {
      // Arrange
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      // Create a new server to ensure interval is set
      const newServer = createMCPServer();
      
      // Act
      newServer.shutdown();

      // Assert
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });
});