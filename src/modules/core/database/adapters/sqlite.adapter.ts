/**
 * SQLite adapter implementation
 * Provides database operations using better-sqlite3
 */

import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type {
  DatabaseAdapter,
  DatabaseConfig,
  DatabaseConnection,
  QueryResult,
  PreparedStatement,
  Transaction
} from '../interfaces/database.interface.js';
import { logger } from '@utils/logger.js';

class SQLitePreparedStatement implements PreparedStatement {
  constructor(private stmt: Database.Statement) {}

  async execute(params?: any[]): Promise<QueryResult> {
    const rows = this.stmt.all(...(params || []));
    return {
      rows,
      rowCount: rows.length
    };
  }

  async all<T = any>(params?: any[]): Promise<T[]> {
    return this.stmt.all(...(params || [])) as T[];
  }

  async get<T = any>(params?: any[]): Promise<T | undefined> {
    return this.stmt.get(...(params || [])) as T | undefined;
  }

  async run(params?: any[]): Promise<{ changes: number; lastInsertRowid: number | string }> {
    const result = this.stmt.run(...(params || []));
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid as number
    };
  }

  async finalize(): Promise<void> {
    // SQLite statements don't need explicit finalization in better-sqlite3
  }
}

class SQLiteTransaction implements Transaction {
  constructor(private db: Database.Database) {}

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...(params || []));
    return {
      rows: rows as T[],
      rowCount: rows.length
    };
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
    } else {
      this.db.exec(sql);
    }
  }

  async prepare(sql: string): Promise<PreparedStatement> {
    return new SQLitePreparedStatement(this.db.prepare(sql));
  }

  async commit(): Promise<void> {
    this.db.exec('COMMIT');
  }

  async rollback(): Promise<void> {
    this.db.exec('ROLLBACK');
  }
}

class SQLiteConnection implements DatabaseConnection {
  constructor(private db: Database.Database) {}

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...(params || []));
    return {
      rows: rows as T[],
      rowCount: rows.length
    };
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
    } else {
      this.db.exec(sql);
    }
  }

  async prepare(sql: string): Promise<PreparedStatement> {
    return new SQLitePreparedStatement(this.db.prepare(sql));
  }

  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    const tx = new SQLiteTransaction(this.db);
    
    try {
      const result = await callback(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database | null = null;

  async connect(config: DatabaseConfig): Promise<DatabaseConnection> {
    if (!config.sqlite) {
      throw new Error('SQLite configuration is required');
    }

    const { filename, mode = 'wal' } = config.sqlite;

    try {
      // Ensure directory exists
      await mkdir(dirname(filename), { recursive: true });

      // Open database
      this.db = new Database(filename);
      
      // Configure SQLite for better concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('busy_timeout = 5000');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('temp_store = MEMORY');
      
      logger.info('SQLite database connected', { filename, mode });
      
      return new SQLiteConnection(this.db);
    } catch (error) {
      logger.error('Failed to connect to SQLite database', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('SQLite database disconnected');
    }
  }

  isConnected(): boolean {
    return this.db !== null && this.db.open;
  }
}