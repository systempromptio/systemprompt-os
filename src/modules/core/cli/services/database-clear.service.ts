import { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Parameters for the clear operation.
 */
export interface IClearParams {
  force: boolean;
  confirm: boolean;
}

/**
 * Result of a clear operation.
 */
export interface IClearResult {
  success: boolean;
  message: string;
}

/**
 * Database Clear Service - Handles safe clearing of database tables.
 * Provides confirmation mechanisms and preserves schema structure while
 * removing all data from tables.
 */
export class DatabaseClearService {
  private static instance: DatabaseClearService;

  /**
   * Get singleton instance.
   * @returns DatabaseClearService instance.
   */
  public static getInstance(): DatabaseClearService {
    DatabaseClearService.instance ||= new DatabaseClearService();
    return DatabaseClearService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    // Private constructor
  }

  /**
   * Handle database clear operation.
   * @param params - Clear parameters containing force and confirm flags.
   * @returns Promise resolving to clear result.
   */
  public async handleClear(params: IClearParams): Promise<IClearResult> {
    try {
      // Validate parameters
      if (!params.force && !params.confirm) {
        return {
          success: false,
          message: 'Clear operation requires either --force or --confirm flag for safety.'
        };
      }

      const dbService = DatabaseService.getInstance();
      const isInitialized = await dbService.isInitialized();
      
      if (!isInitialized) {
        return {
          success: false,
          message: 'Database is not initialized. Nothing to clear.'
        };
      }

      if (params.force || params.confirm) {
        await this.clearAllTables(dbService);
        return {
          success: true,
          message: 'Database cleared successfully. All table data has been removed while preserving schema structure.'
        };
      }

      return {
        success: false,
        message: 'Clear operation cancelled.'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Failed to clear database: ${errorMessage}`
      };
    }
  }

  /**
   * Clear all tables while preserving schema structure.
   * @param dbService - Database service instance.
   */
  private async clearAllTables(dbService: DatabaseService): Promise<void> {
    // Get all table names except sqlite_* system tables
    const tables = await dbService.query<{ name: string }>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    if (tables.length === 0) {
      return;
    }

    await dbService.transaction(async (conn) => {
      // Disable foreign key constraints temporarily
      await conn.execute('PRAGMA foreign_keys = OFF');

      // Clear all tables
      for (const table of tables) {
        await conn.execute(`DELETE FROM ${table.name}`);
      }

      // Also clear the schema import tracking table specifically
      await conn.execute('DELETE FROM _imported_schemas');

      // Re-enable foreign key constraints
      await conn.execute('PRAGMA foreign_keys = ON');
    });
  }
}
