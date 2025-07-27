/**
 * Module discovery phase for bootstrap process.
 * Handles discovery and loading of extension modules.
 * @module bootstrap/phases/module-discovery
 */

import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { CoreModuleType, GlobalConfiguration } from '@/types/bootstrap';
import type { IModuleInfo } from '@/modules/core/modules/types/index';
import type { IModulesModuleExports } from '@/modules/core/modules/index';
import { loadExtensionModule } from '@/bootstrap/module-loader';
import { loadEnabledExtensionModules } from '@/bootstrap/sequential-loader';

export interface ModuleDiscoveryPhaseContext {
  modules: Map<string, CoreModuleType>;
  config: GlobalConfiguration;
  logger: ILogger;
}

/**
 * Execute the module discovery phase of bootstrap.
 * Discovers and loads extension modules based on configuration.
 * @param context
 */
export async function executeModuleDiscoveryPhase(context: ModuleDiscoveryPhaseContext): Promise<void> {
  const {
 modules, config, logger
} = context;

  logger.debug(LogSource.BOOTSTRAP, 'Starting module autodiscovery', {
    category: 'discovery',
    persistToDb: false
  });

  try {
    const modulesModule = modules.get('modules');
    if (!modulesModule?.exports) {
      logger.warn(
        LogSource.BOOTSTRAP,
        'Modules module not found or has no exports',
        { category: 'discovery' }
      );
      return;
    }

    const { exports: moduleExports } = modulesModule;

    if (!moduleExports || typeof moduleExports !== 'object') {
      throw new Error('Modules module exports are invalid');
    }

    const modulesExports = moduleExports as any;
    if (
      typeof modulesExports.scanForModules !== 'function'
      || typeof modulesExports.getEnabledModules !== 'function'
      || typeof modulesExports.service !== 'function'
      || typeof modulesExports.getModule !== 'function'
      || typeof modulesExports.enableModule !== 'function'
      || typeof modulesExports.disableModule !== 'function'
      || typeof modulesExports.registerCoreModule !== 'function'
    ) {
      throw new Error(
        'Invalid modules exports: missing required methods for IModulesModuleExports'
      );
    }

    await discoverAndLoadModules(modulesExports as IModulesModuleExports, modules, config, logger);

    logger.debug(LogSource.BOOTSTRAP, 'Module autodiscovery completed', {
      category: 'discovery',
      persistToDb: false
    });
  } catch (error) {
    logger.error(LogSource.BOOTSTRAP, 'Module autodiscovery failed', {
      category: 'discovery',
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
}

/**
 * Discover and load extension modules using the modules service.
 * @param moduleExports
 * @param modules
 * @param config
 * @param logger
 */
async function discoverAndLoadModules(
  moduleExports: IModulesModuleExports,
  modules: Map<string, CoreModuleType>,
  config: GlobalConfiguration,
  logger: ILogger
): Promise<void> {
  await moduleExports.scanForModules();

  const enabledModules = await moduleExports.getEnabledModules();

  if (enabledModules.length === 0) {
    logger.warn(LogSource.BOOTSTRAP, 'No modules discovered', {
      category: 'discovery'
    });
    return;
  }

  logger.info(
    LogSource.BOOTSTRAP,
    `Discovered ${enabledModules.length} modules`,
    { category: 'discovery' }
  );

  await loadEnabledExtensionModules(
    enabledModules,
    async (moduleInfo: IModuleInfo) => {
      await loadExtensionModuleWithLogging(moduleInfo, modules, config, logger);
    }
  );
}

/**
 * Load a single extension module with error handling and logging.
 * @param moduleInfo
 * @param modules
 * @param config
 * @param logger
 */
async function loadExtensionModuleWithLogging(
  moduleInfo: IModuleInfo,
  modules: Map<string, CoreModuleType>,
  config: GlobalConfiguration,
  logger: ILogger
): Promise<void> {
  try {
    const moduleInstance = await loadExtensionModule(moduleInfo, config);
    modules.set(moduleInfo.name, moduleInstance);

    logger.debug(LogSource.BOOTSTRAP, `Loaded extension module: ${moduleInfo.name}`, {
      category: 'modules',
      persistToDb: false
    });
  } catch (error) {
    logger.error(
      LogSource.BOOTSTRAP,
      `Failed to load extension module ${moduleInfo.name}`,
      {
        category: 'modules',
        error: error instanceof Error ? error : new Error(String(error))
      }
    );
  }
}
