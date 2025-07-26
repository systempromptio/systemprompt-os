/**
 * Custom MCP Server Loader.
 * @description This module handles the discovery and loading of custom MCP servers from the
 * file system. It supports both local embedded servers (Express handlers) and
 * remote server configurations.
 * @module server/mcp/custom-loader
 * Directory structure:
 * ```
 * server/mcp/custom/
 * ├── my-local-server/      # Local embedded server
 * │   ├── package.json
 * │   └── build/index.js    # Exports createMcpHandler
 * └── remote-servers.yaml   # Remote server configurations
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { McpServerRegistry } from '@/server/mcp/registry';
import {
  type ILocalMcpServer,
  type IMcpLoaderOptions,
  type IMcpServerModule,
  type IRemoteMcpConfig,
  type IRemoteMcpServer,
  McpServerTypeEnum
} from '@/server/mcp/types';
import { ZERO } from '@/constants/process.constants';

/**
 * Default options for the MCP loader.
 */
const DEFAULT_OPTIONS: Partial<IMcpLoaderOptions> = {
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
export class CustomMcpLoader {
  private readonly options: IMcpLoaderOptions;

  /**
   * Creates a new CustomMCPLoader instance.
   * @param registry - The MCP server registry to register servers with.
   * @param options - Loader options.
   */
  constructor(
    private readonly registry: McpServerRegistry,
    options?: Partial<IMcpLoaderOptions>
  ) {
    this.options = {
      customDir: options?.customDir ?? './server/mcp/custom',
      ...DEFAULT_OPTIONS,
      ...options
    };
  }

  /**
   * Load all custom MCP servers from the custom directory.
   * @param customDir - Optional override for the custom directory path.
   * @returns Promise that resolves when all servers are loaded.
   */
  async loadAllServers(customDir?: string): Promise<void> {
    const dir = customDir ?? this.options.customDir;

    try {
      const localServers = this.discoverLocalServers(dir);
      await this.loadLocalServersSequentially(localServers, dir);

      if (this.options.loadRemoteConfigs === true) {
        await this.loadRemoteConfigs(dir);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load local servers sequentially to avoid race conditions.
   * Sequential execution is required to prevent database conflicts during registration.
   * @param localServers - Array of server directory names.
   * @param dir - Custom directory path.
   * @returns Promise that resolves when all servers are loaded.
   */
  private async loadLocalServersSequentially(localServers: string[], dir: string): Promise<void> {
    for (const serverDir of localServers) {
      await this.loadLocalServer(serverDir, dir);
    }
  }

  /**
   * Discover local MCP server directories.
   * @param customDir - Directory to search for servers.
   * @returns Array of directory names containing potential MCP servers.
   */
  private discoverLocalServers(customDir: string): string[] {
    if (!fs.existsSync(customDir)) {
      return [];
    }

    const entries: string[] = fs.readdirSync(customDir);
    const servers: string[] = [];

    for (const entry of entries) {
      if (this.isValidServerDirectory(customDir, entry)) {
        servers.push(entry);
      }
    }

    return servers;
  }

  /**
   * Check if directory is a valid MCP server directory.
   * @param customDir - Parent directory path.
   * @param entry - Directory entry name.
   * @returns True if directory contains MCP server files.
   */
  private isValidServerDirectory(customDir: string, entry: string): boolean {
    const fullPath = path.join(customDir, entry);
    const stat = fs.statSync(fullPath);

    if (!stat.isDirectory() || entry.startsWith('.')) {
      return false;
    }

    const packageJsonPath = path.join(fullPath, 'package.json');
    const indexPath = path.join(fullPath, 'index.js');
    const buildIndexPath = path.join(fullPath, 'build', 'index.js');

    return fs.existsSync(packageJsonPath) || fs.existsSync(indexPath) || fs.existsSync(buildIndexPath);
  }

  /**
   * Load a single local MCP server.
   * @param serverDir - Directory name of the server.
   * @param customDir - Parent custom directory.
   * @returns Promise that resolves when the server is loaded.
   */
  private async loadLocalServer(serverDir: string, customDir: string): Promise<void> {
    const serverPath = path.join(customDir, serverDir);
    const serverModule = await this.loadServerModule(serverPath, serverDir);
    const serverConfig = this.extractServerConfig(serverModule, serverDir);
    const localServer = this.createLocalServerInstance(serverDir, serverConfig, serverModule);
    await this.registry.registerServer(localServer);
  }

  /**
   * Load and validate server module using dynamic import for runtime loading.
   * @param serverPath - Path to server directory.
   * @param serverDir - Server directory name.
   * @returns Promise resolving to server module.
   */
  // Dynamic import needed for loading MCP server modules at runtime

  private async loadServerModule(serverPath: string, serverDir: string): Promise<IMcpServerModule> {
    const entryPoint = this.findEntryPoint(serverPath);
    if (entryPoint === null) {
      throw new Error(`No entry point found for server: ${serverDir}`);
    }

    const moduleUrl = pathToFileURL(entryPoint).href;
    const loadedModule = (await import(moduleUrl)) as IMcpServerModule;

    if (loadedModule.createMcpHandler === null || typeof loadedModule.createMcpHandler !== 'function') {
      throw new Error(`Invalid MCP server module: ${serverDir} - missing createMcpHandler export`);
    }

    return loadedModule;
  }

  /**
   * Extract server configuration from module.
   * @param module - Server module.
   * @param serverModule
   * @param serverDir - Server directory name.
   * @returns Server configuration object.
   */
  private extractServerConfig(
    serverModule: IMcpServerModule,
    serverDir: string
  ): { name: string; version: string; description: string } {
    return {
      name: serverModule.config?.serverName ?? serverDir,
      version: serverModule.config?.serverVersion ?? '0.0.0',
      description: serverModule.config?.serverDescription ?? `Custom MCP server: ${serverDir}`
    };
  }

  /**
   * Create local server instance.
   * @param serverDir - Server directory name.
   * @param config - Server configuration.
   * @param config.name - Server name.
   * @param config.version - Server version.
   * @param config.description - Server description.
   * @param serverModule - Server module.
   * @returns Local server instance.
   */
  private createLocalServerInstance(
    serverDir: string,
    config: { name: string; version: string; description: string },
    serverModule: IMcpServerModule
  ): ILocalMcpServer {
    return {
      id: serverDir,
      name: config.name,
      version: config.version,
      type: McpServerTypeEnum.LOCAL,
      description: config.description,
      createHandler: serverModule.createMcpHandler,
      getActiveSessionCount: (): number => { return ZERO },
      shutdown: async (): Promise<void> => {
      }
    };
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
        if (packageJson.main !== null && packageJson.main !== undefined) {
          const mainPath = path.join(serverPath, packageJson.main);
          if (fs.existsSync(mainPath)) {
            return mainPath;
          }
        }
      } catch (error) {
      }
    }

    const commonEntryPoints = [
      'src/index.ts',
      'index.ts',
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
    const configPath = path.join(customDir, this.options.remoteConfigFile ?? 'remote-servers.yaml');

    if (!fs.existsSync(configPath)) {
      return;
    }

    const configContent = fs.readFileSync(configPath.replace('.yaml', '.json'), 'utf8');
    const configs: IRemoteMcpConfig[] = JSON.parse(configContent) as IRemoteMcpConfig[];

    for (const config of configs) {
      const remoteServer: IRemoteMcpServer = {
        id: config.name.toLowerCase().replace(/\s+/gu, '-'),
        name: config.name,
        version: '1.0.0',
        type: McpServerTypeEnum.REMOTE,
        description: `Remote MCP server: ${config.name}`,
        config
      };

      await this.registry.registerServer(remoteServer);
    }
  }
}
