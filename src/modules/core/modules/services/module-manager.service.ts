/**
 * @file Module manager service for managing injectable modules.
 * @module modules/core/modules/services/module-manager.service
 */

import {
 existsSync, readFileSync, readdirSync
} from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { DatabaseService } from '@/modules/core/database/index.js';
import type {
 ModuleHealthStatus, ModuleInfo, ModuleStatus, ScannedModule
} from '@/modules/core/modules/types/index.js';
import { ModuleType } from '@/modules/core/modules/types/index.js';

interface ModuleManagerConfig {
  modulesPath: string;
  injectablePath: string;
  extensionsPath: string;
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
    // Don't create the table here - let the database module's schema discovery handle it
    this.logger.info('Module manager service initialized');
  }

  /**
   * Scan for injectable modules.
   */
  async scanForModules(): Promise<ScannedModule[]> {
    const modules: ScannedModule[] = [];
    const injectablePath = resolve(process.cwd(), this.config.injectablePath);

    if (!existsSync(injectablePath)) {
      this.logger.warn(`Injectable modules path does not exist: ${injectablePath}`);
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
              const manifest = parse(content);

              if (manifest && manifest.name) {
                const scannedModule: ScannedModule = {
                  name: manifest.name,
                  version: manifest.version || '1.0.0',
                  type: manifest.type || 'service',
                  path: modulePath,
                  dependencies: manifest.dependencies,
                  config: manifest.config,
                  metadata: manifest.metadata
                };

                modules.push(scannedModule);

                // Upsert module into database
                await this.upsertModule(scannedModule);
              }
            } catch (error) {
              this.logger.error(`Failed to parse module.yaml in ${modulePath}:`, error);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to scan for modules:', error);
    }

    this.logger.info(`Discovered ${modules.length} injectable modules`);
    return modules;
  }

  /**
   * Register a core module in the database.
   * @param name
   * @param path
   * @param dependencies
   */
  async registerCoreModule(name: string, path: string, dependencies: string[] = []): Promise<void> {
    const module: ScannedModule = {
      name,
      version: '1.0.0',
      type: ModuleType.SERVICE, // Use SERVICE enum for core modules
      path,
      dependencies,
      config: {},
      metadata: { core: true }
    };

    await this.upsertModule(module);
    this.logger.info(`Registered core module '${name}' in database`);
  }

  /**
   * Upsert a module into the database.
   * @param module
   */
  private async upsertModule(module: ScannedModule): Promise<void> {
    const existingModule = await this.database.query<any>(
      'SELECT id FROM modules WHERE name = ?',
      [module.name]
    );

    if (existingModule.length > 0) {
      // Update existing module
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
      // Insert new module
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
    const rows = await this.database.query<any>(
      'SELECT * FROM modules WHERE enabled = 1 ORDER BY name'
    );

    return rows.map(this.rowToModuleInfo);
  }

  /**
   * Get a specific module by name.
   * @param name
   */
  async getModule(name: string): Promise<ModuleInfo | undefined> {
    const rows = await this.database.query<any>(
      'SELECT * FROM modules WHERE name = ?',
      [name]
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.rowToModuleInfo(rows[0]);
  }

  /**
   * Enable a module.
   * @param name
   */
  async enableModule(name: string): Promise<void> {
    await this.database.execute(
      'UPDATE modules SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
      [name]
    );
    this.logger.info(`Module '${name}' enabled`);
  }

  /**
   * Disable a module.
   * @param name
   */
  async disableModule(name: string): Promise<void> {
    await this.database.execute(
      'UPDATE modules SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
      [name]
    );
    this.logger.info(`Module '${name}' disabled`);
  }

  /**
   * Convert database row to ModuleInfo.
   * @param row
   */
  private rowToModuleInfo(row: any): ModuleInfo {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      type: row.type,
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
