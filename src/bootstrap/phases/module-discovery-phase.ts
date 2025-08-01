/**
 * Module discovery phase for bootstrap process.
 * Handles discovery and loading of extension modules.
 * @module bootstrap/phases/module-discovery
 */

import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type {
  ModuleDiscoveryPhaseContext
} from '@/types/bootstrap';
import type { IModulesModuleExports } from '@/modules/core/modules/types/modules.service.generated';
import type { IModulesRow } from '@/modules/core/modules/types/database.generated';
import { ModuleName } from '@/modules/types/module-names.types';

/**
 * Type guard to check if module has exports property.
 * @param mod - Module to check.
 * @returns True if module has exports property.
 */
const hasExports = (mod: unknown): mod is { exports: IModulesModuleExports } => {
  return (
    mod !== null
    && mod !== undefined
    && typeof mod === 'object'
    && 'exports' in mod
  );
};

/**
 * Log discovered modules to the logger.
 * @param enabledModules - Array of enabled modules.
 * @param logger - Logger service instance.
 */
const logDiscoveredModules = (
  enabledModules: IModulesRow[],
  logger: ReturnType<typeof LoggerService.getInstance>
): void => {
  logger.info(
    LogSource.BOOTSTRAP,
    `Discovered ${String(enabledModules.length)} extension modules`,
    { category: 'discovery' }
  );

  for (const extensionModule of enabledModules) {
    logger.debug(
      LogSource.BOOTSTRAP,
      `Found extension module: ${extensionModule.name}`,
      {
        category: 'discovery',
        persistToDb: false
      }
    );
  }
};

/**
 * Process module discovery.
 * @param moduleExports - The module exports interface.
 * @param logger - Logger instance.
 * @returns Promise that resolves when discovery is complete.
 */
const processModuleDiscovery = async (
  moduleExports: IModulesModuleExports,
  logger: ReturnType<typeof LoggerService.getInstance>
): Promise<void> => {
  await moduleExports.scanForModules();

  const enabledModules = await moduleExports.getEnabledModules();

  if (enabledModules.length === 0) {
    logger.warn(LogSource.BOOTSTRAP, 'No extension modules discovered', {
      category: 'discovery'
    });
    return;
  }

  logDiscoveredModules(enabledModules as IModulesRow[], logger);
};

/**
 * Execute the module discovery phase of bootstrap.
 * Discovers and loads extension modules based on configuration.
 * @param context - Bootstrap context containing modules and config.
 * @returns Promise that resolves when phase is complete.
 */
export const executeModuleDiscoveryPhase = async (
  context: ModuleDiscoveryPhaseContext
): Promise<void> => {
  const { modules } = context;
  const logger = LoggerService.getInstance();

  logger.debug(LogSource.BOOTSTRAP, 'Starting module autodiscovery', {
    category: 'discovery',
    persistToDb: false
  });

  try {
    const modulesModule = modules.get(ModuleName.MODULES);
    if (!hasExports(modulesModule)) {
      logger.warn(
        LogSource.BOOTSTRAP,
        'Modules module not found or has no exports',
        { category: 'discovery' }
      );
      return;
    }

    await processModuleDiscovery(modulesModule.exports, logger);

    logger.debug(LogSource.BOOTSTRAP, 'Module autodiscovery completed', {
      category: 'discovery',
      persistToDb: false
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error(LogSource.BOOTSTRAP, 'Module autodiscovery failed', {
      category: 'discovery',
      error: errorObj
    });
  }
};
