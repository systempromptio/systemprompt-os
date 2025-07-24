/**
 * @file Module Scanner Service - Dynamically discovers and registers modules.
 * @module modules/core/modules/services/module-scanner
 */

import {
 existsSync, readFileSync, readdirSync, statSync
} from 'fs';
import {
 dirname, join, resolve
} from 'path';
import { fileURLToPath } from 'url';
import { createModuleAdapter } from '@/modules/core/database/adapters/module-adapter.js';
import type {
  ModuleScannerService as IModuleScannerService,
  ModuleInfo,
  ModuleScanOptions,
  ScannedModule,
} from '@/modules/core/modules/types/index.js';
import {
 ModuleEventType, ModuleHealthStatus, ModuleStatus, ModuleType
} from '@/modules/core/modules/types/index.js';
import { parseModuleManifestSafe } from '@/modules/core/modules/utils/manifest-parser.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';

/**
 * Database row type for modules table.
 */
interface DatabaseModuleRow {
  id: number;
  name: string;
  version: string;
  type: string;
  path: string;
  enabled: number;
  auto_start: number;
  dependencies: string;
  config: string;
  status: string;
  lasterror: string | null;
  discovered_at?: string;
  last_started_at?: string;
  last_stopped_at?: string;
  health_status: string;
  health_message: string | null;
  last_health_check?: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

/**
 * Service for scanning and discovering available modules.
 */
export class ModuleScannerService implements IModuleScannerService {
  private readonly logger: ILogger | undefined;
  private db: Awaited<ReturnType<typeof createModuleAdapter>>;
  private readonly defaultPaths = ['src/modules/core', 'src/modules/custom', 'extensions/modules'];

  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  /**
   * Initialize the scanner service.
   */
  async initialize(): Promise<void> {
    this.db = await createModuleAdapter('modules');
    await this.ensureSchema();
  }

  /**
   * Set the module manager service for validation.
   * @param _service - The module manager service instance.
   */
  setModuleManagerService(_service: unknown): void {
  }

  /**
   * Ensure database schema exists.
   */
  private async ensureSchema(): Promise<void> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaPath = join(__dirname, '../database/schema.sql');
    if (existsSync(schemaPath)) {
      const schema = readFileSync(schemaPath, 'utf-8');
      await this.db.exec(schema);
      this.logger?.debug('Module database schema initialized');
    }

    const migrationsPath = join(__dirname, '../database/migrations');
    if (existsSync(migrationsPath)) {
      const migrations = readdirSync(migrationsPath)
        .filter((f) => f.endsWith('.sql') && !f.includes('rollback'));
      for (const migration of migrations.sort()) {
        const migrationPath = join(migrationsPath, migration);
        const migrationSql = readFileSync(migrationPath, 'utf-8');
        await this.db.exec(migrationSql);
        this.logger?.debug(`Applied migration: ${migration}`);
      }
    }
  }

  /**
   * Scan for available modules.
   * @param options - Options for scanning modules.
   */
  async scan(options: ModuleScanOptions = {}): Promise<ScannedModule[]> {
    const paths = options.paths || this.defaultPaths;
    const modules: ScannedModule[] = [];

    for (const basePath of paths) {
      const absolutePath = resolve(process.cwd(), basePath);
      if (!existsSync(absolutePath)) {
        this.logger?.debug(`Skipping non-existent path: ${absolutePath}`);
        continue;
      }

      const scannedModules = await this.scanDirectory(absolutePath, options);
      modules.push(...scannedModules);
    }

    await this.storeModules(modules);

    return modules;
  }

  /**
   * Scan a directory for modules.
   * @param dirPath - The directory path to scan.
   * @param options - Options for scanning modules.
   */
  private async scanDirectory(
    dirPath: string,
    options: ModuleScanOptions,
  ): Promise<ScannedModule[]> {
    const modules: ScannedModule[] = [];

    try {
      const entries = readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stat = statSync(fullPath);

        if (!stat.isDirectory()) {
          continue;
        }

        const moduleYamlPath = join(fullPath, 'module.yaml');
        if (existsSync(moduleYamlPath)) {
          const module = await this.loadModuleInfo(fullPath);
          if (module) {
            modules.push(module);
            this.logger?.debug(`Discovered module: ${module.name} at ${fullPath}`);
          }
        } else if (options.deep) {
          const subModules = await this.scanDirectory(fullPath, options);
          modules.push(...subModules);
        }
      }
    } catch (error) {
      this.logger?.error(`Error scanning directory ${dirPath}:`, error);
    }

