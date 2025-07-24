/**
 * Express module dynamic loader with proper typing.
 * Dynamic import is required for lazy loading MCP servers.
 * @file Express module dynamic loader with proper typing.
 * @module bootstrap/express-loader
 */

import type { Express } from 'express';

/**
 * Type definition for the Express module import.
 */
interface ExpressModule {
  default: () => Express;
  [key: string]: unknown;
}

/**
 * Dynamically loads the Express module.
 * This is required for lazy loading MCP servers when they are enabled.
 * @returns {Promise<Express>} Express application instance.
 * @throws {Error} If Express module cannot be loaded.
 */
export const loadExpressApp = async (): Promise<Express> => {
  try {
    const expressModule = await import('express') as ExpressModule;

    if (typeof expressModule.default !== 'function') {
      throw new Error('Express module does not export a default function');
    }

    const app = expressModule.default();
    return app;
  } catch (error) {
    throw new Error(
      `Failed to load Express module: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
