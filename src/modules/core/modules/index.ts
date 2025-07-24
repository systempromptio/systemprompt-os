/**
 * @file Modules module - Module lifecycle and registry management.
 * @module modules/core/modules
 * This is a self-contained core module that manages the discovery,
 * registration, and lifecycle of all extension modules.
 */

import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service.js';

/**
 * Self-contained modules module for managing SystemPrompt OS modules.
 */
export class ModulesModule implements IModule {
  name = 'modules';
  version = '1.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;
  dependencies = ['logger', 'database'];
  private service?: ModuleManagerService;
  private logger?: any;
  private database?: any;
  get exports(): Record<string, any> {
    return {
      service: () => { return this.service },
      scanForModules: async () => {
        if (!this.service) {
          throw new Error('Modules service not initialized');
        }
        return await this.service.scanForModules();
      },
      getEnabledModules: async () => {
        if (!this.service) {
          throw new Error('Modules service not initialized');
        }
        return await this.service.getEnabledModules();
      },
      getModule: async (name: string) => {
        if (!this.service) {
          throw new Error('Modules service not initialized');
        }
        return await this.service.getModule(name);
      },
      enableModule: async (name: string) => {
        if (!this.service) {
          throw new Error('Modules service not initialized');
        }
        await this.service.enableModule(name);
      },
      disableModule: async (name: string) => {
        if (!this.service) {
          throw new Error('Modules service not initialized');
        }
        await this.service.disableModule(name);
      },
      registerCoreModule: async (name: string, path: string, dependencies: string[] = []) => {
        if (!this.service) {
          throw new Error('Modules service not initialized');
        }
        await this.service.registerCoreModule(name, path, dependencies);
      },
    };
  }

  /**
   * Initialize the modules module.
   */
  async initialize(): Promise<void> {
    // Get singleton services now that they're initialized
    this.logger = LoggerService.getInstance();
    this.database = DatabaseService.getInstance();

    const config = {
      modulesPath: './build/modules',
      injectablePath: './build/modules/extension', // Scan extension modules
      extensionsPath: './extensions',
    };

    // Initialize module manager service
    this.service = ModuleManagerService.getInstance(config, this.logger, this.database);
    await this.service.initialize();

    this.logger.info('Modules module initialized');

    // Don't scan yet - let bootstrap call scanForModules when ready
  }

  /**
   * Start the modules module.
   */
  async start(): Promise<void> {
    this.status = ModuleStatus.RUNNING;
    this.logger?.info('Modules module started');
  }

  /**
   * Stop the modules module.
   */
  async stop(): Promise<void> {
    this.status = ModuleStatus.STOPPED;
    this.logger?.info('Modules module stopped');
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    const healthy = this.status === ModuleStatus.RUNNING && this.service !== undefined;
    return {
      healthy,
      message: healthy ? 'Modules module is healthy' : 'Modules module is not running'
    };
  }
}

/**
 * Factory function for creating the module.
 */
export function createModule(): ModulesModule {
  return new ModulesModule();
}
