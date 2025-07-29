/**
 * Module manager repository for database operations.
 * @file Module manager repository.
 * @module modules/core/modules/repositories/module-manager.repository
 */

import type { DatabaseService } from '@/modules/core/database/index';
import type { IScannedModule } from "@/modules/core/modules/types/scanner.types";
import type { IModulesRow } from '@/modules/core/modules/types/database.generated';

/**
 * Repository for module manager database operations.
 */
export class ModuleManagerRepository {
  private static instance: ModuleManagerRepository | undefined;

  /**
   * Private constructor for singleton pattern.
   * @param database - Database service instance.
   */
  private constructor(
    private readonly database: DatabaseService
  ) {}

  /**
   * Get singleton instance.
   * @param database - Database service instance.
   * @returns ModuleManagerRepository instance.
   */
  static getInstance(database: DatabaseService): ModuleManagerRepository {
    ModuleManagerRepository.instance ??= new ModuleManagerRepository(database);
    return ModuleManagerRepository.instance;
  }

  /**
   * Upsert a module into the database.
   * @param moduleInfo - Module data to upsert.
   * @returns Promise that resolves when upsert is complete.
   */
  async upsertModule(moduleInfo: IScannedModule): Promise<void> {
    const existingModule = await this.database.query<{ id: number }>(
      'SELECT id FROM modules WHERE name = ?',
      [moduleInfo.name]
    );

    if (existingModule.length > 0) {
      await this.database.execute(
        `UPDATE modules SET 
         version = ?, type = ?, path = ?, 
         dependencies = ?, config = ?, metadata = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE name = ?`,
        [
          moduleInfo.version,
          moduleInfo.type,
          moduleInfo.path,
          JSON.stringify(moduleInfo.dependencies ?? []),
          JSON.stringify(moduleInfo.config ?? {}),
          JSON.stringify(moduleInfo.metadata ?? {}),
          moduleInfo.name
        ]
      );
    } else {
      await this.database.execute(
        `INSERT INTO modules 
         (name, version, type, path, enabled, dependencies, config, metadata)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        [
          moduleInfo.name,
          moduleInfo.version,
          moduleInfo.type,
          moduleInfo.path,
          JSON.stringify(moduleInfo.dependencies ?? []),
          JSON.stringify(moduleInfo.config ?? {}),
          JSON.stringify(moduleInfo.metadata ?? {})
        ]
      );
    }
  }

  /**
   * Get all modules.
   * @returns Promise that resolves to array of all modules.
   */
  async getAllModules(): Promise<IModulesRow[]> {
    return await this.database.query<IModulesRow>(
      'SELECT * FROM modules ORDER BY name'
    );
  }

  /**
   * Get all enabled modules.
   * @returns Promise that resolves to array of enabled modules.
   */
  async getEnabledModules(): Promise<IModulesRow[]> {
    return await this.database.query<IModulesRow>(
      'SELECT * FROM modules WHERE enabled = 1 ORDER BY name'
    );
  }

  /**
   * Get a specific module by name.
   * @param name - Module name.
   * @returns Promise that resolves to module info or undefined.
   */
  async getModule(name: string): Promise<IModulesRow | undefined> {
    const rows = await this.database.query<IModulesRow>(
      'SELECT * FROM modules WHERE name = ?',
      [name]
    );

    return rows[0];
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
}
