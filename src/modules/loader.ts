/**
 * @fileoverview Module loader for dynamically loading and managing system modules.
 * Provides a centralized system for loading, initializing, and managing the lifecycle
 * of system modules with configuration-based control.
 * @module modules/loader
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ModuleRegistry } from './registry.js';
import { CONFIG } from '../server/config.js';

/**
 * Configuration for an individual module.
 * @interface ModuleConfig
 * @property {boolean} enabled - Whether the module should be loaded
 * @property {boolean} [autoStart] - Whether to automatically start the module after loading
 * @property {Record<string, unknown>} [config] - Module-specific configuration parameters
 */
export interface ModuleConfig {
  enabled: boolean;
  autoStart?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Root configuration structure for all modules.
 * @interface ModulesConfig
 * @property {Record<string, ModuleConfig>} modules - Map of module names to their configurations
 */
export interface ModulesConfig {
  modules: Record<string, ModuleConfig>;
}

/**
 * Core logger module configuration type.
 * @interface LoggerModuleConfig
 * @property {string} stateDir - Directory for storing log files
 * @property {'debug' | 'info' | 'warn' | 'error'} logLevel - Minimum log level to capture
 * @property {string} maxSize - Maximum size of log files before rotation
 * @property {number} maxFiles - Maximum number of rotated log files to keep
 * @property {Array<'console' | 'file'>} outputs - Output destinations for logs
 * @property {Record<string, string>} files - Map of log types to file names
 */
interface LoggerModuleConfig {
  stateDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxSize: string;
  maxFiles: number;
  outputs: Array<'console' | 'file'>;
  files: {
    system: string;
    error: string;
    access: string;
  };
  [key: string]: unknown;
}

/**
 * Core heartbeat module configuration type.
 * @interface HeartbeatModuleConfig
 * @property {string} interval - Interval between heartbeats (e.g., '30s', '1m')
 * @property {string} outputPath - Path to write heartbeat status file
 * @property {boolean} [autoStart] - Whether to start heartbeat monitoring automatically
 */
interface HeartbeatModuleConfig {
  interval: string;
  outputPath: string;
  autoStart?: boolean;
  [key: string]: unknown;
}

/**
 * Manages the lifecycle of system modules including loading, initialization, and shutdown.
 * @class ModuleLoader
 */
export class ModuleLoader {
  private readonly registry: ModuleRegistry;
  private readonly configPath: string;
  
  /**
   * Creates a new ModuleLoader instance.
   * @param {string} [configPath] - Path to the modules configuration file. Defaults to CONFIG.CONFIGPATH/modules.json
   */
  constructor(configPath?: string) {
    this.registry = new ModuleRegistry();
    this.configPath = configPath || join(CONFIG.CONFIGPATH, 'modules.json');
  }
  
  /**
   * Loads module configuration from disk.
   * @private
   * @returns {ModulesConfig} The loaded configuration or an empty configuration if loading fails
   */
  private loadConfig(): ModulesConfig {
    if (!existsSync(this.configPath)) {
      console.warn(`[ModuleLoader] Module config not found at ${this.configPath}, using defaults`);
      return { modules: {} };
    }
    
    try {
      const content = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[ModuleLoader] Failed to load module config:', error);
      return { modules: {} };
    }
  }
  
  /**
   * Loads and initializes all enabled modules according to configuration.
   * @returns {Promise<void>} Resolves when all modules are loaded and initialized
   */
  async loadModules(): Promise<void> {
    const config = this.loadConfig();
    
    await this.loadCoreModules(config);
    await this.registry.initializeAll({});
    
    // Set the module registry in the logger utility after modules are loaded
    const { setModuleRegistry } = await import('../utils/logger.js');
    setModuleRegistry(this.registry);
    
    console.info(`[ModuleLoader] Loaded ${this.registry.getAll().length} modules`);
  }
  
  /**
   * Loads core system modules based on configuration.
   * @private
   * @param {ModulesConfig} config - The modules configuration
   * @returns {Promise<void>} Resolves when all core modules are loaded
   */
  private async loadCoreModules(config: ModulesConfig): Promise<void> {
    if (config.modules.logger?.enabled !== false) {
      await this.loadLoggerModule(config);
    }
    
    if (config.modules.heartbeat?.enabled !== false) {
      await this.loadHeartbeatModule(config);
    }
    
    if (config.modules.auth?.enabled !== false) {
      await this.loadAuthModule();
    }
  }
  
