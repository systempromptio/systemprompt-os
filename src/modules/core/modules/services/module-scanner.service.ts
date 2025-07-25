/**
 * @file Module Scanner Service - Dynamically discovers and registers modules.
 * @module modules/core/modules/services/module-scanner
 * @description Service for scanning filesystem directories to discover available modules
 * and register them in the database for the module management system.
 */

import {
  existsSync, readFileSync, readdirSync, statSync
} from 'fs';
import { join, resolve } from 'path';
/*
 * Note: Using database service directly as repository doesn't have required database methods
 * This should be refactored to use a proper repository pattern in the future
 */
import type {
  IDatabaseModuleRow,
  ModuleScannerService as IModuleScannerService,
  ModuleEventType,
  ModuleHealthStatus,
  ModuleInfo,
  ModuleScanOptions,
  ModuleStatus,
  ModuleType,
  ScannedModule
} from '@/modules/core/modules/types/index';
import { parseModuleManifestSafe } from '@/modules/core/modules/utils/manifest-parser';
import type { ILogger, LogSource } from '@/modules/core/logger/types/index';

/**
 * Service for scanning and discovering available modules.
 * Implements singleton pattern as required for core modules.
 */
export class ModuleScannerService implements IModuleScannerService {
  private static instance: ModuleScannerService | null = null;
  private readonly logger: ILogger | undefined;
  private readonly defaultPaths = ['src/modules/core', 'src/modules/custom', 'extensions/modules'];
  private database: {
    execute: (sql: string, params?: unknown[]) => Promise<void>;
    query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  } | null = null;

  /**
   * Private constructor to enforce singleton pattern.
   * @param logger - Optional logger instance.
   */
  private constructor(logger?: ILogger) {
    this.logger = logger;
  }

  /**
   * Get singleton instance of ModuleScannerService.
   * @param logger - Optional logger instance (only used on first call).
   * @returns The singleton instance.
   */
  public static getInstance(logger?: ILogger): ModuleScannerService {
    ModuleScannerService.instance ||= new ModuleScannerService(logger);
    return ModuleScannerService.instance;
  }

  /**
   * Initialize the scanner service.
   */
  public async initialize(): Promise<void> {
    const { DatabaseService } = await import('@/modules/core/database/services/database.service');
    const dbService = DatabaseService.getInstance();
    this.database = {
      execute: dbService.execute.bind(dbService),
      query: dbService.query.bind(dbService)
    };
    await this.ensureSchema();
  }

