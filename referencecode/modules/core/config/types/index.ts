/**
 * @fileoverview Configuration module type definitions
 * @module modules/core/config/types
 */

/**
 * Module configuration structure
 */
export interface ModuleConfiguration {
  [moduleName: string]: Record<string, unknown>;
}

/**
 * Global configuration structure
 */
export interface GlobalConfiguration {
  modules?: ModuleConfiguration;
  environment?: string;
  debug?: boolean;
  configPath?: string;
  statePath?: string;
}

/**
 * Configuration token for dependency injection
 */
import { Token } from 'typedi';
export const CONFIG_TOKEN = new Token<GlobalConfiguration>('core.config');