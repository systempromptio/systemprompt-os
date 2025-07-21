/**
 * @fileoverview Unit tests for MCP server setup
 * @module tests/unit/server/mcp
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Express } from 'express';
import { setupMCPServers } from '@/server/mcp/index.js';
import { initializeMCPServerRegistry } from '@/server/mcp/registry.js';
import { CoreMCPServer } from '@/server/mcp/core/server.js';
import { CustomMCPLoader } from '@/server/mcp/loader.js';

vi.mock('@/server/mcp/registry.js', () => ({
  initializeMCPServerRegistry: vi.fn()
}));

vi.mock('@/server/mcp/core/server.js', () => ({
  CoreMCPServer: vi.fn()
}));

vi.mock('@/server/mcp/loader.js', () => ({
  CustomMCPLoader: vi.fn()
}));

describe('MCP Server Setup', () => {
  let mockApp: Express;
  let mockRegistry: any;
  let mockCoreServer: any;
  let mockCustomLoader: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    mockApp = {} as Express;
    
    mockRegistry = {
      registerServer: vi.fn().mockResolvedValue(undefined),
      setupRoutes: vi.fn().mockResolvedValue(undefined)
    };
    
    mockCoreServer = {
      name: 'Core MCP Server',
      version: '1.0.0',
      handleRequest: vi.fn(),
      getActiveSessionCount: vi.fn().mockReturnValue(0),
      shutdown: vi.fn()
    };
    
    mockCustomLoader = {
      loadAllServers: vi.fn().mockResolvedValue(undefined)
    };
    
    vi.mocked(initializeMCPServerRegistry).mockReturnValue(mockRegistry);
    vi.mocked(CoreMCPServer).mockImplementation(() => mockCoreServer);
    vi.mocked(CustomMCPLoader).mockImplementation(() => mockCustomLoader);
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    vi.clearAllMocks();
  });

  it('should initialize MCP server registry', async () => {
    await setupMCPServers(mockApp);
    
    expect(initializeMCPServerRegistry).toHaveBeenCalled();
  });

  it('should register core MCP server', async () => {
    await setupMCPServers(mockApp);
    
    expect(CoreMCPServer).toHaveBeenCalled();
    expect(mockRegistry.registerServer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'core',
        name: 'Core MCP Server',
        version: '1.0.0',
        type: 'local',
        description: 'Core SystemPrompt MCP server with basic tools and resources'
      })
    );
  });

  it('should create handler function for core server', async () => {
    await setupMCPServers(mockApp);
    
    const registeredServer = vi.mocked(mockRegistry.registerServer).mock.calls[0][0];
    const handler = registeredServer.createHandler();
    
    expect(typeof handler).toBe('function');
    // Verify it's bound to the core server
    handler();
    expect(mockCoreServer.handleRequest).toHaveBeenCalled();
  });

  it('should provide session count getter', async () => {
    await setupMCPServers(mockApp);
    
    const registeredServer = vi.mocked(mockRegistry.registerServer).mock.calls[0][0];
    const count = registeredServer.getActiveSessionCount();
    
    expect(count).toBe(0);
    expect(mockCoreServer.getActiveSessionCount).toHaveBeenCalled();
  });

  it('should provide shutdown function', async () => {
    await setupMCPServers(mockApp);
    
    const registeredServer = vi.mocked(mockRegistry.registerServer).mock.calls[0][0];
    registeredServer.shutdown();
    
    expect(mockCoreServer.shutdown).toHaveBeenCalled();
  });

  it('should load custom MCP servers', async () => {
    await setupMCPServers(mockApp);
    
    expect(CustomMCPLoader).toHaveBeenCalledWith(mockRegistry);
    expect(mockCustomLoader.loadAllServers).toHaveBeenCalledWith(
      expect.stringContaining('server/mcp/custom')
    );
  });

  it('should handle custom loader errors gracefully', async () => {
    const error = new Error('Failed to load');
    mockCustomLoader.loadAllServers.mockRejectedValue(error);
    
    await setupMCPServers(mockApp);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Failed to load custom MCP servers:',
      error
    );
  });

  it('should setup routes for all servers', async () => {
    await setupMCPServers(mockApp);
    
    expect(mockRegistry.setupRoutes).toHaveBeenCalledWith(mockApp);
  });

  it('should log success message', async () => {
    await setupMCPServers(mockApp);
    
    expect(consoleLogSpy).toHaveBeenCalledWith('✅ MCP server setup complete');
  });

  it('should complete setup even if custom loader fails', async () => {
    mockCustomLoader.loadAllServers.mockRejectedValue(new Error('Load failed'));
    
    await setupMCPServers(mockApp);
    
    expect(mockRegistry.setupRoutes).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('✅ MCP server setup complete');
  });
});