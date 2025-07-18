/**
 * @fileoverview Logger utility that provides access to the system logger module
 * This is a wrapper that provides a consistent interface to the logger module
 * @module utils/logger
 */

import type { Logger } from '../modules/core/logger/index.js';
import type { ModuleRegistry } from '../modules/registry.js';

// Temporary console-based logger for bootstrapping
const bootstrapLogger: Logger = {
  debug: (message: string, ...args: any[]) => console.debug(`[BOOTSTRAP] [DEBUG] ${message}`, ...args),
  info: (message: string, ...args: any[]) => console.log(`[BOOTSTRAP] [INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[BOOTSTRAP] [WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[BOOTSTRAP] [ERROR] ${message}`, ...args),
  addLog: (level: string, message: string, ...args: any[]) => {
    const method = level.toLowerCase() as keyof Console;
    if (console[method] && typeof console[method] === 'function') {
      (console[method] as any)(`[BOOTSTRAP] [${level.toUpperCase()}] ${message}`, ...args);
    }
  },
  clearLogs: async () => { /* no-op for bootstrap logger */ },
  getLogs: async () => []
};

let cachedLogger: Logger | null = null;
let moduleRegistry: ModuleRegistry | null = null;

/**
 * Sets the module registry for the logger to use
 * This must be called after the module loader is initialized
 */
export function setModuleRegistry(registry: ModuleRegistry): void {
  moduleRegistry = registry;
  // Force refresh of cached logger
  cachedLogger = null;
}

/**
 * Gets the system logger instance
 * Returns a bootstrap logger during system initialization,
 * then switches to the actual logger module once available
 */
export function getLogger(): Logger {
  // If no registry set or no cached logger, try to get from registry
  if (!cachedLogger && moduleRegistry) {
    try {
      const loggerModule = moduleRegistry.get('logger');
      
      if (loggerModule && 'getService' in loggerModule) {
        const service = (loggerModule as any).getService();
        if (service) {
          cachedLogger = service;
          return service;
        }
      }
    } catch (error) {
      // Fall through to bootstrap logger
    }
  }
  
  // Return cached logger if available, otherwise bootstrap
  return cachedLogger || bootstrapLogger;
}

/**
 * Main logger instance
 * Uses bootstrap logger until the logger module is loaded
 */
export const logger = new Proxy({} as Logger, {
  get: (_, prop: string) => {
    const currentLogger = getLogger();
    return (currentLogger as any)[prop];
  }
});

/**
 * Export the module registry type for use in other modules
 */
export type { ModuleRegistry };