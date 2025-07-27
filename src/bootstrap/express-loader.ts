/**
 * Express module loader with proper typing.
 * @file Express module loader with proper typing.
 * @module bootstrap/express-loader
 */

import express, { type Express } from 'express';

/**
 * Loads the Express application.
 * This function creates and returns a new Express application instance.
 * @returns {Express} Express application instance.
 * @throws {Error} If Express module cannot be loaded.
 */
export const loadExpressApp = (): Express => {
  try {
    const app = express();
    return app;
  } catch (error) {
    throw new Error(
      `Failed to load Express module: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
