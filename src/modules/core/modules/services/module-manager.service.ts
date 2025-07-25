/**
 * Module manager service for managing injectable modules.
 * Service for managing injectable modules with database persistence.
 * @file Module manager service.
 * @module modules/core/modules/services/module-manager.service
 */

import {
 existsSync, readFileSync, readdirSync
} from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { DatabaseService } from '@/modules/core/database/index';
import type {
 ModuleHealthStatus, ModuleInfo, ModuleStatus, ScannedModule
} from '@/modules/core/modules/types/index';
import { ModuleType } from '@/modules/core/modules/types/index';

interface ModuleManagerConfig {
  modulesPath: string;
  injectablePath: string;
  extensionsPath: string;
}

interface DatabaseModuleRow {
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

/**
 * Service for managing injectable modules with database persistence.
 */
export class ModuleManagerService {
  private static instance: ModuleManagerService;
  private readonly config: ModuleManagerConfig;

  private constructor(
    config: ModuleManagerConfig,
    private readonly logger: ILogger,
    private readonly database: DatabaseService
  ) {
    this.config = config;
  }

  /**
   * Get singleton instance.
   * @param config
   * @param logger
   * @param database
   */
  static getInstance(config: ModuleManagerConfig, logger: ILogger, database: DatabaseService): ModuleManagerService {
    ModuleManagerService.instance ||= new ModuleManagerService(config, logger, database);
    return ModuleManagerService.instance;
  }

  /**
   * Initialize the service and create database tables if needed.
   */
  async initialize(): Promise<void> {
    this.logger.info(LogSource.MODULES, 'Module manager service initialized');
  }

  /**
   * Scan for injectable modules.
   */
  async scanForModules(): Promise<ScannedModule[]> {
    const modules: ScannedModule[] = [];
    const injectablePath = resolve(process.cwd(), this.config.injectablePath);

    if (!existsSync(injectablePath)) {
      this.logger.warn(LogSource.MODULES, `Injectable modules path does not exist: ${injectablePath}`);
      return modules;
    }

    try {
      const entries = readdirSync(injectablePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const modulePath = join(injectablePath, entry.name);
          const moduleYaml = join(modulePath, 'module.yaml');

          if (existsSync(moduleYaml)) {
            try {
              const content = readFileSync(moduleYaml, 'utf-8');
              const manifestData = parse(content);

              if (manifestData && manifestData.name) {
                const scannedModule: ScannedModule = {
                  name: manifestData.name,
                  version: manifestData.version || '1.0.0',
                  type: manifestData.type || 'service',
                  path: modulePath,
                  dependencies: manifestData.dependencies,
                  config: manifestData.config,
                  metadata: manifestData.metadata
                };

                modules.push(scannedModule);

                await this.upsertModule(scannedModule);
              }
            } catch (error) {
              this.logger.error(LogSource.MODULES, `Failed to parse module.yaml in ${modulePath}:`, { error: error instanceof Error ? error : new Error(String(error)) });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to scan for modules:', { error: error instanceof Error ? error : new Error(String(error)) });
    }

    this.logger.info(LogSource.MODULES, `Discovered ${modules.length} injectable modules`);
    return modules;
  }

  /**
   * Register a core module in the database.
   * @param name - Module name.
   * @param path - Module path.
   * @param dependencies - Array of module dependencies.
   * @returns Promise that resolves when registration is complete.
   */
  async registerCoreModule(name: string, path: string, dependencies: string[] = []): Promise<void> {
    const moduleData: ScannedModule = {
      name,
      version: '1.0.0',
      type: ModuleType.SERVICE,
      path,
      dependencies,
      config: {},
      metadata: { core: true }
    };

    await this.upsertModule(moduleData);
    this.logger.info(LogSource.MODULES, `Registered core module '${name}' in database`);
  }

  /**
   * Upsert a module into the database.
   * @param module - Module data to upsert.
   * @returns Promise that resolves when upsert is complete.
   */
  private async upsertModule(module: ScannedModule): Promise<void> {
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
          JSON.stringify(module.dependencies || []),
          JSON.stringify(module.config || {}),
          JSON.stringify(module.metadata || {}),
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
          JSON.stringify(module.dependencies || []),
          JSON.stringify(module.config || {}),
          JSON.stringify(module.metadata || {})
        ]
      );
    }
  }

  /**
   * Get all enabled modules.
   */
  async getEnabledModules(): Promise<ModuleInfo[]> {
    const rows = await this.database.query<DatabaseModuleRow>(
      'SELECT * FROM modules WHERE enabled = 1 ORDER BY name'
    );

    return rows.map(this.rowToModuleInfo);
  }

  /**
   * Get a specific module by name.
   * @param name - Module name.
   * @returns Promise that resolves to module info or undefined.
   */
  async getModule(name: string): Promise<ModuleInfo | undefined> {
    const rows = await this.database.query<DatabaseModuleRow>(
      'SELECT * FROM modules WHERE name = ?',
      [name]
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.rowToModuleInfo(rows[0]!);
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
    this.logger.info(LogSource.MODULES, `Module '${name}' enabled`);
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
    this.logger.info(LogSource.MODULES, `Module '${name}' disabled`);
  }

  /**
   * Convert database row to ModuleInfo.
   * @param row - Database row data.
   * @returns ModuleInfo object.
   */
  private rowToModuleInfo(row: DatabaseModuleRow): ModuleInfo {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      type: row.type as ModuleType,
      path: row.path,
      enabled: Boolean(row.enabled),
      autoStart: true,
      status: 'installed' as ModuleStatus,
      healthStatus: 'unknown' as ModuleHealthStatus,
      dependencies: JSON.parse(row.dependencies || '[]'),
      config: JSON.parse(row.config || '{}'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
