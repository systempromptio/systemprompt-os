/**
 * @file Custom MCP Server Loader.
 * @module server/mcp/custom-loader
 * This module handles the discovery and loading of custom MCP servers from the
 * file system. It supports both local embedded servers (Express handlers) and
 * remote server configurations.
 * Directory structure:
 * ```
 * server/mcp/custom/
 * ├── my-local-server/      # Local embedded server
 * │   ├── package.json
 * │   └── build/index.js    # Exports createMCPHandler
 * └── remote-servers.yaml   # Remote server configurations
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { MCPServerRegistry } from '@/server/mcp/registry.js';
import type {
  ILocalMCPServer,
  IMCPLoaderOptions,
  IMCPServerModule,
  IRemoteMCPConfig,
  IRemoteMCPServer
} from '@/server/mcp/types.js';
import {
  MCPServerType
} from '@/server/mcp/types.js';

const ZERO = 0;

/**
 * Default options for the MCP loader.
 */
const DEFAULTOPTIONS: Partial<IMCPLoaderOptions> = {
  loadRemoteConfigs: true,
  remoteConfigFile: 'remote-servers.yaml'
};

/**
 * Custom MCP Server Loader.
 * Responsible for discovering and loading MCP servers from the custom directory.
 * Supports both local embedded servers and remote server configurations.
 * @example
 * ```typescript
 * const loader = new CustomMCPLoader( registry);
 * await loader.loadAllServers('./server/mcp/custom');
 * ```
 */
export class CustomMCPLoader {
  private readonly options: IMCPLoaderOptions;

  /**
   * Creates a new CustomMCPLoader instance.
   * @param registry - The MCP server registry to register servers with.
   * @param options - Loader options.
   */
  constructor(
    private readonly registry: MCPServerRegistry,
    options?: Partial<IMCPLoaderOptions>
  ) {
    this.options = {
      customDir: options?.customDir || './server/mcp/custom',
      ...DEFAULTOPTIONS,
      ...options
    };
  }

  /**
   * Load all custom MCP servers from the custom directory.
   * @param customDir - Optional override for the custom directory path.
   * @returns Promise that resolves when all servers are loaded.
   */
  async loadAllServers(customDir?: string): Promise<void> {
    const dir = customDir || this.options.customDir;

    try {
      const localServers = await this.discoverLocalServers(dir);
      for (const serverDir of localServers) {
        await this.loadLocalServer(serverDir, dir);
      }

      if (this.options.loadRemoteConfigs) {
        await this.loadRemoteConfigs(dir);
      }

      console.log(`✅ Loaded ${this.registry.getServerCount()} custom MCP servers`);
    } catch (error) {
      console.error('❌ Failed to load custom MCP servers:', error);
    }
  }

  /**
   * Discover local MCP server directories.
   * @param customDir - Directory to search for servers.
   * @returns Array of directory names containing potential MCP servers.
   */
  private async discoverLocalServers(customDir: string): Promise<string[]> {
    if (!fs.existsSync(customDir)) {
      console.log(`📁 Custom directory does not exist: ${customDir}`);
      return [];
    }

    const entries = fs.readdirSync(customDir);
    const servers: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(customDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !entry.startsWith('.')) {
        const packageJsonPath = path.join(fullPath, 'package.json');
        const indexPath = path.join(fullPath, 'index.js');
        const buildIndexPath = path.join(fullPath, 'build', 'index.js');

        if (fs.existsSync(packageJsonPath) || fs.existsSync(indexPath) || fs.existsSync(buildIndexPath)) {
          servers.push(entry);
        }
      }
    }

    console.log(`🔍 Discovered ${servers.length} local MCP servers: ${servers.join(', ')}`);
    return servers;
  }

  /**
   * Load a single local MCP server.
   * @param serverDir - Directory name of the server.
   * @param customDir - Parent custom directory.
   * @returns Promise that resolves when the server is loaded.
   */
  private async loadLocalServer(serverDir: string, customDir: string): Promise<void> {
    const serverPath = path.join(customDir, serverDir);

    try {
      console.log(`📦 Loading local MCP server: ${serverDir}`);

      const entryPoint = this.findEntryPoint(serverPath);
      if (!entryPoint) {
        throw new Error(`No entry point found for server: ${serverDir}`);
      }

      const moduleUrl = pathToFileURL(entryPoint).href;
      const module = await import(moduleUrl) as IMCPServerModule;

      if (!module.createMCPHandler || typeof module.createMCPHandler !== 'function') {
        throw new Error(`Invalid MCP server module: ${serverDir} - missing createMCPHandler export`);
      }

      const serverName = module.CONFIG?.SERVERNAME || serverDir;
      const serverVersion = module.CONFIG?.SERVERVERSION || '0.0.0';
      const serverDescription = module.CONFIG?.SERVERDESCRIPTION || `Custom MCP server: ${serverDir}`;

      const localServer: ILocalMCPServer = {
        id: serverDir,
        name: serverName,
        version: serverVersion,
        type: MCPServerType.LOCAL,
        description: serverDescription,
        createHandler: module.createMCPHandler,
        getActiveSessionCount: () => { return ZERO },
        shutdown: async () => {
          console.log(`🛑 Shutting down ${serverName}`);
        }
      };

      await this.registry.registerServer(localServer);
      console.log(`✅ Loaded local server: ${serverName} v${serverVersion}`);
    } catch (error) {
      console.error(`❌ Failed to load local server ${serverDir}:`, error);
    }
  }

  /**
   * Find the entry point for a server module.
   * @param serverPath - Path to the server directory.
   * @returns Path to the entry point file, or null if not found.
   */
  private findEntryPoint(serverPath: string): string | null {
    const packageJsonPath = path.join(serverPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.main) {
          const mainPath = path.join(serverPath, packageJson.main);
          if (fs.existsSync(mainPath)) {
            return mainPath;
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to parse package.json for ${serverPath}:`, error);
      }
    }

    const commonEntryPoints = [
      'build/index.js',
      'dist/index.js',
      'lib/index.js',
      'index.js'
    ];

    for (const entry of commonEntryPoints) {
      const entryPath = path.join(serverPath, entry);
      if (fs.existsSync(entryPath)) {
        return entryPath;
      }
    }

    return null;
  }

  /**
   * Load remote server configurations from YAML file.
   * @param customDir - Custom directory containing the config file.
   * @returns Promise that resolves when remote configs are loaded.
   */
  private async loadRemoteConfigs(customDir: string): Promise<void> {
    const configPath = path.join(customDir, this.options.remoteConfigFile || 'remote-servers.yaml');

    if (!fs.existsSync(configPath)) {
      console.log(`📄 No remote server config found at: ${configPath}`);
      return;
    }

    try {
      const configContent = fs.readFileSync(configPath.replace('.yaml', '.json'), 'utf8');
      const configs = JSON.parse(configContent) as IRemoteMCPConfig[];

      for (const config of configs) {
        const remoteServer: IRemoteMCPServer = {
          id: config.name.toLowerCase().replace(/\s+/g, '-'),
          name: config.name,
          version: '1.0.0',
          type: MCPServerType.REMOTE,
          description: `Remote MCP server: ${config.name}`,
          config
        };

        await this.registry.registerServer(remoteServer);
        console.log(`✅ Loaded remote server config: ${config.name} -> ${config.url}`);
      }
    } catch (error) {
      console.error('❌ Failed to load remote server configs:', error);
    }
  }
}
