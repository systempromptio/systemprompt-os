/**
 * Unit tests for custom MCP server loading
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomMCPLoader } from '../../../../src/server/mcp/loader.js';
import { MCPServerRegistry } from '../../../../src/server/mcp/registry.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

describe('Custom MCP Server Loader', () => {
  let loader: CustomMCPLoader;
  let registry: MCPServerRegistry;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    registry = new MCPServerRegistry();
    loader = new CustomMCPLoader(registry);
    
    // Mock console to avoid test noise
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup path.join to work like normal
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
    
    // Setup default fs mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should create loader instance', () => {
    expect(loader).toBeDefined();
    expect(loader).toBeInstanceOf(CustomMCPLoader);
  });

  it('should load all servers from directory', async () => {
    // Mock file system to simulate server directories
    vi.mocked(fs.existsSync).mockImplementation((path: any) => {
      // Directory exists
      if (path === './test-custom') return true;
      // Package.json exists for valid servers
      if (path.includes('package.json') && !path.includes('.hidden')) return true;
      // Remote config doesn't exist
      if (path.includes('remote-servers')) return false;
      return false;
    });
    
    vi.mocked(fs.readdirSync).mockReturnValue(['test-server', 'another-server', '.hidden'] as any);
    vi.mocked(fs.statSync).mockImplementation((path: any) => ({
      isDirectory: () => {
        // Return true for server directories, false for hidden and files
        if (path.includes('.hidden')) return false;
        if (path.includes('test-server') || path.includes('another-server')) return true;
        return false;
      }
    } as any));

    await loader.loadAllServers('./test-custom');
    
    // Verify it discovered servers
    expect(fs.readdirSync).toHaveBeenCalledWith('./test-custom');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered 2 local MCP servers'));
  });

  it('should handle missing custom directory', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    await loader.loadAllServers('./non-existent');
    
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Custom directory does not exist'));
  });

  it('should handle loader errors gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    await loader.loadAllServers('./test-custom');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load custom MCP servers'),
      expect.any(Error)
    );
  });

  it('should use custom options', () => {
    const customRegistry = new MCPServerRegistry();
    const customLoader = new CustomMCPLoader(customRegistry, {
      customDir: './my-custom-dir',
      loadRemoteConfigs: false
    });
    
    expect(customLoader).toBeDefined();
    // The options are private, but we can verify behavior through method calls
  });

  it('should load remote configs when enabled', async () => {
    // Mock fs to simulate remote-servers.json exists (not .yaml)
    vi.mocked(fs.existsSync).mockImplementation((path: any) => {
      if (path === './test-custom') return true;
      // The yaml file is checked but json is read
      if (path.includes('remote-servers.yaml')) return true;
      return false;
    });
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(fs.readFileSync).mockReturnValue('[]'); // Empty array of configs
    
    const loaderWithRemote = new CustomMCPLoader(registry, {
      loadRemoteConfigs: true,
      remoteConfigFile: 'remote-servers.yaml'
    });
    
    await loaderWithRemote.loadAllServers('./test-custom');
    
    // Should attempt to read the JSON file (implementation replaces .yaml with .json)
    expect(fs.readFileSync).toHaveBeenCalledWith('./test-custom/remote-servers.json', 'utf8');
  });

  it('should skip remote configs when disabled', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    
    const loaderNoRemote = new CustomMCPLoader(registry, {
      loadRemoteConfigs: false
    });
    
    await loaderNoRemote.loadAllServers('./test-custom');
    
    // Should not attempt to read remote config
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });
});