/**
 * @fileoverview Module Scanner Service - Dynamically discovers and registers modules
 * @module modules/core/modules/services/module-scanner
 */

import { readdirSync, existsSync, readFileSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Logger } from '@/modules/types.js';
import { createModuleAdapter } from '@/modules/core/database/adapters/module-adapter.js';
import type {
  ScannedModule,
  ModuleScanOptions,
  ModuleInfo,
  ModuleScannerService as IModuleScannerService
} from '../types/index.js';
import { 
  ModuleType, 
  ModuleStatus, 
  ModuleEventType, 
  ModuleHealthStatus
} from '../types/index.js';
import type { ModuleManagerService } from './module-manager.service.js';
import { parseModuleManifestSafe } from '../utils/manifest-parser.js';

/**
 * Service for scanning and discovering available modules
 */
export class ModuleScannerService implements IModuleScannerService {
  private readonly logger?: Logger;
  private db: any;
  private moduleManagerService?: ModuleManagerService;
  private readonly defaultPaths = [
    'src/modules/core',
    'src/modules/custom',
    'extensions/modules'
  ];

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize the scanner service
   */
  async initialize(): Promise<void> {
    this.db = await createModuleAdapter('modules');
    await this.ensureSchema();
  }

  /**
   * Set the module manager service for validation
   */
  setModuleManagerService(service: ModuleManagerService): void {
    this.moduleManagerService = service;
  }

  /**
   * Ensure database schema exists
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
  }

  /**
   * Scan for available modules
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

    // Store discovered modules in database
    await this.storeModules(modules);

    return modules;
  }

  /**
   * Scan a directory for modules
   */
  private async scanDirectory(dirPath: string, options: ModuleScanOptions): Promise<ScannedModule[]> {
    const modules: ScannedModule[] = [];

    try {
      const entries = readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stat = statSync(fullPath);

        if (!stat.isDirectory()) {continue;}

        // Check if this is a module directory (has module.yaml)
        const moduleYamlPath = join(fullPath, 'module.yaml');
        if (existsSync(moduleYamlPath)) {
          const module = await this.loadModuleInfo(fullPath);
          if (module) {
            modules.push(module);
            this.logger?.debug(`Discovered module: ${module.name} at ${fullPath}`);
          }
        } else if (options.deep) {
          // Recursively scan subdirectories
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
   * Load module information from a directory
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
      
      const manifest = parseResult.manifest;

      // Use module manager service validation if available
      if (this.moduleManagerService) {
        const validationResult = this.moduleManagerService.validateExtension(modulePath, true);
        if (!validationResult.valid) {
          this.logger?.error(`Module validation failed for ${modulePath}:`, validationResult.errors);
          return null;
        }
      }

      // Check if index file exists
      const indexPath = join(modulePath, 'index.ts');
      const indexJsPath = join(modulePath, 'index.js');
      
      if (!existsSync(indexPath) && !existsSync(indexJsPath)) {
        this.logger?.warn(`Module ${manifest.name} missing index file at ${modulePath}`);
        return null;
      }

      // Validate and convert module type
      const moduleType = this.parseModuleType(manifest.type);
      if (!moduleType) {
        this.logger?.error(`Invalid module type '${manifest.type}' for module ${manifest.name}`);
        return null;
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
          cli: manifest.cli
        }
      };
    } catch (error) {
      this.logger?.error(`Error loading module info from ${modulePath}:`, error);
      return null;
    }
  }

  /**
   * Parse module type string to enum
   */
  private parseModuleType(type: string): ModuleType | null {
    const typeMap: Record<string, ModuleType> = {
      'core': ModuleType.CORE,
      'service': ModuleType.SERVICE,
      'daemon': ModuleType.DAEMON,
      'plugin': ModuleType.PLUGIN,
      'extension': ModuleType.EXTENSION
    };
    
    return typeMap[type.toLowerCase()] || null;
  }

