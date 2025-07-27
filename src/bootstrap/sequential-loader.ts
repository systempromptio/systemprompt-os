/**
 * Sequential loader utility for bootstrap process.
 * Core modules must be loaded sequentially to respect dependency order.
 * @file Sequential loader utility for bootstrap process.
 * @module bootstrap/sequential-loader
 */

import type { ICoreModuleDefinition } from '@/types/bootstrap';
import type { IModule, IModuleInfo } from '@/modules/core/modules/types/index';

/**
 * Sequentially processes an array of items using a simple for-loop.
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
  for (const item of items) {
    await processor(item);
  }
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
 * Load extension modules sequentially.
 * @param {IModuleInfo[]} modules - Module information array (already filtered for enabled).
 * @param {Function} loader - Function to load each module.
 * @returns {Promise<void>} Promise that resolves when all modules are loaded.
 */
export const loadEnabledExtensionModules = async (
  modules: IModuleInfo[],
  loader: (moduleInfo: IModuleInfo) => Promise<void>,
): Promise<void> => {
  await processSequentially(modules, loader);
};
