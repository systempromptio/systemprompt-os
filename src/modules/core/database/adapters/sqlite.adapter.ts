/**
 * SQLite adapter implementation.
 * Provides database operations using better-sqlite3.
 * @file SQLite adapter implementation.
 * @module database/adapters/sqlite.adapter
 */

import BetterSqlite3 from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type {
  IDatabaseAdapter,
  IDatabaseConfig,
  IDatabaseConnection,
} from '@/modules/core/database/types/database.types';
import { ConnectionError } from '@/modules/core/database/errors/connection.error';
import { SqliteConnection } from '@/modules/core/database/adapters/sqlite-connection.adapter';

/**
 * SQLite database adapter.
 */
export class SqliteAdapter implements IDatabaseAdapter {
  private db: BetterSqlite3.Database | null = null;

  /**
   * Connect to a SQLite database.
   * @param config - Database configuration.
   * @returns Database connection instance.
   */
  public async connect(config: IDatabaseConfig): Promise<IDatabaseConnection> {
    if (config.sqlite === undefined) {
      throw new ConnectionError('SQLite configuration is required', { type: 'sqlite' });
    }

    const { filename } = config.sqlite;

    try {
      await this.createDatabase(filename);
      if (this.db === null) {
        throw new Error('Database connection failed');
      }
      return new SqliteConnection(this.db);
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error('Unknown error');
      throw new ConnectionError(
        `Failed to connect to SQLite database at ${filename}`,
        {
          type: 'sqlite',
          host: filename
        },
        errorMessage,
      );
    }
  }

  /**
   * Disconnect from the database.
   * @returns Promise that resolves when disconnected.
   */
  public async disconnect(): Promise<void> {
    if (this.db !== null) {
      this.db.close();
      this.db = null;
    }
    await Promise.resolve();
  }

  /**
   * Check if the database is connected.
   * @returns True if connected, false otherwise.
   */
  public isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  /**
   * Create and configure the database instance.
   * @param filename - Database file path.
   */
  private async createDatabase(filename: string): Promise<void> {
    await mkdir(dirname(filename), { recursive: true });
    this.db = new BetterSqlite3(filename);
    this.configureDatabase();
  }

  /**
   * Configure database pragmas.
   */
  private configureDatabase(): void {
    if (this.db !== null) {
      this.db.pragma('journal_mode = WAL');
      this.db.pragma(`busy_timeout = ${String(5000)}`);
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma(`cache_size = ${String(-64000)}`);
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('temp_store = MEMORY');
    }
  }
}
