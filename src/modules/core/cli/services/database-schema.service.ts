/**
 * Database schema service for CLI operations.
 * @file Database schema service for CLI operations.
 * @module cli/services/database-schema
 */

import type { IInstalledSchema } from '@/modules/core/database/types/schema.types';

/**
 * Schema list result interface.
 */
export interface ISchemaListResult {
  success: boolean;
  message?: string;
  data?: {
    schemas: IInstalledSchema[];
  };
}

/**
 * Schema initialization parameters.
 */
export interface ISchemaInitParams {
  force?: boolean;
  module?: string;
}

/**
 * Schema initialization result interface.
 */
export interface ISchemaInitResult {
  success: boolean;
  message?: string;
  warnings?: string[];
  results?: Array<{
    module: string;
    success: boolean;
    message?: string;
  }>;
}

/**
 * Schema validation parameters.
 */
export interface ISchemaValidateParams {
  module?: string;
}

/**
 * Schema validation result interface.
 */
export interface ISchemaValidateResult {
  success: boolean;
  message?: string;
  issues?: Array<{
    module: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

/**
 * Database schema service for CLI operations.
 */
export class DatabaseSchemaService {
  private static instance: DatabaseSchemaService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns Service instance.
   */
  public static getInstance(): DatabaseSchemaService {
    DatabaseSchemaService.instance ||= new DatabaseSchemaService();
    return DatabaseSchemaService.instance;
  }

  /**
   * List installed schemas.
   * @returns Schema list result.
   */
  public async listSchemas(): Promise<ISchemaListResult> {
    try {
      const { DatabaseCLIHandlerService } = await import(
        '@/modules/core/database/services/cli-handler.service'
      );
      const cliHandler = DatabaseCLIHandlerService.getInstance();
      return await cliHandler.listSchemas();
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
   * @returns Initialization result.
   */
  public async initializeSchemas(params: ISchemaInitParams): Promise<ISchemaInitResult> {
    try {
      const { DatabaseCLIHandlerService } = await import(
        '@/modules/core/database/services/cli-handler.service'
      );
      const cliHandler = DatabaseCLIHandlerService.getInstance();
      return await cliHandler.initializeSchemas(params);
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
   * @returns Validation result.
   */
  public async validateSchemas(params: ISchemaValidateParams): Promise<ISchemaValidateResult> {
    try {
      const { DatabaseCLIHandlerService } = await import(
        '@/modules/core/database/services/cli-handler.service'
      );
      const cliHandler = DatabaseCLIHandlerService.getInstance();
      return await cliHandler.validateSchemas(params);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
