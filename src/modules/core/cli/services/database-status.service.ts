/**
 * Database status service for CLI commands.
 * This service provides database status functionality without direct database imports.
 * @file Database status service for CLI commands.
 * @module modules/core/cli/services/database-status
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Status parameters interface.
 */
export interface IStatusParams {
  format?: 'text' | 'json';
  detailed?: boolean;
}

/**
 * Database status result interface.
 */
export interface IStatusResult {
  success: boolean;
  message?: string;
  data?: {
    connected: boolean;
    initialized: boolean;
    type: string;
    timestamp: string;
    tableCount?: number;
    tables?: string[];
    schemaVersions?: Array<{
      module: string;
      version: string;
    }>;
    error?: string;
  };
}

/**
 * Database status service for CLI operations.
 */
export class DatabaseStatusService {
  private static instance: DatabaseStatusService;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {}

  /**
   * Get the singleton instance of DatabaseStatusService.
   * @returns The DatabaseStatusService instance.
   */
  public static getInstance(): DatabaseStatusService {
    DatabaseStatusService.instance ||= new DatabaseStatusService();
    return DatabaseStatusService.instance;
  }

  /**
   * Get database status information.
   * @param params - Status parameters.
   * @returns Database status result.
   */
  public async getStatus(params: IStatusParams): Promise<IStatusResult> {
    try {
      const dbService = DatabaseService.getInstance();

      const connected = dbService.isConnected();
      const initialized = await dbService.isInitialized();
      const type = dbService.getDatabaseType();
      const timestamp = new Date().toISOString();

      const baseStatus = {
        connected,
        initialized,
        type,
        timestamp,
      };

      let detailedInfo = {};
      if (params.detailed === true && connected) {
        try {
          const tables = await dbService.query<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
          );
          const schemaVersions = await dbService.query<{ module: string; version: string }>(
            "SELECT module, version FROM _schema_versions ORDER BY module"
          );

          detailedInfo = {
            tableCount: tables.length,
            tables: tables.map((table): string => table.name),
            schemaVersions,
          };
        } catch (_error) {
          detailedInfo = { error: 'Failed to retrieve detailed information' };
        }
      }

      const data = params.detailed === true ? {
        ...baseStatus,
        ...detailedInfo
      } : baseStatus;

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting database status: ${String(error)}`,
      };
    }
  }
}
