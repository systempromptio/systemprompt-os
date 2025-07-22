/**
 * Common types for modules
 */

export interface ModuleInterface {
  name: string;
  version: string;
  type: 'service' | 'daemon' | 'plugin' | 'core' | 'extension';
  
  // Lifecycle methods
  initialize(context: ModuleContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
  
  // Optional exports
  exports?: any;
}

export interface ModuleContext {
  config?: any;
  logger?: Logger;
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// Re-export CLI types
export type { CLIContext } from '../cli/src/types.js';