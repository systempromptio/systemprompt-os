/**
 * CLI Handler Service for database commands.
 * Provides service methods that can be called by CLI without direct imports.
 * @file CLI handler service.
 * @module database/services/cli-handler
 */

import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { MigrationService } from '@/modules/core/database/services/migration.service.js';
import { SchemaService } from '@/modules/core/database/services/schema.service.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';

/**
 * CLI handler service for database commands.
 */
export class DatabaseCLIHandlerService {
  private static instance: DatabaseCLIHandlerService;

  /**
   * Private constructor.
   */
  private constructor() {}

  /**
   * Get the CLI handler service instance.
   * @param logger - Optional logger instance.
   * @returns The CLI handler service instance.
   */
  public static getInstance(logger?: ILogger): DatabaseCLIHandlerService {
    DatabaseCLIHandlerService.instance ||= new DatabaseCLIHandlerService();
    if (logger !== undefined) {
    }
    return DatabaseCLIHandlerService.instance;
  }

  /**
   * Handle status command.
   * @returns Status information.
   */
  public async handleStatus(): Promise<{ connected: boolean; type: string; message: string }> {
    try {
      const db = DatabaseService.getInstance();
      const isConnected = await db.isConnected();
      const dbType = db.getDatabaseType();

      return {
        connected: isConnected,
        type: dbType,
        message: isConnected
          ? `Connected to ${dbType} database`
          : 'Database not connected'
      };
    } catch (error) {
      return {
        connected: false,
        type: 'unknown',
        message: `Error checking status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle migrate command.
   * @returns Migration result.
   */
  public async handleMigrate(): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      const migrationService = MigrationService.getInstance();
      await migrationService.runMigrations();

      return {
        success: true,
        message: 'Migrations completed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }

  /**
   * Handle init command.
   * @returns Initialization result.
   */
  public async handleInit(): Promise<{ success: boolean; message: string }> {
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
        message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
