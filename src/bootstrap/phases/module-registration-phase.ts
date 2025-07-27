/**
 * Module registration phase for bootstrap process.
 * Handles registration of modules in database and CLI commands.
 * @module bootstrap/phases/module-registration
 */

import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { CoreModuleType, ICoreModuleDefinition } from '@/types/bootstrap';
import type { IModulesModuleExports } from '@/modules/core/modules/index';
import type { ICLIModuleExports } from '@/modules/core/cli/index';

export interface ModuleRegistrationPhaseContext {
  modules: Map<string, CoreModuleType>;
  coreModules: ICoreModuleDefinition[];
  logger: ILogger;
}

/**
 * Register all core modules in the database.
 * @param context
 */
export async function registerCoreModulesInDatabase(context: ModuleRegistrationPhaseContext): Promise<void> {
  const {
 modules, coreModules, logger
} = context;

  logger.debug(LogSource.BOOTSTRAP, 'Registering core modules in database', {
    category: 'database',
    persistToDb: false
  });

  const modulesModule = modules.get('modules');
  if (!modulesModule?.exports) {
    logger.warn(
      LogSource.BOOTSTRAP,
      'Modules module not loaded, skipping core module registration',
      { category: 'database' }
    );
    return;
  }

  const moduleExports = modulesModule.exports as IModulesModuleExports;
  if (!moduleExports.registerCoreModule) {
    logger.warn(
      LogSource.BOOTSTRAP,
      'registerCoreModule not available, skipping core module registration',
      { category: 'database' }
    );
    return;
  }

  try {
    for (const definition of coreModules) {
      await moduleExports.registerCoreModule(
        definition.name,
        definition.path,
        definition.dependencies
      );
    }

    logger.debug(LogSource.BOOTSTRAP, 'Core modules registered in database', {
      category: 'database',
      persistToDb: false
    });
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, 'Failed to register core modules', {
      category: 'database',
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
}

/**
 * Register CLI commands from all loaded modules.
 * @param context
 */
export async function registerCliCommands(context: ModuleRegistrationPhaseContext): Promise<void> {
  const { modules, logger } = context;

  logger.debug(LogSource.BOOTSTRAP, 'Registering CLI commands', {
    category: 'cli',
    persistToDb: false
  });

  const cliModule = modules.get('cli');
  if (!cliModule?.exports) {
    logger.warn(
      LogSource.BOOTSTRAP,
      'CLI module not loaded, skipping command registration',
      { category: 'cli' }
    );
    return;
  }

  const cliExports = cliModule.exports as ICLIModuleExports;
  if (!cliExports.scanAndRegisterModuleCommands) {
    logger.warn(
      LogSource.BOOTSTRAP,
      'scanAndRegisterModuleCommands not available',
      { category: 'cli' }
    );
    return;
  }

  try {
    const moduleMap = new Map<string, { path: string }>();
    
    // Use coreModules from context which have the path property
    for (const coreModule of context.coreModules) {
      if (modules.has(coreModule.name)) {
        // Convert file path to directory path by removing /index.ts
        const dirPath = coreModule.path.replace(/\/index\.(ts|js)$/, '');
        moduleMap.set(coreModule.name, { path: dirPath });
      }
    }

    await cliExports.scanAndRegisterModuleCommands(moduleMap);

    logger.debug(LogSource.BOOTSTRAP, 'CLI commands registered', {
      category: 'cli',
      persistToDb: false
    });
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, 'Failed to register CLI commands', {
      category: 'cli',
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
}

/**
 * Register modules with the global ModuleLoader for server access.
 * @param context
 */
export async function registerModulesWithLoader(context: ModuleRegistrationPhaseContext): Promise<void> {
  const { modules, logger } = context;

  try {
    const { getModuleLoader } = await import('@/modules/loader');
    const moduleLoader = getModuleLoader();
    const registry = moduleLoader.getRegistry();

    modules.forEach((module, name) => {
      const moduleInterface = {
        name,
        version: '1.0.0',
        type: 'service' as const,
        exports: module.exports,
        initialize: async () => {},
        start: module.start ? module.start.bind(module) : async () => {},
        stop: module.stop ? module.stop.bind(module) : async () => {},
        healthCheck: async () => { return { healthy: true }; }
      };
      registry.register(moduleInterface);
    });

    logger.debug(LogSource.BOOTSTRAP, 'Registered bootstrap modules with ModuleLoader');
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, 'Failed to register modules with loader:', {
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
}
