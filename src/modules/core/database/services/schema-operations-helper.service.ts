import { SchemaService } from '@/modules/core/database/services/schema.service';
import type { ISchemaModule, ISchemaVersion } from '@/modules/core/database/types/manual';

/**
 * Helper service for schema operations.
 */
export class SchemaOperationsHelperService {
  /**
   * Initialize database schemas.
   * @param params - Initialization parameters.
   * @param params.force - Force reinitialize even if already initialized.
   * @param params.module - Specific module to initialize (optional).
   * @param isInitialized - Whether database is already initialized.
   * @returns Initialization result.
   */
  static async initializeSchemas(params: {
    force?: boolean;
    module?: string;
  }, isInitialized: boolean): Promise<{
    warnings: string[];
    results: Array<{
      module: string;
      success: boolean;
      message?: string;
    }>;
  }> {
    const schemaService = SchemaService.getInstance();
    const warnings: string[] = [];
    const results: Array<{
      module: string;
      success: boolean;
      message?: string;
    }> = [];

    if (isInitialized && params.force === true) {
      warnings.push('WARNING: Force initializing will reset the database!');
      warnings.push('This action cannot be undone.');
    }

    await schemaService.initializeBaseSchema();
    results.push({
      module: 'base',
      success: true,
      message: 'Base schema initialized'
    });

    if (params.module === undefined) {
      const discoveredSchemas = await schemaService.discoverSchemasArray();

      for (const schema of discoveredSchemas) {
        try {
          await schemaService.installModuleSchema(schema);
          results.push({
            module: schema.moduleName ?? schema.module,
            success: true,
            message: 'Success'
          });
        } catch (error) {
          results.push({
            module: schema.moduleName ?? schema.module,
            success: false,
            message: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } else {
      const discoveredSchemas = await schemaService.discoverSchemasArray();
      const moduleSchema = discoveredSchemas.find(
        (schema: IModuleSchema): boolean => {
          return (schema.moduleName ?? schema.module) === params.module;
        }
      );

      if (moduleSchema === undefined) {
        throw new Error(`Module '${params.module}' not found or has no schema.`);
      }

      await schemaService.installModuleSchema(moduleSchema);
      results.push({
        module: params.module,
        success: true,
        message: `Schema for ${params.module} initialized`
      });
    }

    return {
      warnings,
      results
    };
  }

  /**
   * Validate database schemas.
   * @param params - Validation parameters.
   * @param params.module - Specific module to validate (optional).
   * @returns Validation issues.
   */
  static async validateSchemas(params: {
    module?: string;
  }): Promise<Array<{
    module: string;
    message: string;
    severity: 'error' | 'warning';
  }>> {
    const schemaService = SchemaService.getInstance();
    const issues: Array<{
      module: string;
      message: string;
      severity: 'error' | 'warning';
    }> = [];

    const [installedSchemas, discoveredSchemas] = await Promise.all([
      schemaService.getInstalledSchemas(),
      schemaService.discoverSchemasArray()
    ]);

    if (params.module === undefined) {
      for (const discoveredSchema of discoveredSchemas) {
        const installedSchema = installedSchemas.find(
          (schema: IInstalledSchema): boolean => {
            return schema.moduleName === (discoveredSchema.moduleName ?? discoveredSchema.module);
          }
        );

        if (installedSchema === undefined) {
          issues.push({
            module: discoveredSchema.moduleName ?? discoveredSchema.module,
            message: 'Schema is not installed',
            severity: 'error'
          });
        }
      }

      for (const installedSchema of installedSchemas) {
        const discoveredSchema = discoveredSchemas.find(
          (schema: IModuleSchema): boolean => {
            return (schema.moduleName ?? schema.module) === installedSchema.moduleName;
          }
        );

        if (discoveredSchema === undefined) {
          issues.push({
            module: installedSchema.moduleName,
            message: 'Installed schema has no corresponding module',
            severity: 'warning'
          });
        }
      }
    } else {
      const installedSchema = installedSchemas.find(
        (schema: IInstalledSchema): boolean => { return schema.moduleName === params.module }
      );

      if (installedSchema === undefined) {
        issues.push({
          module: params.module,
          message: 'Schema is not installed',
          severity: 'error'
        });
      }
    }

    return issues;
  }
}
