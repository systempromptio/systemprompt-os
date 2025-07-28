/**
 * Eslint-disable systemprompt-os/no-restricted-syntax-typescript-with-help
 * eslint-disable systemprompt-os/no-await-in-loop-with-help.
 * @file Dynamic imports and await in loops required for bootstrap module loading.
 */

import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { pathToFileURL } from 'url';
import type {
  CoreModuleType,
  CoreModulesPhaseContext,
  ICoreModuleDefinition,
  IModuleExports,
  IModuleImportResult
} from '@/types/bootstrap';
import type { IModule } from '@/modules/core/modules/types/index';

/**
 * Create a module instance from the loaded exports.
 * @param moduleExports - The module exports.
 * @param name - The module name.
 * @returns The module instance.
 * @throws Error when module doesn't export required functions.
 */
const createModuleInstance = (moduleExports: IModuleImportResult, name: string): IModule => {
  if (typeof moduleExports.createModule === 'function') {
    return moduleExports.createModule();
  }

  if (typeof moduleExports.default === 'function') {
    const { default: ModuleConstructor } = moduleExports;
    return new ModuleConstructor();
  }

  throw new Error(`Module ${name} must export createModule function or default constructor`);
};

/**
 * Load a module directly from its path.
 * Dynamic import is used for loading modules from file paths during bootstrap.
 * This is only used during bootstrap before the modules service is available.
 * @param definition - The core module definition containing name and path.
 * @returns The loaded module instance.
 * @throws Error when module loading fails.
 */
