/**
 * Module manager repository for database operations.
 * @file Module manager repository.
 * @module modules/core/modules/repositories/module-manager.repository
 */

import type { DatabaseService } from '@/modules/core/database/index';
import type {
  IModuleInfo,
  IScannedModule,
  ModuleHealthStatusEnum,
  ModuleStatusEnum,
  ModuleTypeEnum
} from '@/modules/core/modules/types/index';
import type { IDatabaseModuleRow } from '@/modules/core/modules/types/module-manager.types';

/**
 * Repository for module manager database operations.
 */
export class ModuleManagerRepository {
  private static instance: ModuleManagerRepository;

  private constructor(
    private readonly database: DatabaseService
  ) {}

  /**
   * Get singleton instance.
   * @param database - Database service instance.
   * @returns ModuleManagerRepository instance.
   */
  static getInstance(database: DatabaseService): ModuleManagerRepository {
    ModuleManagerRepository.instance ||= new ModuleManagerRepository(database);
    return ModuleManagerRepository.instance;
  }

  /**
   * Upsert a module into the database.
   * @param module - Module data to upsert.
   * @returns Promise that resolves when upsert is complete.
   */
  async upsertModule(module: IScannedModule): Promise<void> {
    const existingModule = await this.database.query<{ id: number }>(
      'SELECT id FROM modules WHERE name = ?',
      [module.name]
    );

    if (existingModule.length > 0) {
      await this.database.execute(
        `UPDATE modules SET 
         version = ?, type = ?, path = ?, 
         dependencies = ?, config = ?, metadata = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE name = ?`,
        [
          module.version,
          module.type,
          module.path,
          JSON.stringify(module.dependencies ?? []),
          JSON.stringify(module.config ?? {}),
          JSON.stringify(module.metadata ?? {}),
          module.name
        ]
      );
    } else {
      await this.database.execute(
        `INSERT INTO modules 
         (name, version, type, path, enabled, dependencies, config, metadata)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        [
          module.name,
          module.version,
          module.type,
          module.path,
          JSON.stringify(module.dependencies ?? []),
          JSON.stringify(module.config ?? {}),
          JSON.stringify(module.metadata ?? {})
        ]
      );
    }
  }

  /**
   * Get all modules.
   * @returns Promise that resolves to array of all modules.
   */
  async getAllModules(): Promise<IModuleInfo[]> {
    const rows = await this.database.query<IDatabaseModuleRow>(
      'SELECT * FROM modules ORDER BY name'
    );

    return rows.map((row): IModuleInfo => { return this.rowToModuleInfo(row) });
  }

  /**
   * Get all enabled modules.
   * @returns Promise that resolves to array of enabled modules.
   */
  async getEnabledModules(): Promise<IModuleInfo[]> {
    const rows = await this.database.query<IDatabaseModuleRow>(
      'SELECT * FROM modules WHERE enabled = 1 ORDER BY name'
    );

    return rows.map((row): IModuleInfo => { return this.rowToModuleInfo(row) });
  }

  /**
   * Get a specific module by name.
   * @param name - Module name.
   * @returns Promise that resolves to module info or undefined.
   */
  async getModule(name: string): Promise<IModuleInfo | undefined> {
    const rows = await this.database.query<IDatabaseModuleRow>(
      'SELECT * FROM modules WHERE name = ?',
      [name]
    );

    if (rows.length === 0) {
      return undefined;
    }

    const firstRow = rows[0];
    if (!firstRow) {
      return undefined;
    }

    return this.rowToModuleInfo(firstRow);
  }

  /**
   * Enable a module.
   * @param name - Module name to enable.
   * @returns Promise that resolves when module is enabled.
   */
  async enableModule(name: string): Promise<void> {
    await this.database.execute(
      'UPDATE modules SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
      [name]
    );
  }

  /**
   * Disable a module.
   * @param name - Module name to disable.
   * @returns Promise that resolves when module is disabled.
   */
  async disableModule(name: string): Promise<void> {
    await this.database.execute(
      'UPDATE modules SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
      [name]
    );
  }

  /**
   * Convert database row to ModuleInfo.
   * @param row - Database row data.
   * @returns ModuleInfo object.
   */
  private rowToModuleInfo(row: IDatabaseModuleRow): IModuleInfo {
    const isEnabled = row.enabled !== 0;
    const moduleDeps = row.dependencies !== '' ? JSON.parse(row.dependencies) as string[] : [];
    const moduleConfig = row.config !== '' ? JSON.parse(row.config) as Record<string, unknown> : {};
    const moduleMetadata = row.metadata !== '' ? JSON.parse(row.metadata) as Record<string, unknown> : {};

    return {
      id: row.id,
      name: row.name,
      version: row.version,
      type: row.type as ModuleTypeEnum,
      path: row.path,
      enabled: isEnabled,
      autoStart: true,
      status: 'installed' as ModuleStatusEnum,
      healthStatus: 'unknown' as ModuleHealthStatusEnum,
      dependencies: moduleDeps,
      config: moduleConfig,
      metadata: moduleMetadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
