/**
 * @file Type definitions for the module loader system.
 * @module modules/types/loader
 */

import type { IModuleConfig as ICoreModuleConfig, IModuleScannerService as ICoreModuleScannerService } from '@/modules/core/modules/types/index';

/**
 * Configuration for an individual module from config file.
 * @interface IModuleConfig
 */
export interface IModuleConfig extends ICoreModuleConfig {
    enabled: boolean;
    autoStart?: boolean;
    config?: Record<string, unknown>;
}

/**
 * Root configuration structure for all modules.
 * @interface IModulesConfig
 */
export interface IModulesConfig {
    modules: Record<string, IModuleConfig>;
}

/**
 * Scanner service interface from modules module.
 * @interface IModuleScannerService
 */
export interface IModuleScannerService extends ICoreModuleScannerService {}

/**
 * Module service interface that provides scanner access.
 * @interface IModuleService
 */
export interface IModuleService {
    getScannerService(): IModuleScannerService;
}

/**
 * Module instance with service property.
 * @interface IModuleWithService
 */
export interface IModuleWithService {
    name: string;
    service: IModuleService;
    [key: string]: unknown;
}

/**
 * Module instance interface.
 * @interface IModuleInstance
 */
export interface IModuleInstance {
    name: string;
    version?: string;
    type?: 'service' | 'daemon' | 'plugin';
    initialize(context: IModuleContext): Promise<void>;
    start?(): Promise<void>;
    stop?(): Promise<void>;
    healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
    [key: string]: unknown;
}

/**
 * Module initialization context.
 * @interface IModuleContext
 */
export interface IModuleContext {
    config: Record<string, unknown>;
    logger: unknown;
}

/**
 * Module class constructor interface.
 * @interface IModuleConstructor
 */
export interface IModuleConstructor {
  /**
   * Create new module instance.
   */
  new (): IModuleInstance;
}

/**
 * Module exports interface.
 * @interface IModuleExports
 */
export interface IModuleExports {
    [key: string]: IModuleConstructor;
}
