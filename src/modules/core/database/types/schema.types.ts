/**
 * Module schema definition.
 */
export interface IModuleSchema {
  module: string;
  moduleName?: string;
  schemaPath: string;
  initPath?: string;
  sql: string;
  initSql?: string;
}

/**
 * Installed schema record.
 */
export interface IInstalledSchema {
  moduleName: string;
  version: string;
  installedAt: string;
}
