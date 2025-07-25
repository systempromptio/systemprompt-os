/**
 * Schema discovery service that scans modules for database schemas
 * and initializes tables.
 * @file Schema discovery and management service.
 * @module database/services/schema
 */

import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { glob } from 'glob';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IInstalledSchema, IModuleSchema } from '@/modules/core/database/types/schema.types';
import { ZERO } from '@/modules/core/database/constants/index';

/**
 * MCP content scanner interface.
 */
interface IMCPContentScanner {
  scanModule(moduleName: string, modulePath: string): Promise<void>;
  removeModuleContent(moduleName: string): Promise<void>;
}

/**
 * Import service interface.
 */
interface IImportService {
  initialize(): Promise<void>;
  importSchemas(schemaFiles: Array<{
    module: string;
    filepath: string;
    checksum: string;
    content: string;
  }>): Promise<{
    success: boolean;
    imported: string[];
    skipped: string[];
    errors: Array<{ file: string; error: string }>;
  }>;
  getImportedSchemas(): Promise<Array<{
    module: string;
    filepath: string;
    checksum: string;
    imported_at: string;
  }>>;
}

/**
 * Service for managing database schemas across modules.
 */
export class SchemaService {
  private static instance: SchemaService;
  private readonly schemas: Map<string, IModuleSchema> = new Map();
  private logger?: ILogger;
  private initialized = false;
  private mcpContentScanner?: IMCPContentScanner;
  private importService?: IImportService;

  /**
   * Creates a new schema service instance.
   */
  private constructor() {}

  /**
   * Initialize the schema service.
   * @param _databaseService - Database service instance.
   * @param importService - Schema import service instance.
   * @param logger - Optional logger instance.
   * @returns The initialized schema service instance.
   */
  public static initialize(
    _databaseService: unknown,
    importService: IImportService,
    logger?: ILogger
  ): SchemaService {
    SchemaService.instance ||= new SchemaService();
    SchemaService.instance.importService = importService;
    if (logger !== undefined) {
      SchemaService.instance.logger = logger;
    }
    SchemaService.instance.initialized = true;
    return SchemaService.instance;
  }

  /**
   * Set the MCP content scanner.
   * @param scanner - MCP content scanner instance.
   * @returns Void.
   */
  public setMcpContentScanner(scanner: IMCPContentScanner): void {
    this.mcpContentScanner = scanner;
  }

  /**
   * Get the schema service instance.
   * @returns The schema service instance.
   * @throws {Error} If service not initialized.
   */
  public static getInstance(): SchemaService {
    if (!SchemaService.instance || !SchemaService.instance.initialized) {
      throw new Error('SchemaService not initialized. Call initialize() first.');
    }
    return SchemaService.instance;
  }

