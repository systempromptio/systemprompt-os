/**
 * @fileoverview Server configuration management for environment variables and settings.
 * Provides centralized configuration for server ports and security keys.
 * @module server/config
 *
 * @remarks
 * This module manages server configuration including environment variables
 * and basic server settings.
 *
 * Optional environment variables:
 * - PORT: Server port (default: 3000)
 * - JWT_SECRET: Secret key for any future auth needs
 */

import dotenv from "dotenv";
dotenv.config();

/**
 * Server configuration interface
 */
export interface ServerConfig {
  /** Server port number */
  PORT: string;
  /** Secret key for future use */
  JWT_SECRET: string;
}

/**
 * Server configuration object
 * @example
 * ```typescript
 * import { CONFIG } from './server/config.js';
 * const port = parseInt(CONFIG.PORT, 10);
 * ```
 */
export const CONFIG: ServerConfig = {
  PORT: process.env.PORT || "3000",
  JWT_SECRET: process.env.JWT_SECRET || "default-secret-change-in-production",
} as const;