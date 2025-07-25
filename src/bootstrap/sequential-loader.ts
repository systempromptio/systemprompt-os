/**
 * Sequential loader utility for bootstrap process.
 * Core modules must be loaded sequentially to respect dependency order.
 * @file Sequential loader utility for bootstrap process.
 * @module bootstrap/sequential-loader
 */

import type { ICoreModuleDefinition } from '@/types/bootstrap';
import type { IModule, ModuleInfo } from '@/modules/core/modules/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Sequentially processes an array of items using a reducer pattern.
 * This ensures each operation completes before the next begins.
 * @param {T[]} items - Array of items to process.
 * @param {Function} processor - Async function to process each item.
 * @returns {Promise<void>} Promise that resolves when all items are processed.
 * @template T
 */
export const processSequentially = async <T>(
  items: T[],
  processor: (item: T) => Promise<void>,
): Promise<void> => {
  await items.reduce(async (previousPromise, item) => {
    await previousPromise;
    await processor(item);
  }, Promise.resolve());
};

/**
 * Process core module definitions sequentially.
 * @param {ICoreModuleDefinition[]} definitions - Core module definitions.
 * @param {Function} loader - Function to load each module.
 * @returns {Promise<void>} Promise that resolves when all modules are loaded.
 */
export const loadCoreModulesInOrder = async (
  definitions: ICoreModuleDefinition[],
  loader: (definition: ICoreModuleDefinition) => Promise<void>,
): Promise<void> => {
  await processSequentially(definitions, loader);
};

/**
 * Initialize modules sequentially by processing module entries.
 * @param {Array<[string, IModule]>} moduleEntries - Module entries to initialize.
 * @param {Function} initializer - Function to initialize each module.
 * @returns {Promise<void>} Promise that resolves when all modules are initialized.
 */
export const initializeModulesInOrder = async (
  moduleEntries: Array<[string, IModule]>,
  initializer: (name: string, module: IModule) => Promise<void>,
): Promise<void> => {
  await processSequentially(
    moduleEntries,
    async ([name, module]) => { await initializer(name, module); },
  );
};

/**
 * Start critical modules sequentially.
 * @param {string[]} moduleNames - Names of modules to start.
 * @param {Function} starter - Function to start each module.
 * @returns {Promise<void>} Promise that resolves when all modules are started.
 */
export const startModulesInOrder = async (
  moduleNames: string[],
  starter: (name: string) => Promise<void>,
): Promise<void> => {
  await processSequentially(moduleNames, starter);
};

/**
 * Load extension modules conditionally and sequentially.
 * @param {ModuleInfo[]} modules - Module information array.
 * @param {Set<string>} enabledNames - Set of enabled module names.
 * @param {Function} loader - Function to load each module.
 * @param {ILogger} logger - Logger instance for debug messages.
 * @returns {Promise<void>} Promise that resolves when all enabled modules are loaded.
 */
export const loadEnabledExtensionModules = async (
  modules: ModuleInfo[],
  enabledNames: Set<string>,
  loader: (moduleInfo: ModuleInfo) => Promise<void>,
  logger: ILogger,
): Promise<void> => {
  await processSequentially(modules, async (moduleInfo) => {
    if (enabledNames.has(moduleInfo.name)) {
      await loader(moduleInfo);
    } else {
      logger.debug(LogSource.BOOTSTRAP, `Skipping disabled module: ${moduleInfo.name}`);
    }
  });
};
