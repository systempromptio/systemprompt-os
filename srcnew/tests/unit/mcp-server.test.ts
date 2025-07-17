import { describe, it, expect } from 'vitest';
import { createMCPServer } from '../../dist/src/server/mcp/core/server.js';

describe('MCP Server', () => {
  it('should create an MCP server instance', () => {
    const server = createMCPServer();
    expect(server).toBeDefined();
    expect(server.name).toBe('systemprompt-os-core');
    expect(server.version).toBe('0.1.0');
  });

  it('should maintain session state', () => {
    const server = createMCPServer();
    expect(server.sessions).toBeDefined();
    expect(server.sessions.size).toBe(0);
    expect(server.getActiveSessionCount()).toBe(0);
  });

  it('should have session management methods', () => {
    const server = createMCPServer();
    expect(typeof server.createServer).toBe('function');
    expect(typeof server.handleRequest).toBe('function');
    expect(typeof server.cleanupOldSessions).toBe('function');
    expect(typeof server.shutdown).toBe('function');
  });
});