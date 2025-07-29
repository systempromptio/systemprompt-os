/**
 * Module scanner service types.
 */

import type { IModulesRow } from '@/modules/core/modules/types/database.generated';

/**
 * Scanned module interface - pre-database module representation.
 * Uses partial database row to avoid duplication.
 */
export type IScannedModule = Pick<IModulesRow, 'name' | 'version' | 'type' | 'path'> & {
  dependencies?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/**
 * Module scan options.
 */
export interface IModuleScanOptions {
  paths?: string[];
  includeDisabled?: boolean;
  deep?: boolean;
}

/**
 * Module scanner service interface.
 */
export interface IModuleScannerService {
  scan(options: IModuleScanOptions): Promise<IScannedModule[]>;
  getEnabledModules(): Promise<IModulesRow[]>;
  updateModuleStatus(name: string, status: string, error?: string): Promise<void>;
  setModuleEnabled(name: string, enabled: boolean): Promise<void>;
  updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void>;
  getModule(name: string): Promise<IModulesRow | undefined>;
  getRegisteredModules(): Promise<IModulesRow[]>;
}
