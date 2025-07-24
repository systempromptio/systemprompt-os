/**
 * Schema discovery service that scans modules for database schemas
 * and initializes tables
 */

import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { glob } from 'glob';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { DatabaseService } from '@/modules/core/database/services/database.service.js';
// MCPContentScannerService type will be imported dynamically

export interface ModuleSchema {
  module: string;
  moduleName?: string; // alias for module
  schemaPath: string;
  initPath?: string;
  sql: string;
  initSql?: string;
}

export interface InstalledSchema {
  module_name: string;
  version: string;
  installed_at: string;
}

/**
 * Service for managing database schemas across modules
 */
export class SchemaService {
  private static instance: SchemaService;
  private readonly schemas: Map<string, ModuleSchema> = new Map();
  private logger?: ILogger;
  private initialized = false;
  private mcpContentScanner?: any; // MCPContentScannerService

  private constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Initialize the schema service
   * @param databaseService Database service instance
   * @param logger Optional logger instance
   */
  static initialize(databaseService: DatabaseService, logger?: ILogger): SchemaService {
    if (!SchemaService.instance) {
      SchemaService.instance = new SchemaService(databaseService);
    }
    SchemaService.instance.logger = logger || SchemaService.instance.logger;
    SchemaService.instance.initialized = true;
    return SchemaService.instance;
  }

  /**
   * Set the MCP content scanner
   * @param scanner MCP content scanner instance
   */
  setMCPContentScanner(scanner: any): void {
    this.mcpContentScanner = scanner;
  }

  /**
   * Get the schema service instance
   * @throws {DatabaseError} If service not initialized
   */
  static getInstance(): SchemaService {
    if (!SchemaService.instance?.initialized) {
      throw new Error('SchemaService not initialized. Call initialize() first.');
    }
    return SchemaService.instance;
  }

  /**
   * Scan all modules for database schemas
   */
  async discoverSchemas(baseDir: string = '/app/src/modules'): Promise<void> {
    try {
      this.logger?.info('Discovering module schemas', { baseDir });

      // Find all schema.sql files
      const schemaFiles = await glob('**/database/schema.sql', {
        cwd: baseDir,
        absolute: true,
      });

      // Find all init.sql files
      const initFiles = await glob('**/database/init.sql', {
        cwd: baseDir,
        absolute: true,
      });

      // Create a map of init files by module
      const initFileMap = new Map<string, string>();
      for (const initFile of initFiles) {
        const module = this.extractModuleName(initFile, baseDir);
        initFileMap.set(module, initFile);
      }

      // Load each schema
      for (const schemaPath of schemaFiles) {
        const module = this.extractModuleName(schemaPath, baseDir);
        const sql = await readFile(schemaPath, 'utf-8');

        const schema: ModuleSchema = {
          module,
          moduleName: module, // Add alias for compatibility
          schemaPath,
          sql,
          initPath: initFileMap.get(module),
          initSql: initFileMap.has(module)
            ? await readFile(initFileMap.get(module)!, 'utf-8')
            : undefined,
        };

        this.schemas.set(module, schema);
        this.logger?.debug('Discovered schema', { module, schemaPath });
      }

      this.logger?.info('Schema discovery complete', {
        modulesFound: this.schemas.size,
      });
    } catch (error) {
      this.logger?.error('Schema discovery failed', { error });
      throw error;
    }
  }

  /**
   * Initialize all discovered schemas
   */
  async initializeSchemas(): Promise<void> {
    // const conn = await this.databaseService.getConnection();

    // Create schema tracking table
    await this.createSchemaTable();

    // Get already initialized schemas
    const initialized = await this.getInitializedSchemas();

    // Initialize each schema in order
    for (const [module, schema] of this.schemas) {
      if (initialized.has(module)) {
        this.logger?.debug('Schema already initialized', { module });
        continue;
      }

      await this.initializeSchema(module, schema);
    }
  }

