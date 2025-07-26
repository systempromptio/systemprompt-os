/**
 * Service for scanning filesystem directories to discover available modules
 * and register them in the database for the module management system.
 * @file Module Scanner Service - Dynamically discovers and registers modules.
 * @module modules/core/modules/services/module-scanner
 */

import {
  existsSync, readFileSync, readdirSync, statSync
} from 'fs';
import { join, resolve } from 'path';
/**
 * Note: Using database service directly as repository doesn't have required database methods
 * This should be refactored to use a proper repository pattern in the future.
 */
import {
  type IDatabaseModuleRow,
  type IModuleInfo,
  type IModuleScanOptions,
  type IModuleScannerService,
  type IScannedModule,
  ModuleEventTypeEnum,
  ModuleHealthStatusEnum,
  ModuleStatusEnum,
  ModuleTypeEnum
} from '@/modules/core/modules/types/index';

import { parseModuleManifestSafe } from '@/modules/core/modules/utils/manifest-parser';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';

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
   */
  private constructor() {
  }

  /**
   * Get singleton instance of ModuleScannerService.
   * @returns The singleton instance.
   */
  public static getInstance(): ModuleScannerService {
    ModuleScannerService.instance ??= new ModuleScannerService();
    return ModuleScannerService.instance;
  }

  /**
   * Initialize the scanner service with logger.
   * @param logger - Logger instance for service operations.
   */
  public async initialize(logger?: ILogger): Promise<void> {
    if (logger !== null && logger !== undefined) {
      (this as any).logger = logger;
    }
    const { DatabaseService: databaseService } = await import('@/modules/core/database/services/database.service');
    const dbService = databaseService.getInstance();
    this.database = {
      execute: dbService.execute.bind(dbService),
      query: dbService.query.bind(dbService)
    };
    this.ensureSchema();
  }

  /**
   * Set the module manager service for validation.
   * @param service - The module manager service instance.
   */
  public setModuleManagerService(service: unknown): void {
    void service
  }

  /**
   * Ensure database schema exists.
   */
  private ensureSchema(): void {
    this.logger?.debug(LogSource.MODULES, 'Module database schema would be initialized here');
  }

  /**
   * Scan for available modules.
   * @param options - Options for scanning modules.
   * @returns Promise resolving to array of scanned modules.
   */
  public async scan(options: IModuleScanOptions = {}): Promise<IScannedModule[]> {
    const paths = options.paths ?? this.defaultPaths;
    const modules: IScannedModule[] = [];

    const validPaths = paths
      .map(basePath => { return resolve(process.cwd(), basePath) })
      .filter(absolutePath => {
        if (existsSync(absolutePath)) {
          return true;
        }
        this.logger?.debug(
          LogSource.MODULES,
          `Skipping non-existent path: ${absolutePath}`
        );
        return false;
      });

    const scanPromises = validPaths.map(async (absolutePath) => { return await this.scanDirectory(absolutePath, options) });

    const scanResults = await Promise.all(scanPromises);
    for (const scannedModules of scanResults) {
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
    options: IModuleScanOptions,
  ): Promise<IScannedModule[]> {
    const modules: IScannedModule[] = [];

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
            this.logger?.debug(
              LogSource.MODULES,
              `Discovered module: ${moduleInfo.name} at ${fullPath}`
            );
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
  private async loadModuleInfo(modulePath: string): Promise<IScannedModule | null> {
    try {
      const moduleYamlPath = join(modulePath, 'module.yaml');
      const moduleYaml = readFileSync(moduleYamlPath, 'utf-8');
      const parseResult = parseModuleManifestSafe(moduleYaml);

      if (!parseResult.manifest) {
        this.logger?.warn(LogSource.MODULES, `Skipping ${moduleYamlPath}: ${parseResult.errors?.join(', ') ?? 'Unknown parsing error'}`);
        return null;
      }

      const { manifest } = parseResult;

      if (manifest.name === null || manifest.name === undefined || manifest.name === ''
          || manifest.version === null || manifest.version === undefined
          || manifest.version === '') {
        this.logger?.error(LogSource.MODULES, `Module at ${modulePath} has invalid manifest: missing name or version`);
        return null;
      }

      const indexPath = join(modulePath, 'index.ts');
      const indexJsPath = join(modulePath, 'index.js');

      if (!existsSync(indexPath) && !existsSync(indexJsPath)) {
        this.logger?.warn(LogSource.MODULES, `Module ${manifest.name} missing index file at ${modulePath}`);
        return null;
      }

      let moduleType: ModuleTypeEnum | null;
      if (modulePath.includes('/modules/core/')) {
        moduleType = ModuleTypeEnum.CORE;
        this.logger?.debug(
          LogSource.MODULES,
          `Module ${manifest.name} is in core directory, setting type to CORE`
        );
      } else {
        moduleType = this.parseModuleType(manifest.type);
        if (moduleType === null) {
          this.logger?.error(
          LogSource.MODULES,
          `Invalid module type '${manifest.type}' for module ${manifest.name}`
        );
          return null;
        }
      }

      return {
        name: manifest.name,
        version: manifest.version,
        type: moduleType,
        path: modulePath,
        dependencies: manifest.dependencies ?? [],
        config: manifest.config ?? {},
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
  private parseModuleType(type: string): ModuleTypeEnum | null {
    const typeMap: Record<string, ModuleTypeEnum> = {
      core: ModuleTypeEnum.CORE,
      service: ModuleTypeEnum.SERVICE,
      daemon: ModuleTypeEnum.DAEMON,
      plugin: ModuleTypeEnum.PLUGIN,
      extension: ModuleTypeEnum.EXTENSION,
    };

    return typeMap[type.toLowerCase()] ?? null;
  }

  /**
   * Store discovered modules in database.
   * @param modules - Array of scanned modules to store.
   */
  private async storeModules(modules: IScannedModule[]): Promise<void> {
    for (const module of modules) {
      await this.storeModule(module);
    }
  }

  /**
   * Store a single module in the database.
   * @param module - The module to store.
   */
  private async storeModule(module: IScannedModule): Promise<void> {
    try {
      if (!this.isValidModuleType(module.type)) {
        this.logger?.error(
          LogSource.MODULES,
          `Invalid module type for ${module.name}: ${module.type}`
        );
        return;
      }

      await this.insertModuleRecord(module);
      await this.insertModuleEvent(module);
    } catch (error) {
      this.logger?.error(
        LogSource.MODULES,
        `Error storing module ${module.name}:`,
        { error: error instanceof Error ? error : new Error(String(error)) }
      );
    }
  }

  /**
   * Validate if the module type is supported.
   * @param type - The module type to validate.
   * @returns True if valid, false otherwise.
   */
  private isValidModuleType(type: ModuleTypeEnum): boolean {
    return type === ModuleTypeEnum.CORE
           || type === ModuleTypeEnum.SERVICE
           || type === ModuleTypeEnum.DAEMON
           || type === ModuleTypeEnum.PLUGIN
           || type === ModuleTypeEnum.EXTENSION;
  }

  /**
   * Insert module record into database.
   * @param module - The module to insert.
   */
  private async insertModuleRecord(module: IScannedModule): Promise<void> {
    if (this.database === null) {
      throw new Error('Database not initialized');
    }
    await this.database.execute(`
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
      JSON.stringify(module.dependencies ?? []),
      JSON.stringify(module.config ?? {}),
      ModuleStatusEnum.INSTALLED,
      ModuleHealthStatusEnum.UNKNOWN,
      JSON.stringify(module.metadata ?? {}),
    ]);
  }

  /**
   * Insert module discovery event into database.
   * @param module - The module that was discovered.
   */
  private async insertModuleEvent(module: IScannedModule): Promise<void> {
    if (this.database === null) {
      throw new Error('Database not initialized');
    }
    await this.database.execute(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `, [
      module.name,
      ModuleEventTypeEnum.DISCOVERED,
      JSON.stringify({
        version: module.version,
        path: module.path
      }),
    ]);
  }

  /**
   * Get all registered modules from database.
   * @returns Promise resolving to array of module information.
   */
  public async getRegisteredModules(): Promise<IModuleInfo[]> {
    if (this.database === null) {
      throw new Error('Database not initialized');
    }
    const rows = await this.database.query<IDatabaseModuleRow>('SELECT * FROM modules');
    return rows.map((row) => { return this.mapRowToModuleInfo(row) });
  }

  /**
   * Get enabled modules.
   * @returns Promise resolving to array of enabled modules.
   */
  public async getEnabledModules(): Promise<IModuleInfo[]> {
    if (this.database === null) {
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
  public async getModule(name: string): Promise<IModuleInfo | undefined> {
    if (this.database === null) {
      throw new Error('Database not initialized');
    }
    const rows = await this.database.query<IDatabaseModuleRow>('SELECT * FROM modules WHERE name = ?', [name]);
    if (rows.length === 0) {
      return undefined;
    }
    const [row] = rows;
    if (row === null || row === undefined) {
      return undefined;
    }
    return this.mapRowToModuleInfo(row);
  }

  /**
   * Map database row to ModuleInfo.
   * @param row - The database row.
   * @returns Mapped module information object.
   */
  private mapRowToModuleInfo(row: IDatabaseModuleRow): IModuleInfo {
    const result: IModuleInfo = {
      id: row.id,
      name: row.name,
      version: row.version,
      type: row.type as ModuleTypeEnum,
      path: row.path,
      enabled: Boolean(row.enabled),
      autoStart: Boolean(row.autoStart),
      dependencies: row.dependencies ? JSON.parse(row.dependencies) as string[] : [],
      config: row.config ? JSON.parse(row.config) as Record<string, unknown> : {},
      status: row.status as ModuleStatusEnum,
      healthStatus: (row.healthStatus as ModuleHealthStatusEnum) ?? ModuleHealthStatusEnum.UNKNOWN,
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
  public async updateModuleStatus(name: string, status: ModuleStatusEnum, error?: string): Promise<void> {
    if (this.database === null) {
      throw new Error('Database not initialized');
    }
    await this.database.execute(`
      UPDATE modules 
      SET status = ?, lasterror = ?, updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `, [status, error ?? null, name]);

    const eventType = this.mapStatusToEventType(status);
    if (eventType !== null && eventType !== undefined) {
      if (this.database === null) {
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
  private mapStatusToEventType(status: ModuleStatusEnum): ModuleEventTypeEnum | null {
    switch (status) {
      case ModuleStatusEnum.LOADING:
      case ModuleStatusEnum.RUNNING:
        return ModuleEventTypeEnum.STARTED;
      case ModuleStatusEnum.STOPPED:
        return ModuleEventTypeEnum.STOPPED;
      case ModuleStatusEnum.ERROR:
        return ModuleEventTypeEnum.ERROR;
      case ModuleStatusEnum.PENDING:
      case ModuleStatusEnum.INITIALIZING:
      case ModuleStatusEnum.STOPPING:
      case ModuleStatusEnum.INSTALLED:
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
    if (this.database === null) {
      throw new Error('Database not initialized');
    }
    await this.database.execute('UPDATE modules SET enabled = ? WHERE name = ?', [enabled ? 1 : 0, name]);

    if (this.database === null) {
      throw new Error('Database not initialized');
    }
    await this.database.execute(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `, [name, ModuleEventTypeEnum.CONFIG_CHANGED, JSON.stringify({ enabled })]);
  }

  /**
   * Update module health status.
   * @param name - The module name.
   * @param healthy - Whether the module is healthy.
   * @param message - Optional health message.
   */
  public async updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void> {
    const healthStatus = healthy ? ModuleHealthStatusEnum.HEALTHY : ModuleHealthStatusEnum.UNHEALTHY;
    if (this.database === null) {
      throw new Error('Database not initialized');
    }
    await this.database.execute(`
      UPDATE modules 
      SET health_status = ?, health_message = ?, last_health_check = CURRENT_TIMESTAMP
      WHERE name = ?
    `, [healthStatus, message ?? null, name]);

    if (this.database === null) {
      throw new Error('Database not initialized');
    }
    await this.database.execute(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `, [name, ModuleEventTypeEnum.HEALTH_CHECK, JSON.stringify({
      healthy,
      message
    })]);
  }
}
