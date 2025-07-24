/**
 * Static bootstrap for bundled builds
 *
 * Uses static imports instead of dynamic imports for proper bundling
 */

import 'reflect-metadata';
import { Container } from 'typedi';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import { TYPES } from '@/modules/core/types.js';

// Static imports of core modules
import { LoggerModule } from '@/modules/core/logger/index.js';
import { DatabaseModule } from '@/modules/core/database/index.js';
import { ConfigModule } from '@/modules/core/config/index.js';
import { PermissionsModule } from '@/modules/core/permissions/index.js';
import { AuthModule } from '@/modules/core/auth/index.js';
import { ModulesModule } from '@/modules/core/modules/index.js';

import type { IModule } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { GlobalConfiguration } from '@/modules/core/config/types/index.js';

export interface BootstrapConfig {
  logger?: ILogger;
  configPath?: string;
  statePath?: string;
  environment?: string;
}

/**
 * Bootstrap core modules with static imports
 */
export async function runBootstrap(config: BootstrapConfig = {}): Promise<Map<string, IModule>> {
  const logger = config.logger || LoggerService.getInstance();
  const modules = new Map<string, IModule>();

  // Build global configuration
  const globalConfig: GlobalConfiguration = {
    configPath: config.configPath || process.env['CONFIG_PATH'] || './config',
    statePath: config.statePath || process.env['STATE_PATH'] || './state',
    environment: config.environment || process.env['NODE_ENV'] || 'development',
    modules: {},
  };

  // Setup initial container bindings
  Container.set(TYPES.Logger, logger);
  Container.set(TYPES.Config, globalConfig);

  logger.info('Starting static bootstrap process...');

  try {
    // Get module instances in dependency order
    const loggerModule = Container.get(LoggerModule);
    const databaseModule = Container.get(DatabaseModule);
    const configModule = Container.get(ConfigModule);
    const permissionsModule = Container.get(PermissionsModule);
    const authModule = Container.get(AuthModule);
    const modulesModule = Container.get(ModulesModule);

    // Store modules
    modules.set('logger', loggerModule);
    modules.set('database', databaseModule);
    modules.set('config', configModule);
    modules.set('permissions', permissionsModule);
    modules.set('auth', authModule);
    modules.set('modules', modulesModule);

    // Initialize all modules
    logger.info('Initializing core modules...');
    for (const [name, module] of modules) {
      logger.debug(`Initializing module: ${name}`);
      if (module.initialize) {
        await module.initialize();
      }
      logger.debug(`Initialized module: ${name}`);
    }

    // Start critical modules
    logger.info('Starting critical modules...');
    const criticalModules = ['logger', 'database', 'config', 'permissions', 'auth', 'modules'];

    for (const name of criticalModules) {
      const module = modules.get(name);
      if (!module) {continue;}

      logger.debug(`Starting module: ${name}`);
      if (module.start) {
        await module.start();
      }
      logger.debug(`Started module: ${name}`);
    }

    logger.info('Static bootstrap process completed successfully');
    return modules;
  } catch (error) {
    logger.error('Bootstrap failed:', error);
    throw error;
  }
}

/**
 * For compatibility with existing shutdown code
 */
export class Bootstrap {
  async shutdown() {
    const logger = Container.get<ILogger>(TYPES.Logger);
    logger.info('Shutting down modules...');
    // Modules will be shut down by the module loader
    logger.info('All modules shut down');
  }
}
