/**
 * @file Module Scanner Service - Dynamically discovers and registers modules.
 * @module modules/core/modules/services/module-scanner
 */

import {
 existsSync, readFileSync, readdirSync, statSync
} from 'fs';
import { join, resolve } from 'path';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
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
import { LogSource } from '@/modules/core/logger/types/index.js';

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
  private db!: DatabaseService;
  private readonly defaultPaths = ['src/modules/core', 'src/modules/custom', 'extensions/modules'];

  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  /**
   * Initialize the scanner service.
   */
  async initialize(): Promise<void> {
    this.db = DatabaseService.getInstance();
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
    this.logger?.debug(LogSource.MODULES, 'Module database schema would be initialized here');
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
        this.logger?.debug(LogSource.MODULES, `Skipping non-existent path: ${absolutePath}`);
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
            this.logger?.debug(LogSource.MODULES, `Discovered module: ${module.name} at ${fullPath}`);
          }
        } else if (options.deep) {
          const subModules = await this.scanDirectory(fullPath, options);
          modules.push(...subModules);
        }
      }
    } catch (error) {
      this.logger?.error(LogSource.MODULES, `Error scanning directory ${dirPath}:`, { error: error instanceof Error ? error : new Error(String(error)) });
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
        this.logger?.warn(LogSource.MODULES, `Skipping ${moduleYamlPath}: ${parseResult.errors?.join(', ')}`);
        return null;
      }

      const {manifest} = parseResult;

      if (!manifest.name || !manifest.version) {
        this.logger?.error(LogSource.MODULES, `Module at ${modulePath} has invalid manifest: missing name or version`);
        return null;
      }

      const indexPath = join(modulePath, 'index.ts');
      const indexJsPath = join(modulePath, 'index.js');

      if (!existsSync(indexPath) && !existsSync(indexJsPath)) {
        this.logger?.warn(LogSource.MODULES, `Module ${manifest.name} missing index file at ${modulePath}`);
        return null;
      }

      let moduleType: ModuleType | null;
      if (modulePath.includes('/modules/core/')) {
        moduleType = ModuleType.CORE;
        this.logger?.debug(LogSource.MODULES, `Module ${manifest.name} is in core directory, setting type to CORE`);
      } else {
        moduleType = this.parseModuleType(manifest.type);
        if (!moduleType) {
          this.logger?.error(LogSource.MODULES, `Invalid module type '${manifest.type}' for module ${manifest.name}`);
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
      this.logger?.error(LogSource.MODULES, `Error loading module info from ${modulePath}:`, { error: error instanceof Error ? error : new Error(String(error)) });
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
    for (const module of modules) {
      try {
        if (!Object.values(ModuleType).includes(module.type)) {
          this.logger?.error(LogSource.MODULES, `Invalid module type for ${module.name}: ${module.type}`);
          continue;
        }

        await this.db.execute(`
          INSERT OR REPLACE INTO modules (
            name, version, type, path, enabled, auto_start,
            dependencies, config, status, health_status, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
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
        ]);

        await this.db.execute(`
          INSERT INTO module_events (module_id, event_type, event_data)
          VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
        `, [
          module.name,
          ModuleEventType.DISCOVERED,
          JSON.stringify({
            version: module.version,
            path: module.path
          }),
        ]);
      } catch (error) {
        this.logger?.error(LogSource.MODULES, `Error storing module ${module.name}:`, { error: error instanceof Error ? error : new Error(String(error)) });
      }
    }
  }

  /**
   * Get all registered modules from database.
   */
  async getRegisteredModules(): Promise<ModuleInfo[]> {
    const rows = await this.db.query<DatabaseModuleRow>('SELECT * FROM modules');
    return rows.map(row => { return this.mapRowToModuleInfo(row) });
  }

  /**
   * Get enabled modules.
   */
  async getEnabledModules(): Promise<ModuleInfo[]> {
    const rows = await this.db.query<DatabaseModuleRow>('SELECT * FROM modules WHERE enabled = 1');
    return rows.map(row => { return this.mapRowToModuleInfo(row) });
  }

  /**
   * Get module by name.
   * @param name - The name of the module.
   */
  async getModule(name: string): Promise<ModuleInfo | undefined> {
    const rows = await this.db.query<DatabaseModuleRow>('SELECT * FROM modules WHERE name = ?', [name]);
    if (rows.length === 0) {
      return undefined;
    }
    const row = rows[0];
    if (!row) {
      return undefined;
    }
    return this.mapRowToModuleInfo(row);
  }

  /**
   * Map database row to ModuleInfo.
   * @param row - The database row.
   */
  private mapRowToModuleInfo(row: DatabaseModuleRow): ModuleInfo {
    const result: ModuleInfo = {
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
      healthStatus: (row.health_status as ModuleHealthStatus) || ModuleHealthStatus.UNKNOWN,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at || Date.now()),
      updatedAt: new Date(row.updated_at || Date.now()),
    };

    if (row.lasterror) {
      result.lastError = row.lasterror;
    }
    if (row.discovered_at) {
      result.discoveredAt = new Date(row.discovered_at);
    }
    if (row.last_started_at) {
      result.lastStartedAt = new Date(row.last_started_at);
    }
    if (row.last_stopped_at) {
      result.lastStoppedAt = new Date(row.last_stopped_at);
    }
    if (row.health_message) {
      result.healthMessage = row.health_message;
    }
    if (row.last_health_check) {
      result.lastHealthCheck = new Date(row.last_health_check);
    }

    return result;
  }

  /**
   * Update module status.
   * @param name - The module name.
   * @param status - The new status.
   * @param error - Optional error message.
   */
  async updateModuleStatus(name: string, status: ModuleStatus, error?: string): Promise<void> {
    await this.db.execute(`
      UPDATE modules 
      SET status = ?, lasterror = ?, updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `, [status, error || null, name]);

    const eventType = this.mapStatusToEventType(status);
    if (eventType) {
      await this.db.execute(`
        INSERT INTO module_events (module_id, event_type, event_data)
        VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
      `, [name, eventType, JSON.stringify({
        status,
        error
      })]);
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
    await this.db.execute('UPDATE modules SET enabled = ? WHERE name = ?', [enabled ? 1 : 0, name]);

    await this.db.execute(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `, [name, ModuleEventType.CONFIG_CHANGED, JSON.stringify({ enabled })]);
  }

  /**
   * Update module health status.
   * @param name - The module name.
   * @param healthy - Whether the module is healthy.
   * @param message - Optional health message.
   */
  async updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void> {
    const healthStatus = healthy ? ModuleHealthStatus.HEALTHY : ModuleHealthStatus.UNHEALTHY;
    await this.db.execute(`
      UPDATE modules 
      SET health_status = ?, health_message = ?, last_health_check = CURRENT_TIMESTAMP
      WHERE name = ?
    `, [healthStatus, message || null, name]);

    await this.db.execute(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `, [name, ModuleEventType.HEALTH_CHECK, JSON.stringify({
      healthy,
      message
    })]);
  }
}