const loadModuleDirectly = async (definition: ICoreModuleDefinition): Promise<IModule> => {
  const { name, path } = definition;
  const logger = LoggerService.getInstance();

  try {
    const { href: resolvedPath } = new URL(path, pathToFileURL(`${process.cwd()}/`));
    const moduleImports: IModuleImportResult = await import(resolvedPath);

    const moduleInstance = createModuleInstance(moduleImports, name);

    logger.debug(LogSource.BOOTSTRAP, `Loaded module: ${name}`, {
      category: 'modules',
      persistToDb: false
    });

    return moduleInstance;
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, `Failed to load module ${name}`, {
      category: 'error',
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
};

/**
 * Verify module dependencies are loaded.
 * @param definition - The module definition.
 * @param modules - The modules map.
 * @param moduleName - The module name.
 * @throws Error when dependencies are not loaded.
 */
const verifyDependencies = (
  definition: ICoreModuleDefinition,
  modules: Map<string, CoreModuleType>,
  moduleName: string
): void => {
  for (const dep of definition.dependencies) {
    if (!modules.has(dep)) {
      throw new Error(`Dependency '${dep}' not loaded for module '${moduleName}'`);
    }
  }
};

/**
 * Initialize a module if it has an initialize method.
 * @param moduleInstance - The module instance.
 * @param moduleName - The module name.
 */
const initializeModule = async (moduleInstance: IModule, moduleName: string): Promise<void> => {
  if (typeof moduleInstance.initialize === 'function') {
    await moduleInstance.initialize();
    const logger = LoggerService.getInstance();
    logger.debug(LogSource.BOOTSTRAP, `Initialized module: ${moduleName}`, {
      category: 'modules',
      persistToDb: false
    });
  }
};

/**
 * Start a critical module if it has a start method.
 * @param moduleInstance - The module instance.
 * @param definition - The module definition.
 * @param moduleName - The module name.
 */
const startCriticalModule = async (
  moduleInstance: IModule,
  definition: ICoreModuleDefinition,
  moduleName: string
): Promise<void> => {
  if (definition.critical && typeof moduleInstance.start === 'function') {
    await moduleInstance.start();
    const logger = LoggerService.getInstance();
    logger.debug(LogSource.BOOTSTRAP, `Started critical module: ${moduleName}`, {
      category: 'modules',
      persistToDb: false
    });
  }
};

/**
 * Process a single essential module.
 * Sequential loading is required because modules depend on each other.
 * @param moduleName - The module name.
 * @param coreModules - Array of core module definitions.
 * @param modules - The modules map.
 */
const processEssentialModule = async (
  moduleName: string,
  coreModules: ICoreModuleDefinition[],
  modules: Map<string, CoreModuleType>
): Promise<void> => {
  const definition = coreModules.find((moduleDefinition): boolean => {
    return moduleDefinition.name === moduleName;
  });

  if (definition === undefined) {
    throw new Error(`Essential module ${moduleName} not found in core modules`);
  }

  verifyDependencies(definition, modules, moduleName);

  const moduleInstance = await loadModuleDirectly(definition);
  const coreModuleType = moduleInstance as CoreModuleType;
  modules.set(moduleName, coreModuleType);

  await initializeModule(moduleInstance, moduleName);

  await startCriticalModule(moduleInstance, definition, moduleName);
};

/**
 * Load and initialize essential modules (database and modules).
 * These are loaded directly before the modules service is available.
 * @param modules - The modules map to populate.
 * @param coreModules - Array of core module definitions.
 * @param essentialModules - Names of essential modules to load.
 */
const loadEssentialModules = async (
  modules: Map<string, CoreModuleType>,
  coreModules: ICoreModuleDefinition[],
  essentialModules: string[]
): Promise<void> => {
  const logger = LoggerService.getInstance();

  logger.debug(LogSource.BOOTSTRAP, 'Processing essential modules', {
    category: 'modules',
    persistToDb: false
  });

  for (const moduleName of essentialModules) {
    await processEssentialModule(moduleName, coreModules, modules);
  }
};

/**
 * Register pre-loaded modules with the modules service.
 * @param moduleExports - The modules service exports.
 * @param modules - The modules map containing pre-loaded modules.
 */
const registerPreLoadedModules = (
  moduleExports: IModuleExports,
  modules: Map<string, CoreModuleType>
): void => {
  const loggerModule = modules.get('logger');
  if (loggerModule !== undefined) {
    moduleExports.registerPreLoadedModule('logger', loggerModule);
  }

  const databaseModule = modules.get('database');
  if (databaseModule !== undefined) {
    moduleExports.registerPreLoadedModule('database', databaseModule);
  }
};

/**
 * Filter remaining modules that need to be loaded.
 * @param coreModules - Array of core module definitions.
 * @param essentialModules - Names of already loaded essential modules.
 * @returns Filtered array of remaining modules.
 */
const filterRemainingModules = (
  coreModules: ICoreModuleDefinition[],
  essentialModules: string[]
): ICoreModuleDefinition[] => {
  return coreModules.filter((definition): boolean => {
    return definition.name !== 'logger' && !essentialModules.includes(definition.name);
  });
};

/**
 * Check if all dependencies are loaded for a module.
 * @param definition - The module definition.
 * @param modules - The modules map.
 * @returns True if all dependencies are loaded.
 */
const areDependenciesLoaded = (
  definition: ICoreModuleDefinition,
  modules: Map<string, CoreModuleType>
): boolean => {
  return definition.dependencies.every((dep): boolean => {
    return modules.has(dep);
  });
};

/**
 * Process a single remaining module.
 * Sequential loading is required to maintain dependency order.
 * @param definition - The module definition.
 * @param modules - The modules map.
 * @param moduleExports - The modules service exports.
 */
const processRemainingModule = async (
  definition: ICoreModuleDefinition,
  modules: Map<string, CoreModuleType>,
  moduleExports: IModuleExports
): Promise<void> => {
  const logger = LoggerService.getInstance();

  if (!areDependenciesLoaded(definition, modules)) {
    logger.warn(
      LogSource.BOOTSTRAP,
      `Skipping module ${definition.name} - dependencies not met`,
      { category: 'modules' }
    );
    return;
  }

  try {
    const loadedModule = await moduleExports.loadCoreModule(definition);
    modules.set(definition.name, loadedModule);

    await moduleExports.initializeCoreModule(definition.name);

    if (definition.critical) {
      await moduleExports.startCoreModule(definition.name);
    }
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, `Failed to load module ${definition.name}`, {
      category: 'modules',
      error: error instanceof Error ? error : new Error(String(error))
    });
    if (definition.critical) {
      throw error;
    }
  }
};

/**
 * Load remaining core modules through the modules service.
 * @param modules - The modules map to populate.
 * @param coreModules - Array of core module definitions.
 * @param moduleExports - The modules service exports.
 */
const loadRemainingCoreModules = async (
  modules: Map<string, CoreModuleType>,
  coreModules: ICoreModuleDefinition[],
  moduleExports: IModuleExports
): Promise<void> => {
  const essentialModules = ['database', 'modules'];
  const remainingModules = filterRemainingModules(coreModules, essentialModules);

  for (const definition of remainingModules) {
    await processRemainingModule(definition, modules, moduleExports);
  }
};

/**
 * Filter non-critical modules that are loaded.
 * @param coreModules - Array of core module definitions.
 * @param modules - The modules map.
 * @returns Filtered array of non-critical modules.
 */
const filterNonCriticalModules = (
  coreModules: ICoreModuleDefinition[],
  modules: Map<string, CoreModuleType>
): ICoreModuleDefinition[] => {
  return coreModules.filter((definition): boolean => {
    return (
      definition.name !== 'logger'
      && !definition.critical
      && modules.has(definition.name)
    );
  });
};

/**
 * Start a single non-critical module.
 * Sequential starting maintains proper initialization order.
 * @param definition - The module definition.
 * @param moduleExports - The modules service exports.
 */
const startNonCriticalModule = async (
  definition: ICoreModuleDefinition,
  moduleExports: IModuleExports
): Promise<void> => {
  const logger = LoggerService.getInstance();

  try {
    await moduleExports.startCoreModule(definition.name);
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, `Failed to start module ${definition.name}`, {
      category: 'modules',
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
};

/**
 * Start non-critical modules.
 * @param coreModules - Array of core module definitions.
 * @param modules - The modules map.
 * @param moduleExports - The modules service exports.
 */
const startNonCriticalModules = async (
  coreModules: ICoreModuleDefinition[],
  modules: Map<string, CoreModuleType>,
  moduleExports: IModuleExports
): Promise<void> => {
  const nonCriticalModules = filterNonCriticalModules(coreModules, modules);

  for (const definition of nonCriticalModules) {
    await startNonCriticalModule(definition, moduleExports);
  }
};

/**
 * Get the modules service exports.
 * @param modules - The modules map.
 * @returns The modules service exports.
 * @throws Error when modules module is not properly loaded.
 */
const getModulesServiceExports = (modules: Map<string, CoreModuleType>): IModuleExports => {
  const modulesModule = modules.get('modules');
  if (modulesModule === undefined || !('exports' in modulesModule)) {
    throw new Error('Modules module not properly loaded');
  }

  const { exports: moduleExports } = modulesModule;
  return moduleExports as IModuleExports;
};

/**
 * Execute the core modules phase of bootstrap.
 * Loads only essential modules (logger, database, modules) directly.
 * Other modules will be loaded through the modules service.
 * @param context - The core modules phase context containing modules map and configuration.
 */
export const executeCoreModulesPhase = async (
  context: CoreModulesPhaseContext
): Promise<void> => {
  const { modules, coreModules } = context;
  const logger = LoggerService.getInstance();

  logger.debug(LogSource.BOOTSTRAP, 'Loading essential core modules', {
    category: 'modules',
    persistToDb: false
  });

  const essentialModules = ['database', 'modules'];

  await loadEssentialModules(modules, coreModules, essentialModules);

  const moduleExports = getModulesServiceExports(modules);

  registerPreLoadedModules(moduleExports, modules);

  await loadRemainingCoreModules(modules, coreModules, moduleExports);

  await startNonCriticalModules(coreModules, modules, moduleExports);

  logger.debug(LogSource.BOOTSTRAP, 'Core modules phase completed', {
    category: 'modules',
    persistToDb: false
  });
};