  /**
   * Scan all modules for database schemas.
   * @param baseDir - Base directory to scan.
   * @returns Promise that resolves when scan is complete.
   */
  public async discoverSchemas(baseDir: string = '/app/src/modules'): Promise<void> {
    try {
      this.logger?.info(LogSource.DATABASE, 'Discovering module schemas', { baseDir });

      const schemaFiles = await glob('**/database/schema.sql', {
        cwd: baseDir,
        absolute: true,
      });

      const initFiles = await glob('**/database/init.sql', {
        cwd: baseDir,
        absolute: true,
      });

      const initFileMap = new Map<string, string>();
      for (const initFile of initFiles) {
        const moduleNameResult = this.extractModuleName(initFile, baseDir);
        initFileMap.set(moduleNameResult, initFile);
      }

      const schemaPromises = schemaFiles.map(async (schemaPath) => {
        const moduleNameResult = this.extractModuleName(schemaPath, baseDir);
        const sql = await readFile(schemaPath, 'utf-8');

        const initPath = initFileMap.get(moduleNameResult);
        const schema: IModuleSchema = {
          module: moduleNameResult,
          moduleName: moduleNameResult,
          schemaPath,
          sql,
        };

        if (initPath !== undefined) {
          schema.initPath = initPath;
          schema.initSql = await readFile(initPath, 'utf-8');
        }

        return {
 moduleNameResult,
schema
};
      });

      const results = await Promise.all(schemaPromises);

      for (const { moduleNameResult, schema } of results) {
        this.schemas.set(moduleNameResult, schema);
        this.logger?.debug(LogSource.DATABASE, 'Discovered schema', {
          module: moduleNameResult,
          schemaPath: schema.schemaPath
        });
      }

      this.logger?.info(LogSource.DATABASE, 'Schema discovery complete', {
        modulesFound: this.schemas.size,
      });
    } catch (error) {
      this.logger?.error(LogSource.DATABASE, 'Schema discovery failed', { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }

  /**
   * Initialize all discovered schemas.
   * @returns Promise that resolves when initialization is complete.
   */
  public async initializeSchemas(): Promise<void> {
    if (!this.importService) {
      throw new Error('Import service not initialized');
    }

    await this.importService.initialize();

    const schemaFiles = [];
    for (const [moduleKey, schema] of Array.from(this.schemas.entries())) {
      schemaFiles.push({
        module: moduleKey,
        filepath: schema.schemaPath,
        checksum: '',
        content: schema.sql
      });

      if (schema.initSql !== undefined && schema.initPath !== undefined) {
        schemaFiles.push({
          module: moduleKey,
          filepath: schema.initPath,
          checksum: '',
          content: schema.initSql
        });
      }
    }

    const result = await this.importService.importSchemas(schemaFiles);

    if (!result.success) {
      this.logger?.error(LogSource.DATABASE, 'Schema import failed', { errors: result.errors });
      const errorMessages = result.errors
        .map((errorItem): string => { return errorItem.error })
        .join('; ');
      throw new Error(`Schema import failed: ${errorMessages}`);
    }

    this.logger?.info(LogSource.DATABASE, 'Schema import complete', {
      imported: result.imported.length,
      skipped: result.skipped.length
    });

    await this.scanMcpContentForAllModules();
  }

  /**
   * Scan MCP content for all modules after schema import.
   */
  private async scanMcpContentForAllModules(): Promise<void> {
    if (this.mcpContentScanner === undefined) {
      return;
    }

    for (const [moduleKey, schema] of Array.from(this.schemas.entries())) {
      try {
        const modulePath = dirname(dirname(schema.schemaPath));
        const moduleName = moduleKey.replace('core/', '');

        this.logger?.debug(LogSource.DATABASE, 'Scanning module for MCP content', {
          module: moduleName,
          modulePath
        });

        await this.mcpContentScanner.scanModule(moduleName, modulePath);
      } catch (error) {
        this.logger?.warn(LogSource.DATABASE, 'Failed to scan MCP content for module', {
          module: moduleKey,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }
  }

  /**
   * Extract module name from file path.
   * @param filePath - File path to extract module from.
   * @param baseDir - Base directory path.
   * @returns Module name.
   */
  private extractModuleName(filePath: string, baseDir: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const normalizedBase = baseDir.replace(/\\/g, '/').replace(/\/$/, '');
    const relativePath = normalized.replace(`${normalizedBase}/`, '');
    const parts = relativePath.split('/');

    const firstPart = parts[ZERO];
    const secondPart = parts[1];

    if (firstPart === 'core' && parts.length > 1 && secondPart !== undefined) {
      return `core/${secondPart}`;
    }

    return firstPart ?? 'unknown';
  }

  /**
   * Get schema for a specific module.
   * @param moduleKey - Module key.
   * @returns Module schema or undefined.
   */
  public getSchema(moduleKey: string): IModuleSchema | undefined {
    return this.schemas.get(moduleKey);
  }

  /**
   * Get all discovered schemas.
   * @returns Map of all schemas.
   */
  public getAllSchemas(): Map<string, IModuleSchema> {
    return new Map(this.schemas);
  }

  /**
   * Get list of installed schemas from database.
   * @returns Array of installed schemas.
   */
  public async getInstalledSchemas(): Promise<IInstalledSchema[]> {
    if (!this.importService) {
      throw new Error('Import service not initialized');
    }

    try {
      const schemas = await this.importService.getImportedSchemas();
      return schemas.map((schema): IInstalledSchema => { return {
        moduleName: schema.module,
        version: '1.0.0',
        installedAt: schema.imported_at
      } });
    } catch (error) {
      this.logger?.debug(LogSource.DATABASE, 'No imported schemas found', { error: error instanceof Error ? error : new Error(String(error)) });
      return [];
    }
  }

  /**
   * Discover schemas and return as array.
   * @param baseDir - Base directory to scan.
   * @returns Array of module schemas.
   */
  public async discoverSchemasArray(baseDir?: string): Promise<IModuleSchema[]> {
    await this.discoverSchemas(baseDir);
    return Array.from(this.schemas.values());
  }

  /**
   * Initialize the base schema tables.
   * @returns Promise that resolves when initialization is complete.
   */
  public async initializeBaseSchema(): Promise<void> {
    if (!this.importService) {
      throw new Error('Import service not initialized');
    }
    await this.importService.initialize();
  }

  /**
   * Install a specific module's schema.
   * @param schema - Module schema to install.
   * @returns Promise that resolves when installation is complete.
   */
  public async installModuleSchema(schema: IModuleSchema): Promise<void> {
    if (!this.importService) {
      throw new Error('Import service not initialized');
    }

    const schemaFiles = [
      {
        module: schema.module,
        filepath: schema.schemaPath,
        checksum: '',
        content: schema.sql
      }
    ];

    if (schema.initSql !== undefined && schema.initPath !== undefined) {
      schemaFiles.push({
        module: schema.module,
        filepath: schema.initPath,
        checksum: '',
        content: schema.initSql
      });
    }

    const result = await this.importService.importSchemas(schemaFiles);

    if (!result.success) {
      const errorMessages = result.errors
        .map((errorItem): string => { return errorItem.error })
        .join('; ');
      throw new Error(`Failed to install module schema: ${errorMessages}`);
    }

    if (this.mcpContentScanner !== undefined) {
      const modulePath = dirname(dirname(schema.schemaPath));
      const moduleName = schema.module.replace('core/', '');
      await this.scanModuleMcpContent(moduleName, modulePath);
    }
  }

  /**
   * Scan a module for MCP content.
   * @param moduleName - Name of the module.
   * @param modulePath - Path to the module directory.
   * @returns Promise that resolves when scan is complete.
   */
  public async scanModuleMcpContent(moduleName: string, modulePath: string): Promise<void> {
    if (this.mcpContentScanner === undefined) {
      this.logger?.warn(LogSource.DATABASE, 'MCP content scanner not available');
      return;
    }

    try {
      await this.mcpContentScanner.scanModule(moduleName, modulePath);
      this.logger?.info(LogSource.DATABASE, 'MCP content scan completed', { module: moduleName });
    } catch (error) {
      this.logger?.error(LogSource.DATABASE, 'Failed to scan MCP content', {
        module: moduleName,
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  /**
   * Remove MCP content for a module (when uninstalling).
   * @param moduleName - Name of the module.
   * @returns Promise that resolves when removal is complete.
   */
  public async removeModuleMcpContent(moduleName: string): Promise<void> {
    if (this.mcpContentScanner === undefined) {
      this.logger?.warn(LogSource.DATABASE, 'MCP content scanner not available');
      return;
    }

    try {
      await this.mcpContentScanner.removeModuleContent(moduleName);
      this.logger?.info(LogSource.DATABASE, 'MCP content removed', { module: moduleName });
    } catch (error) {
      this.logger?.error(LogSource.DATABASE, 'Failed to remove MCP content', {
        module: moduleName,
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }
}
