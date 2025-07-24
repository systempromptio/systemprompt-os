/**
 * Schema discovery service that scans modules for database schemas
 * and initializes tables.
 */

import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { glob } from 'glob';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { SchemaImportService } from '@/modules/core/database/services/schema-import.service.js';
// MCPContentScannerService type will be imported dynamically

export interface ModuleSchema {
  module: string;
  moduleName?: string; // Alias for module
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
 * Service for managing database schemas across modules.
 */
export class SchemaService {
  private static instance: SchemaService;
  private readonly schemas: Map<string, ModuleSchema> = new Map();
  private logger?: ILogger;
  private initialized = false;
  private mcpContentScanner?: any; // MCPContentScannerService
  private importService: SchemaImportService;

  private constructor(
    // @ts-expect-error - Used through importService
    private readonly _databaseService: DatabaseService
  ) {
    this.importService = new SchemaImportService(_databaseService);
  }

  /**
   * Initialize the schema service.
   * @param databaseService - Database service instance.
   * @param logger - Optional logger instance.
   */
  static initialize(databaseService: DatabaseService, logger?: ILogger): SchemaService {
    SchemaService.instance ||= new SchemaService(databaseService);
    if (logger) {
      SchemaService.instance.logger = logger;
      // Pass logger to import service
      SchemaService.instance.importService = new SchemaImportService(databaseService, logger);
    }
    SchemaService.instance.initialized = true;
    return SchemaService.instance;
  }

  /**
   * Set the MCP content scanner.
   * @param scanner - MCP content scanner instance.
   */
  setMCPContentScanner(scanner: any): void {
    this.mcpContentScanner = scanner;
  }

  /**
   * Get the schema service instance.
   * @throws {DatabaseError} If service not initialized.
   */
  static getInstance(): SchemaService {
    if (!SchemaService.instance?.initialized) {
      throw new Error('SchemaService not initialized. Call initialize() first.');
    }
    return SchemaService.instance;
  }

  /**
   * Scan all modules for database schemas.
   * @param baseDir
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

        const initPath = initFileMap.get(module);
        const schema: ModuleSchema = {
          module,
          moduleName: module, // Add alias for compatibility
          schemaPath,
          sql,
          ...initPath ? { initPath } : {},
          ...initPath ? { initSql: await readFile(initPath, 'utf-8') } : {},
        };

        this.schemas.set(module, schema);
        this.logger?.debug('Discovered schema', {
 module,
schemaPath
});
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
   * Initialize all discovered schemas.
   */
  async initializeSchemas(): Promise<void> {
    // Initialize import service
    await this.importService.initialize();

    // Prepare schema files for import
    const schemaFiles = [];
    for (const [module, schema] of this.schemas) {
      schemaFiles.push({
        module,
        filepath: schema.schemaPath,
        checksum: '', // Will be calculated by import service
        content: schema.sql
      });

      // Also add init.sql if present
      if (schema.initSql && schema.initPath) {
        schemaFiles.push({
          module,
          filepath: schema.initPath,
          checksum: '',
          content: schema.initSql
        });
      }
    }

    // Import all schemas
    const result = await this.importService.importSchemas(schemaFiles);

    if (!result.success) {
      this.logger?.error('Schema import failed', { errors: result.errors });
      throw new Error(`Schema import failed: ${result.errors.map(e => { return e.error }).join('; ')}`);
    }

    this.logger?.info('Schema import complete', {
      imported: result.imported.length,
      skipped: result.skipped.length
    });

    // Scan for MCP content after all schemas are imported
    await this.scanMCPContentForAllModules();
  }

  /**
   * Scan MCP content for all modules after schema import.
   */
  private async scanMCPContentForAllModules(): Promise<void> {
    if (!this.mcpContentScanner) {
      return;
    }

    for (const [module, schema] of this.schemas) {
      try {
        const modulePath = dirname(dirname(schema.schemaPath));
        const moduleName = module.replace('core/', '');

        this.logger?.debug('Scanning module for MCP content', {
          module: moduleName,
          modulePath
        });

        await this.mcpContentScanner.scanModule(moduleName, modulePath);
      } catch (error) {
        this.logger?.warn('Failed to scan MCP content for module', {
          module,
          error
        });
      }
    }
  }

  /**
   * Extract module name from file path.
   * @param filePath
   * @param baseDir
   */
  private extractModuleName(filePath: string, baseDir: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const normalizedBase = baseDir.replace(/\\/g, '/').replace(/\/$/, '');
    const relativePath = normalized.replace(`${normalizedBase}/`, '');
    const parts = relativePath.split('/');

    // Handle both core and custom modules
    if (parts[0] === 'core' && parts.length > 1) {
      return `core/${parts[1]}`;
    }

    return parts[0] || 'unknown';
  }

  /**
   * Get schema for a specific module.
   * @param module
   */
  getSchema(module: string): ModuleSchema | undefined {
    return this.schemas.get(module);
  }

  /**
   * Get all discovered schemas.
   */
  getAllSchemas(): Map<string, ModuleSchema> {
    return new Map(this.schemas);
  }

  /**
   * Get list of installed schemas from database.
   */
  async getInstalledSchemas(): Promise<InstalledSchema[]> {
    try {
      const schemas = await this.importService.getImportedSchemas();
      return schemas.map(s => { return {
        module_name: s.module,
        version: '1.0.0', // Simple version since we don't track versions
        installed_at: s.imported_at
      } });
    } catch (error) {
      this.logger?.debug('No imported schemas found', { error });
      return [];
    }
  }

  /**
   * Discover schemas and return as array.
   * @param baseDir
   */
  async discoverSchemasArray(baseDir?: string): Promise<ModuleSchema[]> {
    await this.discoverSchemas(baseDir);
    return Array.from(this.schemas.values());
  }

  /**
   * Initialize the base schema tables.
   */
  async initializeBaseSchema(): Promise<void> {
    await this.importService.initialize();
  }

  /**
   * Install a specific module's schema.
   * @param schema
   */
  async installModuleSchema(schema: ModuleSchema): Promise<void> {
    const schemaFiles = [
      {
        module: schema.module,
        filepath: schema.schemaPath,
        checksum: '',
        content: schema.sql
      }
    ];

    if (schema.initSql && schema.initPath) {
      schemaFiles.push({
        module: schema.module,
        filepath: schema.initPath,
        checksum: '',
        content: schema.initSql
      });
    }

    const result = await this.importService.importSchemas(schemaFiles);

    if (!result.success) {
      throw new Error(`Failed to install module schema: ${result.errors.map(e => { return e.error }).join('; ')}`);
    }

    // Scan for MCP content
    if (this.mcpContentScanner) {
      const modulePath = dirname(dirname(schema.schemaPath));
      const moduleName = schema.module.replace('core/', '');
      await this.scanModuleMCPContent(moduleName, modulePath);
    }
  }

  /**
   * Scan a module for MCP content.
   * @param moduleName - Name of the module.
   * @param modulePath - Path to the module directory.
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
      this.logger?.error('Failed to scan MCP content', {
 module: moduleName,
error
});
      throw error;
    }
  }

  /**
   * Remove MCP content for a module (when uninstalling).
   * @param moduleName - Name of the module.
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
      this.logger?.error('Failed to remove MCP content', {
 module: moduleName,
error
});
      throw error;
    }
  }
}