  /**
   * Loads and configures the logger module.
   * @private
   * @param {ModulesConfig} config - The modules configuration
   * @returns {Promise<void>} Resolves when the logger module is loaded
   */
  private async loadLoggerModule(config: ModulesConfig): Promise<void> {
    try {
      const { LoggerModule } = await import('./core/logger/index.js');
      const loggerConfig: LoggerModuleConfig = {
        stateDir: CONFIG.STATEDIR,
        logLevel: 'info',
        maxSize: '10m',
        maxFiles: 7,
        outputs: ['console', 'file'],
        files: {
          system: 'system.log',
          error: 'error.log',
          access: 'access.log'
        },
        ...config.modules.logger?.config
      };
      
      const loggerModule = new LoggerModule(loggerConfig);
      this.registry.register(loggerModule as any);
    } catch (error) {
      console.error('[ModuleLoader] Failed to load logger module:', error);
    }
  }
  
  /**
   * Loads and configures the heartbeat module.
   * @private
   * @param {ModulesConfig} config - The modules configuration
   * @returns {Promise<void>} Resolves when the heartbeat module is loaded
   */
  private async loadHeartbeatModule(config: ModulesConfig): Promise<void> {
    try {
      const { HeartbeatModule } = await import('./core/heartbeat/index.js');
      const heartbeatConfig: HeartbeatModuleConfig = {
        interval: '30s',
        outputPath: join(CONFIG.STATEDIR, 'data', 'heartbeat.json'),
        ...config.modules.heartbeat?.config
      };
      
      const heartbeat = new HeartbeatModule(heartbeatConfig);
      this.registry.register(heartbeat as any);
      
      if (config.modules.heartbeat?.config?.autoStart) {
        await heartbeat.start();
      }
    } catch (error) {
      console.error('[ModuleLoader] Failed to load heartbeat module:', error);
    }
  }
  
  /**
   * Loads and configures the auth module.
   * @private
   * @returns {Promise<void>} Resolves when the auth module is loaded
   */
  private async loadAuthModule(): Promise<void> {
    try {
      const { AuthModule } = await import('./core/auth/index.js');
      const authModule = new AuthModule();
      this.registry.register(authModule as any);
    } catch (error) {
      console.error('[ModuleLoader] Failed to load auth module:', error);
    }
  }
  
  /**
   * Gets the module registry containing all loaded modules.
   * @returns {ModuleRegistry} The module registry instance
   */
  getRegistry(): ModuleRegistry {
    return this.registry;
  }
  
  /**
   * Gets all loaded modules from the registry.
   * @returns {Array<import('./registry.js').ExtendedModule>} Array of loaded modules
   */
  getAllModules(): Array<import('./registry.js').ExtendedModule> {
    return this.registry.getAll();
  }
  
  /**
   * Gets a specific module by name.
   * @param {string} name - Module name
   * @returns {import('./registry.js').ExtendedModule | undefined} Module instance or undefined
   */
  getModule(name: string): import('./registry.js').ExtendedModule | undefined {
    return this.registry.get(name);
  }
  
  /**
   * Gracefully shuts down all loaded modules.
   * @returns {Promise<void>} Resolves when all modules are shut down
   */
  async shutdown(): Promise<void> {
    await this.registry.shutdownAll();
  }
}

let moduleLoader: ModuleLoader | null = null;
let lastConfigPath: string | undefined;
let lastStateDir: string | undefined;

/**
 * Gets or creates the singleton module loader instance.
 * Creates a new instance if the environment configuration has changed.
 * @returns {ModuleLoader} The module loader instance
 */
export function getModuleLoader(): ModuleLoader {
  const currentConfigPath = CONFIG.CONFIGPATH;
  const currentStateDir = CONFIG.STATEDIR;
  
  if (moduleLoader && (lastConfigPath !== currentConfigPath || lastStateDir !== currentStateDir)) {
    moduleLoader.shutdown().catch(() => {});
    moduleLoader = null;
  }
  
  if (!moduleLoader) {
    moduleLoader = new ModuleLoader();
    lastConfigPath = currentConfigPath;
    lastStateDir = currentStateDir;
  }
  return moduleLoader;
}

/**
 * Resets the module loader singleton instance.
 * Primarily used for testing to ensure a clean state between tests.
 * @returns {void}
 */
export function resetModuleLoader(): void {
  if (moduleLoader) {
    moduleLoader.shutdown().catch(() => {});
    moduleLoader = null;
    lastConfigPath = undefined;
    lastStateDir = undefined;
  }
}