/**
 * Core database service that manages connections and provides
 * a unified interface for all modules.
 * @file Core database service.
 * @module database/services/database
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * - systemprompt-os/enforce-import-restrictions: The custom rule prevents services
 *   from importing database types, but this file IS the database service itself and
 *   legitimately needs to import database types and adapters. This is an architectural
 *   rule configuration issue that requires updating the ESLint plugin to exclude
 *   the database service from this restriction.
 */

import type {
  IDatabaseAdapter,
  IDatabaseConfig,
  IDatabaseConnection,
  IDatabaseService,
  IPreparedStatement,
  ITransaction
} from '../types/manual';
import { type ILogger, LogSource } from '../../logger/types/manual';
import { SqliteAdapter } from '../adapters/sqlite.adapter';

/**
 * Database service singleton for managing database connections.
 */
export class DatabaseService implements IDatabaseService {
  private static instance: DatabaseService | undefined;
  private config: IDatabaseConfig | null = null;
  private adapter: IDatabaseAdapter | null = null;
  private connection: IDatabaseConnection | null = null;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton pattern implementation.
   */
  private constructor() {
  }

  /**
   * Initialize the database service with configuration.
   * @param config - Database configuration.
   * @param logger - Optional logger instance.
   * @returns The initialized database service instance.
   */
  public static initialize(config: IDatabaseConfig, logger?: ILogger): DatabaseService {
    DatabaseService.instance ??= new DatabaseService();
    DatabaseService.instance.config = config;
    if (logger !== undefined) {
      DatabaseService.instance.logger = logger;
    }
    DatabaseService.instance.initialized = true;
    return DatabaseService.instance;
  }

  /**
   * Get the database service instance.
   * @returns The database service instance.
   * @throws {Error} If service not initialized.
   */
  public static getInstance(): DatabaseService {
    if (DatabaseService.instance === undefined || !DatabaseService.instance.initialized) {
      throw new Error(
        'DatabaseService not initialized. Call initialize() first.'
      );
    }
    return DatabaseService.instance;
  }

  /**
   * Get a database connection, creating one if needed.
   * @returns {Promise<IDatabaseConnection>} The active database connection.
   * @throws {Error} If connection cannot be established.
   */
  public async getConnection(): Promise<IDatabaseConnection> {
    if (this.connection === null || this.adapter === null || !this.adapter.isConnected()) {
      await this.connect();
    }

    if (this.connection === null) {
      throw new Error(
        'Failed to establish database connection'
      );
    }

    return this.connection;
  }

  /**
   * Execute a raw SQL query.
   * @param sql - SQL query string.
   * @param params - Query parameters.
   * @returns Array of result rows.
   */
  public async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const connection = await this.getConnection();
    return await connection.query<T>(sql, params);
  }

  /**
   * Execute a SQL statement without returning results.
   * @param sql - SQL statement.
   * @param params - Statement parameters.
   * @returns Promise that resolves when complete.
   */
  public async execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    const connection = await this.getConnection();
    return await connection.execute(sql, params);
  }

  /**
   * Prepare a SQL statement for repeated execution.
   * @param sql - SQL statement to prepare.
   * @returns Prepared statement.
   */
  public async prepare(sql: string): Promise<IPreparedStatement> {
    const connection = await this.getConnection();
    if (!connection.prepare) {
      throw new Error('Prepared statements not supported by this connection');
    }
    return await connection.prepare(sql);
  }

  /**
   * Execute a callback within a database transaction.
   * @param handler - Function to execute within the transaction.
   * @returns {Promise<T>} The result of the callback function.
   * @throws {Error} If transaction fails or nested transactions attempted.
   * @example
   * ```typescript
   * const result = await dbService.transaction(async (conn) => {
   *   await conn.execute('INSERT INTO users (name) VALUES (?)', ['John']);
   *   const users = await conn.query('SELECT * FROM users');
   *   return users;
   * });
   * ```
   */
  public async transaction<T>(
    handler: (tx: IDatabaseService) => Promise<T>
  ): Promise<T> {
    const connection = await this.getConnection();
    if (!connection.transaction) {
      throw new Error('Transaction not supported by this connection');
    }
    return await connection.transaction(async (tx: ITransaction): Promise<T> => {
      const txService: IDatabaseService = {
        query: async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
          return await tx.query<T>(sql, params);
        },
        execute: async (sql: string, params?: unknown[]) => {
          return await tx.execute(sql, params);
        },
        transaction: async (): Promise<never> => {
          return await Promise.reject(new Error('Nested transactions not supported'));
        },
        isConnected: async (): Promise<boolean> => {
          return true
        },
        isInitialized: async (): Promise<boolean> => {
          return true
        },
        close: async (): Promise<void> => {
          await Promise.resolve()
        }
      };
      return await handler(txService);
    });
  }

  /**
   * Reset the singleton instance for testing purposes.
   * @returns {Promise<void>}
   */
  public static async reset(): Promise<void> {
    if (DatabaseService.instance !== undefined) {
      await DatabaseService.instance.disconnect();
      DatabaseService.instance = undefined;
    }
  }

  /**
   * Instance method to reset the service.
   * @returns {Promise<void>}
   */
  public async reset(): Promise<void> {
    await DatabaseService.reset();
  }


  /**
   * Get the current database type.
   * @returns {'sqlite' | 'postgres'} The configured database type.
   * @throws {Error} If service not initialized.
   */
  public getDatabaseType(): 'sqlite' | 'postgres' {
    if (this.config === null) {
      throw new Error('DatabaseService not initialized. Call initialize() first.');
    }
    return this.config.type;
  }

  /**
   * Check if the database is currently connected.
   * @returns {Promise<boolean>} True if connected, false otherwise.
   */
  public async isConnected(): Promise<boolean> {
    return this.adapter?.isConnected() ?? false;
  }

  /**
   * Check if database is initialized (has any user tables).
   * @returns {Promise<boolean>} True if database has been initialized with tables.
   */
  public async isInitialized(): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      const result = await this.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM sqlite_master 
         WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      );

      return result.length > 0 && result[0] !== undefined && result[0].count > 0;
    } catch (error) {
      this.logger?.debug(LogSource.DATABASE, 'Database not initialized', {
        error: error instanceof Error ? error : new Error(String(error)),
        persistToDb: false
      });
      return false;
    }
  }

  /**
   * Connect to the database based on configuration.
   */
  private async connect(): Promise<void> {
    if (this.config === null) {
      throw new Error('DatabaseService not initialized. Call initialize() first.');
    }

    try {
      switch (this.config.type) {
        case 'sqlite':
          this.adapter = new SqliteAdapter();
          break;
        case 'postgres':
          throw new Error('PostgreSQL adapter not yet implemented');
      }

      this.connection = await this.adapter.connect(this.config);
      this.logger?.info(
        LogSource.DATABASE,
        'Database connection established',
        { type: this.config.type }
      );
    } catch (error) {
      this.logger?.error(
        LogSource.DATABASE,
        'Failed to connect to database',
        { error: error instanceof Error ? error : new Error(String(error)) }
      );
      throw new Error(
        `Failed to connect to ${this.config.type} database`
      );
    }
  }

  /**
   * Close the database connection.
   * @returns {Promise<void>} Promise that resolves when closed.
   */
  public async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }
  }

  /**
   * Disconnect from the database (alias for close).
   * @returns {Promise<void>} Promise that resolves when disconnected.
   */
  public async disconnect(): Promise<void> {
    await this.close();
  }
}