  /**
   * Store discovered modules in database
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
        // Validate types match database constraints
        if (!Object.values(ModuleType).includes(module.type)) {
          this.logger?.error(`Invalid module type for ${module.name}: ${module.type}`);
          continue;
        }

        stmt.run(
          module.name,
          module.version,
          module.type,
          module.path,
          1, // enabled by default
          0, // don't auto-start by default
          JSON.stringify(module.dependencies || []),
          JSON.stringify(module.config || {}),
          ModuleStatus.INSTALLED,
          ModuleHealthStatus.UNKNOWN,
          JSON.stringify(module.metadata || {})
        );

        eventStmt.run(
          module.name,
          ModuleEventType.DISCOVERED,
          JSON.stringify({ version: module.version, path: module.path })
        );
      } catch (error) {
        this.logger?.error(`Error storing module ${module.name}:`, error);
      }
    }
  }

  /**
   * Get all registered modules from database
   */
  async getRegisteredModules(): Promise<ModuleInfo[]> {
    const rows = this.db.prepare('SELECT * FROM modules').all();
    return rows.map((row: any) => this.mapRowToModuleInfo(row));
  }

  /**
   * Get enabled modules
   */
  async getEnabledModules(): Promise<ModuleInfo[]> {
    const rows = this.db.prepare('SELECT * FROM modules WHERE enabled = 1').all();
    return rows.map((row: any) => this.mapRowToModuleInfo(row));
  }

  /**
   * Get module by name
   */
  async getModule(name: string): Promise<ModuleInfo | undefined> {
    const row = this.db.prepare('SELECT * FROM modules WHERE name = ?').get(name);
    return row ? this.mapRowToModuleInfo(row) : undefined;
  }

  /**
   * Map database row to ModuleInfo
   */
  private mapRowToModuleInfo(row: any): ModuleInfo {
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
      ...(row.discovered_at && { discoveredAt: new Date(row.discovered_at) }),
      ...(row.last_started_at && { lastStartedAt: new Date(row.last_started_at) }),
      ...(row.last_stopped_at && { lastStoppedAt: new Date(row.last_stopped_at) }),
      healthStatus: row.health_status as ModuleHealthStatus || ModuleHealthStatus.UNKNOWN,
      healthMessage: row.health_message,
      ...(row.last_health_check && { lastHealthCheck: new Date(row.last_health_check) }),
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at || Date.now()),
      updatedAt: new Date(row.updated_at || Date.now())
    };
  }

  /**
   * Update module status
   */
  async updateModuleStatus(name: string, status: ModuleStatus, error?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE modules 
      SET status = ?, lasterror = ?, updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `);
    
    stmt.run(status, error || null, name);

    // Record event based on status
    const eventType = this.mapStatusToEventType(status);
    if (eventType) {
      const eventStmt = this.db.prepare(`
        INSERT INTO module_events (module_id, event_type, event_data)
        VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
      `);
      
      eventStmt.run(name, eventType, JSON.stringify({ status, error }));
    }
  }

  /**
   * Map module status to event type
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
   * Enable or disable a module
   */
  async setModuleEnabled(name: string, enabled: boolean): Promise<void> {
    const stmt = this.db.prepare('UPDATE modules SET enabled = ? WHERE name = ?');
    stmt.run(enabled ? 1 : 0, name);
    
    // Record config change event
    const eventStmt = this.db.prepare(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `);
    
    eventStmt.run(name, ModuleEventType.CONFIG_CHANGED, JSON.stringify({ enabled }));
  }

  /**
   * Update module health status
   */
  async updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void> {
    const healthStatus = healthy ? ModuleHealthStatus.HEALTHY : ModuleHealthStatus.UNHEALTHY;
    const stmt = this.db.prepare(`
      UPDATE modules 
      SET health_status = ?, health_message = ?, last_health_check = CURRENT_TIMESTAMP
      WHERE name = ?
    `);
    
    stmt.run(healthStatus, message || null, name);
    
    // Record health check event
    const eventStmt = this.db.prepare(`
      INSERT INTO module_events (module_id, event_type, event_data)
      VALUES ((SELECT id FROM modules WHERE name = ?), ?, ?)
    `);
    
    eventStmt.run(name, ModuleEventType.HEALTH_CHECK, JSON.stringify({ healthy, message }));
  }
}