  /**
   * Initialize a single module's schema
   */
  private async initializeSchema(module: string, schema: ModuleSchema): Promise<void> {
    try {
      this.logger?.info('Initializing schema', { module });

      await this.databaseService.transaction(async (conn) => {
        // Execute schema SQL
        await conn.execute(schema.sql);

        // Execute init SQL if available
        if (schema.initSql) {
          await conn.execute(schema.initSql);
        }

        // Record schema initialization
        await conn.execute(
          `INSERT INTO _schema_versions (module, version, applied_at) 
           VALUES (?, ?, datetime('now'))`,
          [module, '1.0.0'],
        );
      });

      this.logger?.info('Schema initialized successfully', { module });

      // Scan for MCP content after schema initialization
      if (this.mcpContentScanner) {
        try {
          // Get the module path from the schema path
          const modulePath = dirname(dirname(schema.schemaPath));
          const moduleName = module.replace('core/', ''); // Remove core/ prefix if present

          this.logger?.debug('Scanning module for MCP content', { module: moduleName, modulePath });
          await this.mcpContentScanner.scanModule(moduleName, modulePath);
        } catch (error) {
          this.logger?.warn('Failed to scan MCP content for module', { module, error });
          // Don't throw - MCP content is optional
        }
      }
    } catch (error) {
      this.logger?.error('Failed to initialize schema', { module, error });
      throw error;
    }
  }

  /**
   * Create schema tracking table
   */
  private async createSchemaTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS _schema_versions (
        module TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `;
    await this.databaseService.execute(sql);
  }

  /**
   * Create migrations tracking table
   */
  private async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS _migrations (
        module TEXT NOT NULL,
        version TEXT NOT NULL,
        filename TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (module, version)
      )
    `;
    await this.databaseService.execute(sql);
  }

  /**
   * Get list of already initialized schemas
   */
  private async getInitializedSchemas(): Promise<Set<string>> {
    const rows = await this.databaseService.query<{ module: string }>(
      'SELECT module FROM _schema_versions',
    );
    return new Set(rows.map((row) => row.module));
  }

  /**
   * Extract module name from file path
   */
  private extractModuleName(filePath: string, baseDir: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const normalizedBase = baseDir.replace(/\\/g, '/').replace(/\/$/, '');
    const relativePath = normalized.replace(`${normalizedBase  }/`, '');
    const parts = relativePath.split('/');

    // Handle both core and custom modules
    if (parts[0] === 'core' && parts.length > 1) {
      return `core/${parts[1]}`;
    }

    return parts[0] || 'unknown';
  }

  /**
   * Get schema for a specific module
   */
  getSchema(module: string): ModuleSchema | undefined {
    return this.schemas.get(module);
  }

  /**
   * Get all discovered schemas
   */
  getAllSchemas(): Map<string, ModuleSchema> {
    return new Map(this.schemas);
  }

  /**
   * Get list of installed schemas from database
   */
  async getInstalledSchemas(): Promise<InstalledSchema[]> {
    try {
      const rows = await this.databaseService.query<InstalledSchema>(
        'SELECT module as module_name, version, applied_at as installed_at FROM _schema_versions ORDER BY applied_at DESC',
      );
      return rows;
    } catch (error) {
      this.logger?.debug('No schema versions table found', { error });
      return [];
    }
  }

  /**
   * Discover schemas and return as array
   */
  async discoverSchemasArray(baseDir?: string): Promise<ModuleSchema[]> {
    await this.discoverSchemas(baseDir);
    return Array.from(this.schemas.values());
  }

  /**
   * Initialize the base schema tables
   */
  async initializeBaseSchema(): Promise<void> {
    await this.createSchemaTable();
    await this.createMigrationsTable();
  }

  /**
   * Install a specific module's schema
   */
  async installModuleSchema(schema: ModuleSchema): Promise<void> {
    await this.initializeSchema(schema.module, schema);
  }

  /**
   * Scan a module for MCP content
   * @param moduleName Name of the module
   * @param modulePath Path to the module directory
   */
  async scanModuleMCPContent(moduleName: string, modulePath: string): Promise<void> {
    if (!this.mcpContentScanner) {
      this.logger?.warn('MCP content scanner not available');
      return;
    }

    try {
      await this.mcpContentScanner.scanModule(moduleName, modulePath);
      this.logger?.info('MCP content scan completed', { module: moduleName });
    } catch (error) {
      this.logger?.error('Failed to scan MCP content', { module: moduleName, error });
      throw error;
    }
  }

  /**
   * Remove MCP content for a module (when uninstalling)
   * @param moduleName Name of the module
   */
  async removeModuleMCPContent(moduleName: string): Promise<void> {
    if (!this.mcpContentScanner) {
      this.logger?.warn('MCP content scanner not available');
      return;
    }

    try {
      await this.mcpContentScanner.removeModuleContent(moduleName);
      this.logger?.info('MCP content removed', { module: moduleName });
    } catch (error) {
      this.logger?.error('Failed to remove MCP content', { module: moduleName, error });
      throw error;
    }
  }
}
