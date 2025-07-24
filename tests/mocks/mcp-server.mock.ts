import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { MCPServer, MCPSession } from '../../src/server/mcp/types.js';

export function createMockMCPServer(): MockedMCPServer {
  const sessions = new Map<string, MCPSession>();
  
  return {
    name: 'mock-mcp-server',
    version: '1.0.0',
    sessions,
    
    createServer: vi.fn(),
    handleRequest: vi.fn().mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: {}
    }),
    
    getActiveSessionCount: vi.fn(() => sessions.size),
    
    cleanupOldSessions: vi.fn(() => {
      const now = Date.now();
      for (const [id, session] of sessions.entries()) {
        if (now - session.lastActivity.getTime() > 3600000) {
          sessions.delete(id);
        }
      }
    }),
    
    shutdown: vi.fn(() => {
      sessions.clear();
    }),
    
    // Helper methods for testing
    addSession: (id: string, session: MCPSession) => {
      sessions.set(id, session);
    },
    
    getSession: (id: string) => sessions.get(id),
    
    clearSessions: () => sessions.clear()
  };
}

export type MockedMCPServer = {
  [K in keyof MCPServer]: MCPServer[K] extends (...args: any[]) => any
    ? MockedFunction<MCPServer[K]>
    : MCPServer[K];
} & {
  addSession: (id: string, session: MCPSession) => void;
  getSession: (id: string) => MCPSession | undefined;
  clearSessions: () => void;
};

export function mockMCPServerModule() {
  const mockServer = createMockMCPServer();
  
  vi.mock('../../src/server/mcp/core/server', () => ({
    createMCPServer: vi.fn(() => mockServer),
    CoreMCPServer: vi.fn(() => mockServer)
  }));
  
  return mockServer;
}