  /**
   * Set the module manager service for validation.
   * @param _service - The module manager service instance.
   */
  public setModuleManagerService(_service: unknown): void {
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
   * @returns Promise resolving to array of scanned modules.
   */
  public async scan(options: ModuleScanOptions = {}): Promise<ScannedModule[]> {
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
          const moduleInfo = await this.loadModuleInfo(fullPath);
          if (moduleInfo) {
            modules.push(moduleInfo);
            this.logger?.debug(LogSource.MODULES, `Discovered module: ${moduleInfo.name} at ${fullPath}`);
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
        this.logger?.warn(LogSource.MODULES, `Skipping ${moduleYamlPath}: ${parseResult.errors?.join(', ') ?? 'Unknown parsing error'}`);
        return null;
      }

      const { manifest } = parseResult;

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
        moduleType = 'core' as ModuleType;
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
   * @returns The parsed module type or null if invalid.
   */
  private parseModuleType(type: string): ModuleType | null {
    const typeMap: Record<string, ModuleType> = {
      core: 'core' as ModuleType,
      service: 'service' as ModuleType,
      daemon: 'daemon' as ModuleType,
      plugin: 'plugin' as ModuleType,
      extension: 'extension' as ModuleType,
    };

    return typeMap[type.toLowerCase()] ?? null;
  }

  /**
   * Store discovered modules in database.
   * @param modules - Array of scanned modules to store.
   */
  private async storeModules(modules: ScannedModule[]): Promise<void> {
    for (const module of modules) {
      try {
        const validTypes = ['core', 'service', 'daemon', 'plugin', 'extension'] as const;
        if (!validTypes.includes(moduleInfo.type as typeof validTypes[number])) {
          this.logger?.error(LogSource.MODULES, `Invalid module type for ${moduleInfo.name}: ${moduleInfo.type}`);
          continue;
        }

        if (!this.database) {
          throw new Error('Database not initialized');
        }
        await this.database.execute(`
          INSERT OR REPLACE INTO modules (
            name, version, type, path, enabled, auto_start,
            dependencies, config, status, health_status, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          moduleInfo.name,
          moduleInfo.version,
          moduleInfo.type,
          moduleInfo.path,
          1,
          0,
          JSON.stringify(moduleInfo.dependencies ?? []),
          JSON.stringify(moduleInfo.config ?? {}),
          'installed' as ModuleStatus,
          'unknown' as ModuleHealthStatus,
          JSON.stringify(moduleInfo.metadata ?? {}),
        ]);

        if (!this.database) {
          throw new Error('Database not initialized');
        }
        await this.database.execute(`
          INSERT INTO module_events (module_id, event_type, event_data)
          VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
        `, [
          moduleInfo.name,
          'discovered' as ModuleEventType,
          JSON.stringify({
            version: moduleInfo.version,
            path: moduleInfo.path
          }),
        ]);
      } catch (error) {
        this.logger?.error(LogSource.MODULES, `Error storing module ${moduleInfo.name}:`, { error: error instanceof Error ? error : new Error(String(error)) });
      }
    }
  }

  /**
   * Get all registered modules from database.
   * @returns Promise resolving to array of module information.
   */
  public async getRegisteredModules(): Promise<ModuleInfo[]> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    const rows = await this.database.query<IDatabaseModuleRow>('SELECT * FROM modules');
    return rows.map((row) => { return this.mapRowToModuleInfo(row) });
  }

  /**
   * Get enabled modules.
   * @returns Promise resolving to array of enabled modules.
   */
  public async getEnabledModules(): Promise<ModuleInfo[]> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    const rows = await this.database.query<IDatabaseModuleRow>('SELECT * FROM modules WHERE enabled = 1');
    return rows.map((row) => { return this.mapRowToModuleInfo(row) });
  }

  /**
   * Get module by name.
   * @param name - The name of the module.
   * @returns Promise resolving to module information or undefined if not found.
   */
  public async getModule(name: string): Promise<ModuleInfo | undefined> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    const rows = await this.database.query<IDatabaseModuleRow>('SELECT * FROM modules WHERE name = ?', [name]);
    if (rows.length === 0) {
      return undefined;
    }
    const [row] = rows;
    if (!row) {
      return undefined;
    }
    return this.mapRowToModuleInfo(row);
  }

  /**
   * Map database row to ModuleInfo.
   * @param row - The database row.
   * @returns Mapped module information object.
   */
  private mapRowToModuleInfo(row: IDatabaseModuleRow): ModuleInfo {
    const result: ModuleInfo = {
      id: row.id,
      name: row.name,
      version: row.version,
      type: row.type as ModuleType,
      path: row.path,
      enabled: Boolean(row.enabled),
      autoStart: Boolean(row.autoStart),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) as string[] : [],
      config: row.config ? JSON.parse(row.config) as Record<string, unknown> : {},
      status: row.status as ModuleStatus,
      healthStatus: (row.healthStatus as ModuleHealthStatus) ?? 'unknown' as ModuleHealthStatus,
      metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : {},
      createdAt: new Date(row.createdAt ?? Date.now()),
      updatedAt: new Date(row.updatedAt ?? Date.now()),
    };

    if (row.lasterror !== null && row.lasterror !== undefined) {
      result.lastError = row.lasterror;
    }
    if (row.discoveredAt !== null && row.discoveredAt !== undefined) {
      result.discoveredAt = new Date(row.discoveredAt);
    }
    if (row.lastStartedAt !== null && row.lastStartedAt !== undefined) {
      result.lastStartedAt = new Date(row.lastStartedAt);
    }
    if (row.lastStoppedAt !== null && row.lastStoppedAt !== undefined) {
      result.lastStoppedAt = new Date(row.lastStoppedAt);
    }
    if (row.healthMessage !== null && row.healthMessage !== undefined) {
      result.healthMessage = row.healthMessage;
    }
    if (row.lastHealthCheck !== null && row.lastHealthCheck !== undefined) {
      result.lastHealthCheck = new Date(row.lastHealthCheck);
    }

    return result;
  }

  /**
   * Update module status.
   * @param name - The module name.
   * @param status - The new status.
   * @param error - Optional error message.
   */
  public async updateModuleStatus(name: string, status: ModuleStatus, error?: string): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    await this.database.execute(`
      UPDATE modules 
      SET status = ?, lasterror = ?, updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `, [status, error ?? null, name]);

    const eventType = this.mapStatusToEventType(status);
    if (eventType !== null && eventType !== undefined) {
      if (!this.database) {
        throw new Error('Database not initialized');
      }
      await this.database.execute(`
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
   * @returns The corresponding event type or null if no mapping exists.
   */
  private mapStatusToEventType(status: ModuleStatus): ModuleEventType | null {
    switch (status) {
      case 'loading' as ModuleStatus:
      case 'running' as ModuleStatus:
        return 'started' as ModuleEventType;
      case 'stopped' as ModuleStatus:
        return 'stopped' as ModuleEventType;
      case 'error' as ModuleStatus:
        return 'error' as ModuleEventType;
      case 'pending' as ModuleStatus:
      case 'initializing' as ModuleStatus:
      case 'stopping' as ModuleStatus:
      case 'installed' as ModuleStatus:
        return null;
      default:
        return null;
    }
  }

  /**
   * Enable or disable a module.
   * @param name - The module name.
   * @param enabled - Whether to enable or disable.
   */
  public async setModuleEnabled(name: string, enabled: boolean): Promise<void> {
    await this.repository.execute('UPDATE modules SET enabled = ? WHERE name = ?', [enabled ? 1 : 0, name]);

    await this.repository.execute(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `, [name, 'config_changed' as ModuleEventType, JSON.stringify({ enabled })]);
  }

  /**
   * Update module health status.
   * @param name - The module name.
   * @param healthy - Whether the module is healthy.
   * @param message - Optional health message.
   */
  public async updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void> {
    const healthStatus = healthy ? 'healthy' as ModuleHealthStatus : 'unhealthy' as ModuleHealthStatus;
    await this.repository.execute(`
      UPDATE modules 
      SET health_status = ?, health_message = ?, last_health_check = CURRENT_TIMESTAMP
      WHERE name = ?
    `, [healthStatus, message ?? null, name]);

    await this.repository.execute(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `, [name, 'health_check' as ModuleEventType, JSON.stringify({
      healthy,
      message
    })]);
  }
}
