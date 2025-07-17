/**
 * Module loader for initializing system modules
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Module } from '../../interfaces/module.js';
import { ModuleRegistry } from '../../../modules/registry.js';
import { logger } from '../../utils/logger.js';
import { CONFIG } from '../../server/config.js';
import type { Logger } from '../../../modules/core/logger/index.js';

export interface ModuleConfig {
  enabled: boolean;
  autoStart?: boolean;
  config?: Record<string, any>;
}

export interface ModulesConfig {
  modules: Record<string, ModuleConfig>;
}

export class ModuleLoader {
  private registry: ModuleRegistry;
  private configPath: string;
  
  constructor(configPath?: string) {
    this.registry = new ModuleRegistry();
    this.configPath = configPath || join(CONFIG.CONFIG_PATH, 'modules.json');
  }
  
  /**
   * Load module configuration
   */
  private loadConfig(): ModulesConfig {
    if (!existsSync(this.configPath)) {
      logger.warn(`Module config not found at ${this.configPath}, using defaults`);
      return { modules: {} };
    }
    
    try {
      const content = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to load module config:', error);
      return { modules: {} };
    }
  }
  
  /**
   * Load and initialize all enabled modules
   */
  async loadModules(): Promise<void> {
    const config = this.loadConfig();
    
    // Load core modules
    await this.loadCoreModules(config);
    
    // Initialize all loaded modules
    await this.registry.initializeAll();
    
    logger.info(`Loaded ${this.registry.getAll().length} modules`);
  }
  
  /**
   * Load core system modules
   */
  private async loadCoreModules(config: ModulesConfig): Promise<void> {
    // Load logger module if enabled
    if (config.modules.logger?.enabled !== false) {
      try {
        const { LoggerModule } = await import('../../../modules/core/logger/index.js');
        const loggerConfig = {
          stateDir: CONFIG.STATE_DIR,
          logLevel: 'info' as const,
          maxSize: '10m',
          maxFiles: 7,
          outputs: ['console', 'file'] as ('console' | 'file')[],
          files: {
            system: 'system.log',
            error: 'error.log',
            access: 'access.log'
          },
          ...config.modules.logger?.config
        };
        
        const loggerModule = new LoggerModule(loggerConfig);
        this.registry.register(loggerModule);
      } catch (error) {
        logger.error('Failed to load logger module:', error);
      }
    }
    
    // Load heartbeat module if enabled
    if (config.modules.heartbeat?.enabled !== false) {
      try {
        const { HeartbeatModule } = await import('../../../modules/core/heartbeat/index.js');
        const heartbeatConfig = {
          interval: '30s',
          outputPath: join(CONFIG.STATE_DIR, 'data', 'heartbeat.json'),
          ...config.modules.heartbeat?.config
        };
        
        const heartbeat = new HeartbeatModule(heartbeatConfig);
        this.registry.register(heartbeat);
        
        // Auto-start if configured
        if (config.modules.heartbeat?.config?.autoStart) {
          await heartbeat.start();
        }
      } catch (error) {
        logger.error('Failed to load heartbeat module:', error);
      }
    }
    
    // Add other core modules here as they are developed
  }
  
  /**
   * Get the module registry
   */
  getRegistry(): ModuleRegistry {
    return this.registry;
  }
  
  /**
   * Shutdown all modules
   */
  async shutdown(): Promise<void> {
    await this.registry.shutdownAll();
  }
}

// Global instance with environment tracking
let moduleLoader: ModuleLoader | null = null;
let lastConfigPath: string | undefined;
let lastStateDir: string | undefined;

/**
 * Get or create the module loader instance
 * Creates a new instance if environment has changed
 */
export function getModuleLoader(): ModuleLoader {
  const currentConfigPath = CONFIG.CONFIG_PATH;
  const currentStateDir = CONFIG.STATE_DIR;
  
  // If environment changed, reset the loader
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
 * Reset the module loader (for testing)
 */
export function resetModuleLoader(): void {
  if (moduleLoader) {
    moduleLoader.shutdown().catch(() => {});
    moduleLoader = null;
    lastConfigPath = undefined;
    lastStateDir = undefined;
  }
}