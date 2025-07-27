/**
 * @fileoverview Unit tests for MCP Server
 * @module tests/unit/server/mcp
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';

// Create mock registry
const mockRegistry = {
  registerServer: vi.fn().mockResolvedValue(undefined),
  setupRoutes: vi.fn().mockResolvedValue(undefined),
  getServer: vi.fn(),
  getAllServers: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined),
  getServers: vi.fn().mockReturnValue([]),
  startServer: vi.fn().mockResolvedValue(undefined)
};

// Mock dependencies
vi.mock('../../../src/server/mcp/registry', () => ({
  initializeMcpServerRegistry: vi.fn(() => mockRegistry),
  getMcpServerRegistry: vi.fn(() => mockRegistry)
}));

vi.mock('../../../src/server/mcp/remote/index', () => ({
  createRemoteMcpServer: vi.fn().mockReturnValue({
    id: 'remote',
    description: 'Remote MCP server',
    serverConfig: {}
  })
}));

vi.mock('../../../src/server/mcp/loader', () => ({
  CustomMcpLoader: vi.fn().mockImplementation(() => ({
    loadAllServers: vi.fn().mockResolvedValue(undefined)
  }))
}));

// We'll set up console mocks in beforeEach
let mockConsole: any;

describe('MCP Server', () => {
  let mockApp: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up console mocks
    mockConsole = {
      log: vi.spyOn(console, 'log').mockImplementation(),
      error: vi.spyOn(console, 'error').mockImplementation()
    };
    
    mockApp = {
      use: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      all: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore console methods
    mockConsole?.log?.mockRestore();
    mockConsole?.error?.mockRestore();
  });

  describe('setupMcpServers', () => {
    it('should setup MCP servers with registry', async () => {
      const { setupMcpServers } = await import('../../../src/server/mcp/index.js');
      const { createRemoteMcpServer } = await import('../../../src/server/mcp/remote/index.js');
      const { CustomMcpLoader } = await import('../../../src/server/mcp/loader.js');
      
      await setupMcpServers(mockApp);
      
      expect(createRemoteMcpServer).toHaveBeenCalled();
      expect(CustomMcpLoader).toHaveBeenCalled();
      expect(mockRegistry.registerServer).toHaveBeenCalled();
      expect(mockRegistry.setupRoutes).toHaveBeenCalledWith(mockApp);
      expect(mockConsole.log).toHaveBeenCalled();
    });

    it('should handle custom loader errors gracefully', async () => {
      const { CustomMcpLoader } = await import('../../../src/server/mcp/loader.js');
      vi.mocked(CustomMcpLoader).mockImplementationOnce(() => ({
        loadAllServers: vi.fn().mockRejectedValue(new Error('Load failed'))
      }));
      
      const { setupMcpServers } = await import('../../../src/server/mcp/index.js');
      
      await setupMcpServers(mockApp);
      
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('McpHandler', () => {
    it('should create handler instance', async () => {
      const { setupMcpServers } = await import('../../../src/server/mcp/index.js');
      
      await setupMcpServers(mockApp);
      
      // Verify the handler was created by checking server registration
      expect(mockRegistry.registerServer).toHaveBeenCalled();
    });
  });

});