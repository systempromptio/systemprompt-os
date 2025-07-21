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
  initializeMCPServerRegistry: vi.fn(() => mockRegistry),
  getMCPServerRegistry: vi.fn(() => mockRegistry)
}));

vi.mock('../../../src/server/mcp/core/server', () => ({
  CoreMCPServer: vi.fn().mockImplementation(() => ({
    name: 'core',
    version: '1.0.0',
    handleRequest: vi.fn(),
    getActiveSessionCount: vi.fn().mockReturnValue(0),
    shutdown: vi.fn()
  }))
}));

vi.mock('../../../src/server/mcp/loader', () => ({
  CustomMCPLoader: vi.fn().mockImplementation(() => ({
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

  describe('setupMCPServers', () => {
    it('should setup MCP servers with registry', async () => {
      const { setupMCPServers } = await import('../../../src/server/mcp/index.js');
      const { CoreMCPServer } = await import('../../../src/server/mcp/core/server.js');
      const { CustomMCPLoader } = await import('../../../src/server/mcp/loader.js');
      
      await setupMCPServers(mockApp);
      
      expect(CoreMCPServer).toHaveBeenCalled();
      expect(CustomMCPLoader).toHaveBeenCalled();
      expect(mockRegistry.registerServer).toHaveBeenCalled();
      expect(mockRegistry.setupRoutes).toHaveBeenCalledWith(mockApp);
      expect(mockConsole.log).toHaveBeenCalledWith('✅ MCP server setup complete');
    });

    it('should handle custom loader errors gracefully', async () => {
      const { CustomMCPLoader } = await import('../../../src/server/mcp/loader.js');
      vi.mocked(CustomMCPLoader).mockImplementationOnce(() => ({
        loadAllServers: vi.fn().mockRejectedValue(new Error('Load failed'))
      }));
      
      const { setupMCPServers } = await import('../../../src/server/mcp/index.js');
      
      await setupMCPServers(mockApp);
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        '❌ Failed to load custom MCP servers:',
        expect.any(Error)
      );
    });
  });

  describe('MCPHandler', () => {
    it('should create handler instance', async () => {
      const { setupMCPServers } = await import('../../../src/server/mcp/index.js');
      
      await setupMCPServers(mockApp);
      
      // Verify the handler was created by checking server registration
      expect(mockRegistry.registerServer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'core',
          description: 'Core SystemPrompt MCP server with basic tools and resources'
        })
      );
    });
  });

  // Skip tests that rely on real implementations
  it('should start all MCP servers', async () => {
    const { setupMCPServers } = await import('../../../src/server/mcp/index.js');
    
    // Mock the registry
    const mockRegistry = {
      getServers: vi.fn().mockReturnValue([
        { name: 'test-server', transport: 'stdio' }
      ]),
      startServer: vi.fn().mockResolvedValue(undefined)
    };
    
    vi.mocked(getMCPServerRegistry).mockReturnValue(mockRegistry as any);
    
    await setupMCPServers(mockApp);
    
    expect(mockRegistry.startServer).toHaveBeenCalledWith('test-server');
  });

  it('should handle server startup errors', async () => {
    const { setupMCPServers } = await import('../../../src/server/mcp/index.js');
    
    // Mock the registry with error
    const mockRegistry = {
      getServers: vi.fn().mockReturnValue([
        { name: 'error-server', transport: 'stdio' }
      ]),
      startServer: vi.fn().mockRejectedValue(new Error('Startup failed'))
    };
    
    vi.mocked(getMCPServerRegistry).mockReturnValue(mockRegistry as any);
    
    await setupMCPServers(mockApp);
    
    expect(mockConsole.error).toHaveBeenCalledWith(
      'Failed to start MCP server error-server:',
      expect.any(Error)
    );
  });
});