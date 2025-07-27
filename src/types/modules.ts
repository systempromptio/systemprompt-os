/**
 * Module context interface for initialization.
 */
export interface IModuleContext {
  config?: IModuleConfig;
  [key: string]: unknown;
}

/**
 * Module configuration interface.
 */
export interface IModuleConfig {
  enabled?: boolean;
  options?: Record<string, unknown>;
}

/**
 * Module interface for core modules.
 */
export interface IModuleInterface {
  name: string;
  version: string;
  type: 'service' | 'daemon' | 'plugin';
  initialize(context: IModuleContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Service module type.
 */
export type ServiceModule = IModuleInterface & {
  type: 'service';
};

/**
 * Daemon module type.
 */
export type DaemonModule = IModuleInterface & {
  type: 'daemon';
};

/**
 * Plugin module type.
 */
export type PluginModule = IModuleInterface & {
  type: 'plugin';
};

/**
 * Extended module type for loader.
 */
export type ExtendedModule = IModuleInterface & {
  config?: IModuleConfig;
  exports?: unknown;
};

/**
 * Internal module with configuration.
 */
export interface IModuleWithConfig extends IModuleInterface {
  _config?: IModuleConfig;
}
