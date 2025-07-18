/**
 * @fileoverview Simple module registry for core modules
 * @module modules/registry
 */

import { AuthModule } from './core/auth/index.js';
import { ConfigModule } from './core/config/index.js';
import { CLIModule } from './core/cli/index.js';
import { ExtensionModule } from './core/extension/index.js';

/**
 * Module configuration interface
 */
export interface ModuleConfig {
  enabled?: boolean;
  options?: Record<string, any>;
}

/**
 * Module interface for core modules
 */
export interface ModuleInterface {
  name: string;
  version: string;
  type: 'service' | 'daemon' | 'plugin';
  initialize(context: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Service module type
 */
export type ServiceModule = ModuleInterface & {
  type: 'service';
};

/**
 * Daemon module type
 */
export type DaemonModule = ModuleInterface & {
  type: 'daemon';
};

/**
 * Plugin module type
 */
export type PluginModule = ModuleInterface & {
  type: 'plugin';
};

/**
 * Extended module type for loader
 */
export type ExtendedModule = ModuleInterface & {
  config?: ModuleConfig;
};

/**
 * Registry of core modules
 */
export class ModuleRegistry {
  private modules: Map<string, ModuleInterface> = new Map();
  
  constructor() {
    // Register core modules
    this.registerCoreModules();
  }
  
  private registerCoreModules(): void {
    // Register each core module
    const coreModules = [
      new AuthModule(),
      new ConfigModule(),
      new CLIModule(),
      new ExtensionModule()
    ];
    
    coreModules.forEach(module => {
      this.modules.set(module.name, module);
    });
  }
  
  register(module: ModuleInterface): void {
    this.modules.set(module.name, module);
  }
  
  async initializeAll(context: any): Promise<void> {
    for (const module of this.modules.values()) {
      await module.initialize(context);
    }
  }
  
  async shutdownAll(): Promise<void> {
    for (const module of this.modules.values()) {
      await module.stop();
    }
  }
  
  get(name: string): ModuleInterface | undefined {
    return this.modules.get(name);
  }
  
  getAll(): ModuleInterface[] {
    return Array.from(this.modules.values());
  }
  
  has(name: string): boolean {
    return this.modules.has(name);
  }
}