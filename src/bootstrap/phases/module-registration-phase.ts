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
import { getModuleRegistry } from '@/modules/core/modules/index';
import { ModulesStatus, ModulesType } from "@/modules/core/modules/types/database.generated";

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

/**
 * Default health check function.
 * @returns Promise resolving to healthy status.
 */
const defaultHealthCheck = async (): Promise<{ healthy: boolean }> => {
  return await Promise.resolve({ healthy: true });
};

/**
 * Get module property value with fallback for string properties.
 * @param moduleItem - Core module type.
 * @param prop - Property name.
 * @param fallback - Fallback value.
 * @returns Property value or fallback.
 */
const getStringModuleValue = (
  moduleItem: CoreModuleType,
  prop: keyof CoreModuleType,
  fallback: string
): string => {
  const { [prop]: value } = moduleItem;
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return fallback;
};

/**
 * Get module type value with fallback.
 * @param moduleItem - Core module type.
 * @returns Module type.
 */
const getModuleTypeValue = (
  moduleItem: CoreModuleType
): ModulesType => {
  const { type } = moduleItem;
  if (type === 'service') {
    return ModulesType.SERVICE;
  }
  if (type === 'daemon') {
    return ModulesType.DAEMON;
  }
  if (type === 'plugin') {
    return ModulesType.PLUGIN;
  }
  return ModulesType.SERVICE;
};

/**
 * Create module interface for registration.
 * @param moduleItem - Core module type.
 * @param name - Module name.
 * @returns Module interface object.
 */
const createModuleInterface = (
  moduleItem: CoreModuleType,
  name: string
): {
  name: string;
  version: string;
  type: ModulesType;
  status: ModulesStatus;
  exports: unknown;
  initialize: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  healthCheck: () => Promise<{ healthy: boolean }>;
} => {
  return {
    name: getStringModuleValue(moduleItem, 'name', name),
    version: getStringModuleValue(moduleItem, 'version', '1.0.0'),
    type: getModuleTypeValue(moduleItem),
    status: moduleItem.status || ModulesStatus.PENDING,
    exports: moduleItem.exports,
    initialize: moduleItem.initialize.bind(moduleItem),
    start: moduleItem.start.bind(moduleItem),
    stop: moduleItem.stop.bind(moduleItem),
    healthCheck: typeof moduleItem.healthCheck === 'function'
      ? moduleItem.healthCheck.bind(moduleItem)
      : defaultHealthCheck
  };
};

/**
 * Register modules with the global ModuleLoader for server access.
 * @param context - The module registration phase context.
 * @throws {Error} If module registration fails.
 */
export const registerModulesWithLoader = (
  context: ModuleRegistrationPhaseContext
): void => {
  const { modules } = context;
  const logger = LoggerService.getInstance();

  logger.debug(LogSource.BOOTSTRAP, 'Registering modules with loader', {
    category: 'bootstrap',
    modules: modules.size
  });

  try {
    const registry = getModuleRegistry();

    for (const [name, moduleItem] of modules) {
      const moduleInterface = createModuleInterface(moduleItem, name);

      registry.register(moduleInterface);

      logger.debug(LogSource.BOOTSTRAP, `Registered module ${name} with loader`, {
        category: 'bootstrap',
        moduleType: moduleInterface.type
      });
    }

    logger.info(LogSource.BOOTSTRAP, 'All modules registered with loader', {
      category: 'bootstrap',
      count: modules.size
    });
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, 'Failed to register modules with loader:', {
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
};
