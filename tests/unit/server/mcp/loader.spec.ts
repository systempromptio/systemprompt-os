/**
 * Unit tests for custom MCP server loading - 100% Coverage Test Suite
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomMCPLoader } from '../../../../src/server/mcp/loader.js';
import { McpServerTypeEnum } from '../../../../src/server/mcp/types.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Mock all external dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('url');

// Mock dynamic imports
const mockImport = vi.fn();
vi.stubGlobal('import', mockImport);

// Mock the registry to avoid actual class instantiation
const mockRegistry = {
  registerServer: vi.fn(),
  getServerCount: vi.fn()
};

describe('CustomMCPLoader - Complete Coverage Test Suite', () => {
  let loader: CustomMCPLoader;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    loader = new CustomMCPLoader(mockRegistry as any);
    
    // Mock console methods to avoid test noise
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Setup path.join to work like normal
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
    
    // Setup default fs mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    
    // Setup URL mock
    vi.mocked(pathToFileURL).mockReturnValue({ href: 'file:///mock/path' } as any);
    
    // Setup registry spies
    mockRegistry.registerServer.mockResolvedValue(undefined);
    mockRegistry.getServerCount.mockReturnValue(0);
    
    // Clear import mock
    mockImport.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
  });

  describe('Constructor', () => {
    it('should create loader instance with default options', () => {
      const testLoader = new CustomMCPLoader(mockRegistry as any);
      expect(testLoader).toBeDefined();
      expect(testLoader).toBeInstanceOf(CustomMCPLoader);
    });

    it('should create loader instance with custom options', () => {
      const customOptions = {
        customDir: '/custom/path',
        loadRemoteConfigs: false,
        remoteConfigFile: 'custom-remote.yaml'
      };
      const testLoader = new CustomMCPLoader(mockRegistry as any, customOptions);
      expect(testLoader).toBeDefined();
      expect(testLoader).toBeInstanceOf(CustomMCPLoader);
    });

    it('should merge default options with provided options', () => {
      const partialOptions = {
        customDir: '/custom/path'
        // loadRemoteConfigs and remoteConfigFile should use defaults
      };
      const testLoader = new CustomMCPLoader(mockRegistry as any, partialOptions);
      expect(testLoader).toBeDefined();
    });
  });

  describe('loadAllServers', () => {
    it('should load all servers from directory successfully', async () => {
      // Setup mocks for successful scenario
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('package.json') && !pathStr.includes('.hidden')) return true;
        if (pathStr.includes('remote-servers')) return false;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['test-server', 'another-server', '.hidden'] as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => ({
        isDirectory: () => {
          const pathStr = String(filePath);
          if (pathStr.includes('.hidden')) return false;
          if (pathStr.includes('test-server') || pathStr.includes('another-server')) return true;
          return false;
        }
      } as any));
      
      // Mock successful module loading
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: {
          serverName: 'Test Server',
          serverVersion: '1.0.0',
          serverDescription: 'Test Description'
        }
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(fs.readdirSync).toHaveBeenCalledWith('./test-custom');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered 2 local MCP servers'));
      expect(mockRegistry.getServerCount).toHaveBeenCalled();
    });

    it('should use custom directory parameter over options', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await loader.loadAllServers('./override-custom');
      
      expect(fs.existsSync).toHaveBeenCalledWith('./override-custom');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Custom directory does not exist: ./override-custom'));
    });

    it('should use options customDir when no parameter provided', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await loader.loadAllServers();
      
      expect(fs.existsSync).toHaveBeenCalledWith('./server/mcp/custom');
    });

    it('should load remote configs when enabled', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('remote-servers.yaml')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('[]');
      
      const loaderWithRemote = new CustomMCPLoader(mockRegistry as any, {
        customDir: './test-custom',
        loadRemoteConfigs: true,
        remoteConfigFile: 'remote-servers.yaml'
      });
      
      await loaderWithRemote.loadAllServers();
      
      expect(fs.readFileSync).toHaveBeenCalledWith('./test-custom/remote-servers.json', 'utf8');
    });

    it('should skip remote configs when disabled', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      
      const loaderNoRemote = new CustomMCPLoader(mockRegistry as any, {
        customDir: './test-custom',
        loadRemoteConfigs: false
      });
      
      await loaderNoRemote.loadAllServers();
      
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error('File system error');
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load custom MCP servers'),
        expect.any(Error)
      );
    });

    it('should log server count after successful loading', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      mockRegistry.getServerCount.mockReturnValue(3);
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Loaded 3 custom MCP servers');
    });
  });

  describe('discoverLocalServers', () => {
    it('should return empty array when directory does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      // We need to access the private method through reflection or test it indirectly
      await loader.loadAllServers('./non-existent');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Custom directory does not exist: ./non-existent'));
    });

    it('should discover servers with package.json', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('package.json')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['server1', 'server2'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered 2 local MCP servers'));
    });

    it('should discover servers with index.js', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('index.js') && !pathStr.includes('build')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['server1'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered 1 local MCP servers'));
    });

    it('should discover servers with build/index.js', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('build/index.js')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['server1'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered 1 local MCP servers'));
    });

    it('should skip hidden directories', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['.hidden', 'valid-server'] as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => ({
        isDirectory: () => !String(filePath).includes('.hidden')
      } as any));
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered 0 local MCP servers'));
    });

    it('should skip non-directories', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['file.txt', 'directory'] as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => ({
        isDirectory: () => String(filePath).includes('directory')
      } as any));
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered 0 local MCP servers'));
    });

    it('should skip directories without valid entry points', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        return pathStr === './test-custom'; // Only base directory exists
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['empty-server'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered 0 local MCP servers'));
    });
  });

  describe('loadLocalServer', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('server1') && pathStr.includes('package.json')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['server1'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
    });

    it('should load local server successfully with full config', async () => {
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: {
          serverName: 'Test Server',
          serverVersion: '2.1.0',
          serverDescription: 'Test Description'
        }
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(mockImport).toHaveBeenCalled();
      expect(mockRegistry.registerServer).toHaveBeenCalledWith(expect.objectContaining({
        id: 'server1',
        name: 'Test Server',
        version: '2.1.0',
        type: McpServerTypeEnum.LOCAL,
        description: 'Test Description'
      }));
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Loaded local server: Test Server v2.1.0');
    });

    it('should load local server with default config values', async () => {
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: {} // Empty config
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(mockRegistry.registerServer).toHaveBeenCalledWith(expect.objectContaining({
        id: 'server1',
        name: 'server1', // Uses directory name as default
        version: '0.0.0', // Default version
        description: 'Custom MCP server: server1' // Default description
      }));
    });

    it('should load local server without config object', async () => {
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn()
        // No config property
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(mockRegistry.registerServer).toHaveBeenCalledWith(expect.objectContaining({
        id: 'server1',
        name: 'server1',
        version: '0.0.0',
        description: 'Custom MCP server: server1'
      }));
    });

    it('should handle server with no entry point', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        return pathStr === './test-custom'; // No entry points exist
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load local server server1'),
        expect.any(Error)
      );
    });

    it('should handle module without createMcpHandler export', async () => {
      mockImport.mockResolvedValue({
        // Missing createMcpHandler
        config: { serverName: 'Invalid Server' }
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load local server server1'),
        expect.objectContaining({
          message: expect.stringContaining('missing createMcpHandler export')
        })
      );
    });

    it('should handle module with non-function createMcpHandler', async () => {
      mockImport.mockResolvedValue({
        createMcpHandler: 'not a function',
        config: { serverName: 'Invalid Server' }
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load local server server1'),
        expect.objectContaining({
          message: expect.stringContaining('missing createMcpHandler export')
        })
      );
    });

    it('should handle module import failure', async () => {
      mockImport.mockRejectedValue(new Error('Module not found'));
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load local server server1'),
        expect.any(Error)
      );
    });

    it('should include getActiveSessionCount and shutdown methods', async () => {
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: { serverName: 'Test Server' }
      });
      
      await loader.loadAllServers('./test-custom');
      
      const serverArg = mockRegistry.registerServer.mock.calls[0][0];
      expect(serverArg).toHaveProperty('getActiveSessionCount');
      expect(serverArg).toHaveProperty('shutdown');
      
      // Test getActiveSessionCount returns 0
      expect(serverArg.getActiveSessionCount()).toBe(0);
      
      // Test shutdown method
      await serverArg.shutdown();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Shutting down Test Server'));
    });
  });

  describe('findEntryPoint', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('server1')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['server1'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
    });

    it('should find entry point from package.json main field', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('server1') && (pathStr.includes('package.json') || pathStr.includes('custom-main.js'))) return true;
        return false;
      });
      
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        main: 'custom-main.js'
      }));
      
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: { serverName: 'Test Server' }
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(fs.readFileSync).toHaveBeenCalledWith('./test-custom/server1/package.json', 'utf8');
      expect(mockImport).toHaveBeenCalledWith('file:///mock/path');
    });

    it('should handle package.json with non-existent main file', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('server1') && pathStr.includes('package.json')) return true;
        if (pathStr.includes('server1') && pathStr.includes('index.js') && !pathStr.includes('build')) return true;
        return false;
      });
      
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        main: 'non-existent.js'
      }));
      
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: { serverName: 'Test Server' }
      });
      
      await loader.loadAllServers('./test-custom');
      
      // Should fall back to common entry points and find index.js
      expect(mockImport).toHaveBeenCalled();
    });

    it('should handle invalid package.json', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('server1') && pathStr.includes('package.json')) return true;
        if (pathStr.includes('server1') && pathStr.includes('index.js') && !pathStr.includes('build')) return true;
        return false;
      });
      
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
      
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: { serverName: 'Test Server' }
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse package.json'),
        expect.any(Error)
      );
      // Should still succeed by falling back to common entry points
      expect(mockImport).toHaveBeenCalled();
    });

    it('should try common entry points in order', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('server1')) {
          // Only dist/index.js exists (should be found after trying others)
          if (pathStr.includes('dist/index.js')) return true;
        }
        return false;
      });
      
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: { serverName: 'Test Server' }
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(mockImport).toHaveBeenCalled();
    });

    it('should return null when no entry point found', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        return pathStr === './test-custom'; // Only base directory exists
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load local server server1'),
        expect.objectContaining({
          message: expect.stringContaining('No entry point found')
        })
      );
    });
  });

  describe('loadRemoteConfigs', () => {
    it('should load remote configs successfully', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('remote-servers.yaml')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([
        {
          name: 'Remote Server 1',
          url: 'https://example.com/mcp1'
        },
        {
          name: 'Remote Server 2',
          url: 'https://example.com/mcp2'
        }
      ]));
      
      const loaderWithRemote = new CustomMCPLoader(mockRegistry as any, {
        customDir: './test-custom',
        loadRemoteConfigs: true,
        remoteConfigFile: 'remote-servers.yaml'
      });
      
      await loaderWithRemote.loadAllServers();
      
      expect(fs.readFileSync).toHaveBeenCalledWith('./test-custom/remote-servers.json', 'utf8');
      expect(mockRegistry.registerServer).toHaveBeenCalledWith(expect.objectContaining({
        id: 'remote-server-1',
        name: 'Remote Server 1',
        version: '1.0.0',
        type: McpServerTypeEnum.REMOTE,
        description: 'Remote MCP server: Remote Server 1',
        config: expect.objectContaining({
          name: 'Remote Server 1',
          url: 'https://example.com/mcp1'
        })
      }));
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Loaded remote server config: Remote Server 1 -> https://example.com/mcp1');
    });

    it('should handle config file not found', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        return false; // Config file doesn't exist
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      
      const loaderWithRemote = new CustomMCPLoader(mockRegistry as any, {
        customDir: './test-custom',
        loadRemoteConfigs: true
      });
      
      await loaderWithRemote.loadAllServers();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No remote server config found at'));
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in config file', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('remote-servers.yaml')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
      
      const loaderWithRemote = new CustomMCPLoader(mockRegistry as any, {
        customDir: './test-custom',
        loadRemoteConfigs: true
      });
      
      await loaderWithRemote.loadAllServers();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load remote server configs'),
        expect.any(Error)
      );
    });

    it('should handle file read error', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('remote-servers.yaml')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const loaderWithRemote = new CustomMCPLoader(mockRegistry as any, {
        customDir: './test-custom',
        loadRemoteConfigs: true
      });
      
      await loaderWithRemote.loadAllServers();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load remote server configs'),
        expect.any(Error)
      );
    });

    it('should use default remote config file name', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('remote-servers.yaml')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue('[]');
      
      const loaderWithRemote = new CustomMCPLoader(mockRegistry as any, {
        customDir: './test-custom',
        loadRemoteConfigs: true
        // No remoteConfigFile specified, should use default
      });
      
      await loaderWithRemote.loadAllServers();
      
      expect(fs.existsSync).toHaveBeenCalledWith('./test-custom/remote-servers.yaml');
      expect(fs.readFileSync).toHaveBeenCalledWith('./test-custom/remote-servers.json', 'utf8');
    });

    it('should generate proper server IDs from names', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('remote-servers.yaml')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([
        {
          name: 'My Complex Server Name',
          url: 'https://example.com/mcp'
        }
      ]));
      
      const loaderWithRemote = new CustomMCPLoader(mockRegistry as any, {
        customDir: './test-custom',
        loadRemoteConfigs: true
      });
      
      await loaderWithRemote.loadAllServers();
      
      expect(mockRegistry.registerServer).toHaveBeenCalledWith(expect.objectContaining({
        id: 'my-complex-server-name' // Should convert to lowercase kebab-case
      }));
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle mixed successful and failed server loading', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('good-server') && pathStr.includes('package.json')) return true;
        if (pathStr.includes('bad-server') && pathStr.includes('index.js') && !pathStr.includes('build')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['good-server', 'bad-server'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      
      let callCount = 0;
      mockImport.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call succeeds
          return Promise.resolve({
            createMcpHandler: vi.fn(),
            config: { serverName: 'Good Server' }
          });
        } else {
          // Second call fails
          return Promise.reject(new Error('Module loading failed'));
        }
      });
      
      await loader.loadAllServers('./test-custom');
      
      expect(mockRegistry.registerServer).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Loaded local server: Good Server v0.0.0');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load local server bad-server'),
        expect.any(Error)
      );
    });

    it('should handle registry registration errors', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('server1') && pathStr.includes('package.json')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['server1'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: { serverName: 'Test Server' }
      });
      
      mockRegistry.registerServer.mockRejectedValue(new Error('Registration failed'));
      
      await loader.loadAllServers('./test-custom');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load local server server1'),
        expect.any(Error)
      );
    });

    it('should use correct constant values', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr === './test-custom') return true;
        if (pathStr.includes('server1') && pathStr.includes('package.json')) return true;
        return false;
      });
      
      vi.mocked(fs.readdirSync).mockReturnValue(['server1'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
      
      mockImport.mockResolvedValue({
        createMcpHandler: vi.fn(),
        config: { serverName: 'Test Server' }
      });
      
      await loader.loadAllServers('./test-custom');
      
      const serverArg = mockRegistry.registerServer.mock.calls[0][0];
      // Verify ZERO constant is used for getActiveSessionCount
      expect(serverArg.getActiveSessionCount()).toBe(0);
    });

    it('should handle all entry point variations in common entry points list', async () => {
      const entryPoints = [
        'src/index.ts',
        'index.ts', 
        'build/index.js',
        'dist/index.js',
        'lib/index.js',
        'index.js'
      ];
      
      for (let i = 0; i < entryPoints.length; i++) {
        const targetEntry = entryPoints[i];
        
        vi.clearAllMocks();
        mockImport.mockClear();
        
        vi.mocked(fs.existsSync).mockImplementation((filePath: any) => {
          const pathStr = String(filePath);
          if (pathStr === './test-custom') return true;
          if (pathStr.includes('server1')) {
            if (pathStr.endsWith(targetEntry)) return true;
          }
          return false;
        });
        
        vi.mocked(fs.readdirSync).mockReturnValue(['server1'] as any);
        vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
        
        mockImport.mockResolvedValue({
          createMcpHandler: vi.fn(),
          config: { serverName: `Test Server ${i}` }
        });
        
        const testLoader = new CustomMCPLoader(mockRegistry as any, { customDir: './test-custom' });
        await testLoader.loadAllServers();
        
        expect(mockImport).toHaveBeenCalled();
      }
    });
  });
});