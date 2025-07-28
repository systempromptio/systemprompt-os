import { SchemaService } from '@/modules/core/database/services/schema.service';

/**
 * Helper service for database initialization.
 */
export class InitHelperService {
  /**
   * Handle database initialization.
   * @returns Initialization result.
   */
  static async handleInit(): Promise<{ success: boolean; message: string }> {
    try {
      const schemaService = SchemaService.getInstance();
      await schemaService.initializeBaseSchema();
      await schemaService.initializeSchemas();

      return {
        success: true,
        message: 'Database initialized successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Initialization failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      };
    }
  }
}
