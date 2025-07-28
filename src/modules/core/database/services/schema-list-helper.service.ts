import { DatabaseService } from '@/modules/core/database/services/database.service';
import { SchemaService } from '@/modules/core/database/services/schema.service';
import { SchemaOperationsHelperService } from '@/modules/core/database/services/schema-operations-helper.service';
import type { IInstalledSchema } from '@/modules/core/database/types/schema.types';

/**
 * Helper service for schema listing and management operations.
 */
export class SchemaListHelperService {
  /**
   * List installed schemas.
   * @returns Schema list result.
   */
  static async listSchemas(): Promise<{
    success: boolean;
    message?: string;
    data?: { schemas: IInstalledSchema[] };
  }> {
    try {
      const db = DatabaseService.getInstance();
      const schema = SchemaService.getInstance();

      const isInitialized = await db.isInitialized();
      if (!isInitialized) {
        return {
          success: true,
          message: 'Database is not initialized. No schemas installed.',
          data: { schemas: [] }
        };
      }

      const schemas = await schema.getInstalledSchemas();
      return {
        success: true,
        data: { schemas }
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Initialize database schemas.
   * @param params - Initialization parameters.
   * @param params.force - Force reinitialize even if already initialized.
   * @param params.module - Specific module to initialize (optional).
   * @returns Initialization result.
   */
  static async initializeSchemas(params: {
    force?: boolean;
    module?: string;
  }): Promise<unknown> {
    try {
      const db = DatabaseService.getInstance();
      const isInitialized = await db.isInitialized();

      if (isInitialized && params.force !== true) {
        return {
          success: false,
          message: 'Database is already initialized. Use --force to reinitialize.'
        };
      }

      const result = await SchemaOperationsHelperService.initializeSchemas(params, isInitialized);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Validate database schemas.
   * @param params - Validation parameters.
   * @param params.module - Specific module to validate (optional).
   * @returns Validation result.
   */
  static async validateSchemas(params: { module?: string }): Promise<unknown> {
    try {
      const db = DatabaseService.getInstance();
      const isInitialized = await db.isInitialized();

      if (!isInitialized) {
        return {
          success: false,
          message: 'Database is not initialized. Nothing to validate.'
        };
      }

      const issues = await SchemaOperationsHelperService.validateSchemas(params);
      return {
        success: true,
        issues
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