    return modules;
  }

  /**
   * Load module information from a directory.
   * @param modulePath - The path to the module directory.
   */
  private async loadModuleInfo(modulePath: string): Promise<ScannedModule | null> {
    try {
      const moduleYamlPath = join(modulePath, 'module.yaml');
      const moduleYaml = readFileSync(moduleYamlPath, 'utf-8');
      const parseResult = parseModuleManifestSafe(moduleYaml);

      if (!parseResult.manifest) {
        this.logger?.warn(`Skipping ${moduleYamlPath}: ${parseResult.errors?.join(', ')}`);
        return null;
      }

      const {manifest} = parseResult;

      if (!manifest.name || !manifest.version) {
        this.logger?.error(`Module at ${modulePath} has invalid manifest: missing name or version`);
        return null;
      }

      const indexPath = join(modulePath, 'index.ts');
      const indexJsPath = join(modulePath, 'index.js');

      if (!existsSync(indexPath) && !existsSync(indexJsPath)) {
        this.logger?.warn(`Module ${manifest.name} missing index file at ${modulePath}`);
        return null;
      }

      let moduleType: ModuleType | null;
      if (modulePath.includes('/modules/core/')) {
        moduleType = ModuleType.CORE;
        this.logger?.debug(`Module ${manifest.name} is in core directory, setting type to CORE`);
      } else {
        moduleType = this.parseModuleType(manifest.type);
        if (!moduleType) {
          this.logger?.error(`Invalid module type '${manifest.type}' for module ${manifest.name}`);
          return null;
        }
      }

      return {
        name: manifest.name,
        version: manifest.version,
        type: moduleType,
        path: modulePath,
        dependencies: manifest.dependencies || [],
        config: manifest.config || {},
        metadata: {
          description: manifest.description,
          author: manifest.author,
          cli: manifest.cli,
        },
      };
    } catch (error) {
      this.logger?.error(`Error loading module info from ${modulePath}:`, error);
      return null;
    }
  }

  /**
   * Parse module type string to enum.
   * @param type - The module type string.
   */
  private parseModuleType(type: string): ModuleType | null {
    const typeMap: Record<string, ModuleType> = {
      core: ModuleType.CORE,
      service: ModuleType.SERVICE,
      daemon: ModuleType.DAEMON,
      plugin: ModuleType.PLUGIN,
      extension: ModuleType.EXTENSION,
    };

    return typeMap[type.toLowerCase()] || null;
  }

  /**
   * Store discovered modules in database.
   * @param modules - Array of scanned modules to store.
   */
  private async storeModules(modules: ScannedModule[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO modules (
        name, version, type, path, enabled, auto_start,
        dependencies, config, status, health_status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const eventStmt = this.db.prepare(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `);

    for (const module of modules) {
      try {
        if (!Object.values(ModuleType).includes(module.type)) {
          this.logger?.error(`Invalid module type for ${module.name}: ${module.type}`);
          continue;
        }

        stmt.run(
          module.name,
          module.version,
          module.type,
          module.path,
          1,
          0,
          JSON.stringify(module.dependencies || []),
          JSON.stringify(module.config || {}),
          ModuleStatus.INSTALLED,
          ModuleHealthStatus.UNKNOWN,
          JSON.stringify(module.metadata || {}),
        );

        eventStmt.run(
          module.name,
          ModuleEventType.DISCOVERED,
          JSON.stringify({
 version: module.version,
path: module.path
}),
        );
      } catch (error) {
        this.logger?.error(`Error storing module ${module.name}:`, error);
      }
    }
  }

  /**
   * Get all registered modules from database.
   */
  async getRegisteredModules(): Promise<ModuleInfo[]> {
    const rows = this.db.prepare('SELECT * FROM modules').all() as DatabaseModuleRow[];
    return rows.map(row => { return this.mapRowToModuleInfo(row) });
  }

  /**
   * Get enabled modules.
   */
  async getEnabledModules(): Promise<ModuleInfo[]> {
    const rows = this.db.prepare('SELECT * FROM modules WHERE enabled = 1').all() as DatabaseModuleRow[];
    return rows.map(row => { return this.mapRowToModuleInfo(row) });
  }

  /**
   * Get module by name.
   * @param name - The name of the module.
   */
  async getModule(name: string): Promise<ModuleInfo | undefined> {
    const row = this.db.prepare('SELECT * FROM modules WHERE name = ?').get(name) as DatabaseModuleRow | undefined;
    return row ? this.mapRowToModuleInfo(row) : undefined;
  }

  /**
   * Map database row to ModuleInfo.
   * @param row - The database row.
   */
  private mapRowToModuleInfo(row: DatabaseModuleRow): ModuleInfo {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      type: row.type as ModuleType,
      path: row.path,
      enabled: Boolean(row.enabled),
      autoStart: Boolean(row.auto_start),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      config: row.config ? JSON.parse(row.config) : {},
      status: row.status as ModuleStatus,
      lastError: row.lasterror,
      ...row.discovered_at ? { discoveredAt: new Date(row.discovered_at) } : {},
      ...row.last_started_at ? { lastStartedAt: new Date(row.last_started_at) } : {},
      ...row.last_stopped_at ? { lastStoppedAt: new Date(row.last_stopped_at) } : {},
      healthStatus: (row.health_status as ModuleHealthStatus) || ModuleHealthStatus.UNKNOWN,
      healthMessage: row.health_message,
      ...row.last_health_check ? { lastHealthCheck: new Date(row.last_health_check) } : {},
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at || Date.now()),
      updatedAt: new Date(row.updated_at || Date.now()),
    };
  }

  /**
   * Update module status.
   * @param name - The module name.
   * @param status - The new status.
   * @param error - Optional error message.
   */
  async updateModuleStatus(name: string, status: ModuleStatus, error?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE modules 
      SET status = ?, lasterror = ?, updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `);

    stmt.run(status, error || null, name);

    const eventType = this.mapStatusToEventType(status);
    if (eventType) {
      const eventStmt = this.db.prepare(`
        INSERT INTO module_events (module_id, event_type, event_data)
        VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
      `);

      eventStmt.run(name, eventType, JSON.stringify({
 status,
error
}));
    }
  }

  /**
   * Map module status to event type.
   * @param status - The module status.
   */
  private mapStatusToEventType(status: ModuleStatus): ModuleEventType | null {
    switch (status) {
      case ModuleStatus.LOADING:
      case ModuleStatus.RUNNING:
        return ModuleEventType.STARTED;
      case ModuleStatus.STOPPED:
        return ModuleEventType.STOPPED;
      case ModuleStatus.ERROR:
        return ModuleEventType.ERROR;
      default:
        return null;
    }
  }

  /**
   * Enable or disable a module.
   * @param name - The module name.
   * @param enabled - Whether to enable or disable.
   */
  async setModuleEnabled(name: string, enabled: boolean): Promise<void> {
    const stmt = this.db.prepare('UPDATE modules SET enabled = ? WHERE name = ?');
    stmt.run(enabled ? 1 : 0, name);

    const eventStmt = this.db.prepare(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `);

    eventStmt.run(name, ModuleEventType.CONFIG_CHANGED, JSON.stringify({ enabled }));
  }

  /**
   * Update module health status.
   * @param name - The module name.
   * @param healthy - Whether the module is healthy.
   * @param message - Optional health message.
   */
  async updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void> {
    const healthStatus = healthy ? ModuleHealthStatus.HEALTHY : ModuleHealthStatus.UNHEALTHY;
    const stmt = this.db.prepare(`
      UPDATE modules 
      SET health_status = ?, health_message = ?, last_health_check = CURRENT_TIMESTAMP
      WHERE name = ?
    `);

    stmt.run(healthStatus, message || null, name);

    const eventStmt = this.db.prepare(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `);

    eventStmt.run(name, ModuleEventType.HEALTH_CHECK, JSON.stringify({
 healthy,
message
}));
  }
}
