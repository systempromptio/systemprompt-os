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
import {
  BUSY_TIMEOUT_MS,
  CACHE_SIZE_PAGES,
} from '@/modules/core/database/constants/index';
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
      await mkdir(dirname(filename), { recursive: true });

      this.db = new (BetterSqlite3 as any)(filename);

      this.db!.pragma('journal_mode = WAL');
      this.db!.pragma(`busy_timeout = ${String(BUSY_TIMEOUT_MS)}`);
      this.db!.pragma('synchronous = NORMAL');
      this.db!.pragma(`cache_size = ${String(CACHE_SIZE_PAGES)}`);
      this.db!.pragma('foreign_keys = ON');
      this.db!.pragma('temp_store = MEMORY');

      return new SqliteConnection(this.db!);
    } catch (error) {
      const errorAsError = error as Error;
      throw new ConnectionError(
        `Failed to connect to SQLite database at ${filename}`,
        {
          type: 'sqlite',
          host: filename
        },
        errorAsError,
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
  }

  /**
   * Check if the database is connected.
   * @returns True if connected, false otherwise.
   */
  public isConnected(): boolean {
    return this.db !== null && this.db.open;
  }
}
