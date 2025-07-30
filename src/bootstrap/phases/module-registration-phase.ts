/**
 * Module registration phase for bootstrap process.
 * Handles registration of modules in database and CLI commands.
 * @module bootstrap/phases/module-registration
 */

import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { CoreModuleType, ModuleRegistrationPhaseContext } from '@/types/bootstrap';
import type { IModulesModuleExports } from "@/modules/core/modules/types/modules-exports.types";
import type { ICLIModuleExports } from '@/modules/core/cli/index';

/**
 * Type guard to check if exports has registerCoreModule method.
 * @param moduleExports - Module exports to check.
 * @returns True if exports has registerCoreModule method.
 */
const hasRegisterCoreModule = (
  moduleExports: unknown
): moduleExports is IModulesModuleExports => {
  return (
    typeof moduleExports === 'object'
    && moduleExports !== null
    && 'registerCoreModule' in moduleExports
  );
};

/**
 * Type guard to check if exports has CLI command methods.
 * @param moduleExports - Module exports to check.
 * @returns True if exports has CLI command methods.
 */
const hasCLICommands = (
  moduleExports: unknown
): moduleExports is ICLIModuleExports => {
  return (
    typeof moduleExports === 'object'
    && moduleExports !== null
    && 'scanAndRegisterModuleCommands' in moduleExports
  );
};

/**
 * Register all core modules in the database.
 * @param context - The module registration phase context.
 */
export const registerCoreModulesInDatabase = async (
  context: ModuleRegistrationPhaseContext
): Promise<void> => {
  const {
    modules
  } = context;
  const logger = LoggerService.getInstance();

  logger.debug(LogSource.BOOTSTRAP, 'Registering core modules in database', {
    category: 'database',
    persistToDb: false
  });

  const modulesModule = modules.get('modules');
  if (modulesModule?.exports === undefined) {
    logger.warn(
      LogSource.BOOTSTRAP,
      'Modules module not loaded, skipping core module registration',
      { category: 'database' }
    );
    return;
  }

  if (!hasRegisterCoreModule(modulesModule.exports)) {
    logger.warn(
      LogSource.BOOTSTRAP,
      'registerCoreModule not available, skipping core module registration',
      { category: 'database' }
    );
    return;
  }

  try {
    logger.debug(LogSource.BOOTSTRAP, 'Skipping core module registration to prevent circular imports', {
      category: 'database',
      persistToDb: false
    });
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, 'Failed to register core modules', {
      category: 'database',
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
};

/**
 * Build module map for CLI command registration.
 * @param modules - Module map.
 * @param coreModules - Core module definitions.
 * @returns Module map for CLI.
 */
const buildModuleMapForCli = (
  modules: Map<string, CoreModuleType>,
  coreModules: Array<{ name: string; path: string }>
): Map<string, { path: string }> => {
  const moduleMap = new Map<string, { path: string }>();

  for (const coreModule of coreModules) {
    if (modules.has(coreModule.name)) {
      const dirPath = coreModule.path.replace(/\/index\.(?:ts|js)$/u, '');
      moduleMap.set(coreModule.name, { path: dirPath });
    }
  }

  return moduleMap;
};

/**
 * Register CLI commands from all loaded modules.
 * @param context - The module registration phase context.
 */
export const registerCliCommands = async (
  context: ModuleRegistrationPhaseContext
): Promise<void> => {
  const { modules } = context;
  const logger = LoggerService.getInstance();

  logger.debug(LogSource.BOOTSTRAP, 'Registering CLI commands', {
    category: 'cli',
    persistToDb: false
  });

  const cliModule = modules.get('cli');
  if (cliModule?.exports === undefined) {
    logger.warn(
      LogSource.BOOTSTRAP,
      'CLI module not loaded, skipping command registration',
      { category: 'cli' }
    );
    return;
  }

  if (!hasCLICommands(cliModule.exports)) {
    logger.warn(
      LogSource.BOOTSTRAP,
      'scanAndRegisterModuleCommands not available',
      { category: 'cli' }
    );
    return;
  }

  try {
    const moduleMap = buildModuleMapForCli(modules, context.coreModules);
    await cliModule.exports.scanAndRegisterModuleCommands(moduleMap);

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
};
