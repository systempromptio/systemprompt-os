/**
 * @fileoverview Module-specific database adapter for SystemPrompt OS modules
 * @module database/adapters/module-adapter
 */

import type { Database } from 'better-sqlite3';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { ModuleDatabaseError } from '@/modules/core/database/utils/errors.js';

/**
 * Database row type returned from queries
 */
export interface DatabaseRow {
  [column: string]: unknown;
}

/**
 * Result type for database queries
 */
export interface ModuleQueryResult<T = DatabaseRow> {
  rows: T[];
  rowCount: number;
}

/**
 * Result type for database mutations
 */
export interface MutationResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Prepared statement interface for modules
 */
export interface ModulePreparedStatement<T = DatabaseRow> {
  all(...params: unknown[]): T[];
  get(...params: unknown[]): T | undefined;
  run(...params: unknown[]): MutationResult;
}

/**
 * Transaction interface for module database operations
 */
export interface ModuleTransaction {
  prepare<T = DatabaseRow>(sql: string): ModulePreparedStatement<T>;
  exec(sql: string): void;
  rollback(): void;
}

/**
 * Module database adapter interface
 */
export interface ModuleDatabaseAdapter {
  prepare<T = DatabaseRow>(sql: string): ModulePreparedStatement<T>;
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;
  query<T = DatabaseRow>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}

/**
 * Adapter for SQLite database connections
 * Provides a consistent interface for modules to interact with the database
 */
export class SQLiteModuleAdapter implements ModuleDatabaseAdapter {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Prepares a SQL statement for execution
   * @param sql - The SQL statement to prepare
   * @returns A prepared statement object
   */
  prepare<T = DatabaseRow>(sql: string): ModulePreparedStatement<T> {
    const stmt = this.db.prepare(sql);

    return {
      all: (...params: unknown[]): T[] => stmt.all(...params) as T[],
      get: (...params: unknown[]): T | undefined => stmt.get(...params) as T | undefined,
      run: (...params: unknown[]): MutationResult => {
        const result = stmt.run(...params);
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        };
      },
    };
  }

  /**
   * Executes a SQL script
   * @param sql - The SQL script to execute
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Executes a function within a database transaction
   * @param fn - The function to execute
   * @returns The result of the function
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Execute a query and return results
   */
  async query<T = DatabaseRow>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params || [])) as T[];
  }

  /**
   * Execute a statement without returning results
   */
  async execute(sql: string, params?: unknown[]): Promise<void> {
    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
    } else {
      this.db.exec(sql);
    }
  }
}

/**
 * Creates a module database adapter from the database service
 * @returns A module database adapter instance
 * @throws Error if the database is not SQLite or adapter is not available
 */
export async function createModuleAdapter(moduleName: string): Promise<ModuleDatabaseAdapter> {
  const dbService = DatabaseService.getInstance();

  // Get the connection to ensure database is connected
  await dbService.getConnection();

  // For now, we only support SQLite
  if (dbService.getDatabaseType() !== 'sqlite') {
    throw new ModuleDatabaseError(
      'Module adapter currently only supports SQLite database',
      moduleName,
      'createAdapter',
    );
  }

  // Access the internal SQLite database instance
  // This is a temporary solution until we have a proper abstraction
  const adapter = (dbService as any).adapter;
  const db = adapter?.db;

  if (!db) {
    throw new ModuleDatabaseError(
      'SQLite database instance not available',
      moduleName,
      'createAdapter',
    );
  }

  return new SQLiteModuleAdapter(db);
}