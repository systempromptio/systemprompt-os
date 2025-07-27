/**
 * Module manager configuration interface.
 */
export interface IModuleManagerConfig {
  modulesPath: string;
  injectablePath: string;
  extensionsPath: string;
}

/**
 * Database row representation for modules table.
 */
export interface IDatabaseModuleRow {
  id: number;
  name: string;
  version: string;
  type: string;
  path: string;
  enabled: number;
  dependencies: string;
  config: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}
