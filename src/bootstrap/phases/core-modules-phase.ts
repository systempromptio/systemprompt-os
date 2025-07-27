/**
 * Core modules phase for bootstrap process.
 * Handles loading and initialization of core system modules.
 * @module bootstrap/phases/core-modules
 */

import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { CoreModuleType, ICoreModuleDefinition } from '@/types/bootstrap';
import {
  initializeModulesInOrder,
  loadCoreModulesInOrder,
  startModulesInOrder
} from '@/bootstrap/sequential-loader';
import { loadCoreModule } from '@/bootstrap/module-loader';
import { checkLoggerUpgrade } from '@/bootstrap/module-init-helper';

export interface CoreModulesPhaseContext {
  modules: Map<string, CoreModuleType>;
  coreModules: ICoreModuleDefinition[];
  logger: ILogger;
  isCliMode: boolean;
}

/**
 * Execute the core modules phase of bootstrap.
 * Loads, initializes, and starts critical core modules.
 * @param context
 */
export async function executeCoreModulesPhase(context: CoreModulesPhaseContext): Promise<void> {
  const {
 modules, coreModules, logger, isCliMode
} = context;

  logger.debug(LogSource.BOOTSTRAP, 'Loading core modules', {
    category: 'modules',
    persistToDb: false
  });

  await loadCoreModulesInOrder(
    coreModules,
    async (definition: ICoreModuleDefinition) => {
      await loadCoreModuleWithLogging(definition.name, definition, modules, logger);
    }
  );

  const moduleEntries: Array<[string, CoreModuleType]> = [];
  for (const def of coreModules) {
    const module = modules.get(def.name);
    if (module) {
      moduleEntries.push([def.name, module]);
    }
  }

  await initializeModulesInOrder(
    moduleEntries,
    async (name: string, _module: CoreModuleType) => {
      await initializeCoreModule(name, modules, logger, isCliMode);
    }
  );

  const criticalModuleNames = coreModules
    .filter(mod => { return mod.critical })
    .map(mod => { return mod.name });

  await startModulesInOrder(
    criticalModuleNames,
    async (name: string) => {
      await startCoreModule(name, modules, logger);
    }
  );

  logger.debug(LogSource.BOOTSTRAP, 'Core modules phase completed', {
    category: 'modules',
    persistToDb: false
  });
}

/**
 * Load a single core module with error handling and logging.
 * @param name
 * @param definition
 * @param modules
 * @param logger
 */
async function loadCoreModuleWithLogging(
  name: string,
  definition: ICoreModuleDefinition,
  modules: Map<string, CoreModuleType>,
  logger: ILogger
): Promise<void> {
  const type = definition.critical ? 'critical' : 'core';
  logger.debug(LogSource.BOOTSTRAP, `Loading ${type} module: ${name}`, {
    category: 'modules',
    persistToDb: false
  });

  try {
    const moduleInstance = await loadCoreModule(definition, modules);
    modules.set(name, moduleInstance);
    logger.debug(LogSource.BOOTSTRAP, `Loaded ${type} module: ${name}`, {
      category: 'modules',
      persistToDb: false
    });
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, `Failed to load module ${name}`, {
      category: 'error',
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
}

/**
 * Initialize a core module with special handling for logger and CLI mode.
 * @param name
 * @param modules
 * @param logger
 * @param isCliMode
 */
async function initializeCoreModule(
  name: string,
  modules: Map<string, CoreModuleType>,
  logger: ILogger,
  isCliMode: boolean
): Promise<void> {
  const moduleInstance = modules.get(name);
  if (!moduleInstance) { return; }
  try {
    if (moduleInstance.initialize) {
      await moduleInstance.initialize();
    }
    if (name === 'logger') {
      checkLoggerUpgrade(name, moduleInstance);
      if (isCliMode) {
        logger.debug(LogSource.BOOTSTRAP, 'Logger configured for CLI mode', {
          category: 'logger',
          persistToDb: false
        });
      }
    }
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, `Failed to initialize module ${name}`, {
      category: 'modules',
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
}

/**
 * Start a core module.
 * @param name
 * @param modules
 * @param logger
 */
async function startCoreModule(
  name: string,
  modules: Map<string, CoreModuleType>,
  logger: ILogger
): Promise<void> {
  const moduleInstance = modules.get(name);
  if (!moduleInstance) { return; }

  try {
    if (moduleInstance.start) {
      await moduleInstance.start();
      logger.debug(LogSource.BOOTSTRAP, `Started module: ${name}`, {
        category: 'modules',
        persistToDb: false
      });
    }
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, `Failed to start module ${name}`, {
      category: 'modules',
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
}
