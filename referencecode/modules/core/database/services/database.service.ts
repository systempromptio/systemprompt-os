/**
 * Core database service that manages connections and provides
 * a unified interface for all modules
 */

import type { 
  DatabaseAdapter, 
  DatabaseConfig, 
  DatabaseConnection 
} from '@/modules/core/database/types/index.js';
import { SQLiteAdapter } from '@/modules/core/database/adapters/sqlite.adapter.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { ConnectionError, DatabaseError, TransactionError } from '@/modules/core/database/utils/errors.js';

/**
 * Database service singleton for managing database connections
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private adapter: DatabaseAdapter | null = null;
  private connection: DatabaseConnection | null = null;
  private readonly config: DatabaseConfig;
  private logger?: ILogger;
  private initialized = false;

  private constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Initialize the database service with configuration
   * @param config Database configuration
   * @param logger Optional logger instance
   */
  static initialize(config: DatabaseConfig, logger?: ILogger): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(config);
    }
    DatabaseService.instance.logger = logger;
    DatabaseService.instance.initialized = true;
    return DatabaseService.instance;
  }

  /**
   * Get the database service instance
   * @throws {DatabaseError} If service not initialized
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance?.initialized) {
      throw new DatabaseError(
        'DatabaseService not initialized. Call initialize() first.',
        'SERVICE_NOT_INITIALIZED'
      );
    }
    return DatabaseService.instance;
  }

  /**
   * Get a database connection, creating one if needed
   * @returns {Promise<DatabaseConnection>} The active database connection
   * @throws {ConnectionError} If connection cannot be established
   */
  async getConnection(): Promise<DatabaseConnection> {
    if (!this.connection || !this.adapter?.isConnected()) {
      await this.connect();
    }
    
    if (!this.connection) {
      throw new ConnectionError(
        'Failed to establish database connection',
        { type: this.config.type }
      );
    }
    
    return this.connection;
  }

  /**
   * Connect to the database based on configuration
   */
  private async connect(): Promise<void> {
    try {
      // Create appropriate adapter based on config
      switch (this.config.type) {
        case 'sqlite':
          this.adapter = new SQLiteAdapter();
          break;
        case 'postgres':
          // TODO: Implement PostgreSQL adapter
          throw new Error('PostgreSQL adapter not yet implemented');
        default:
          throw new Error(`Unsupported database type: ${this.config.type}`);
      }

      this.connection = await this.adapter.connect(this.config);
      this.logger?.info('Database connection established', { type: this.config.type });
    } catch (error) {
      this.logger?.error('Failed to connect to database', { error });
      throw new ConnectionError(
        `Failed to connect to ${this.config.type} database`,
        { type: this.config.type },
        error as Error
      );
    }
  }

  /**
   * Execute a raw SQL query
   * @param sql SQL query string
   * @param params Query parameters
   * @returns Array of result rows
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const _conn = await this.getConnection();
    const _result = await _conn.query<T>(sql, params);
    return _result.rows;
  }

  /**
   * Execute a SQL statement without returning results
   * @param sql SQL statement
   * @param params Statement parameters
   */
  async execute(sql: string, params?: unknown[]): Promise<void> {
    const _conn = await this.getConnection();
    await _conn.execute(sql, params);
  }

  /**
   * Execute a callback within a database transaction
   * @param callback Function to execute within the transaction
   * @returns {Promise<T>} The result of the callback function
   * @throws {TransactionError} If transaction fails or nested transactions attempted
   * @example
   * ```typescript
        {
   * const result = await dbService.transaction(async (conn) => {
        }
   *   await conn.execute('INSERT INTO users (name) VALUES (?)', ['John']);
        {
   *   const users = await conn.query('SELECT * FROM users');
        }
   *   return users;
   * });
   * ```
   */
  async transaction<T>(
    callback: (conn: DatabaseConnection) => Promise<T>
  ): Promise<T> {
    const _conn = await this.getConnection();
    return _conn.transaction(async (tx) => {
      // Create a pseudo-connection that uses the transaction
      const txConn: DatabaseConnection = {
        query: tx.query.bind(tx),
        execute: tx.execute.bind(tx),
        prepare: tx.prepare.bind(tx),
        transaction: () => {
          throw new TransactionError('Nested transactions not supported', 'begin');
        },
        close: async () => {
          // No-op for transaction
        }
      };
      return callback(txConn);
    });
  }

  /**
   * Disconnect from the database and cleanup resources
   * @returns {Promise<void>}
   */
  async disconnect(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
      this.connection = null;
    }
  }

  /**
   * Get the current database type
   * @returns {'sqlite' | 'postgres'} The configured database type
   */
  getDatabaseType(): 'sqlite' | 'postgres' {
    return this.config.type;
  }

  /**
   * Check if the database is currently connected
   * @returns {boolean} True if connected, false otherwise
   */
  async isConnected(): Promise<boolean> {
    return this.adapter?.isConnected() ?? false;
  }

  /**
   * Check if database is initialized with base schema
   * @returns {Promise<boolean>} True if database has been initialized with schema
   */
  async isInitialized(): Promise<boolean> {
    try {
      // Check if we can connect
      if (!(await this.isConnected())) {
        await this.connect();
      }

      // Check for existence of system tables
      const result = await this.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM sqlite_master 
         WHERE type='table' AND name='_schema_versions'`
      );

      return result && result.length > 0 && result[0].count > 0;
    } catch (error) {
      this.logger?.debug('Database not initialized', { error });
      return false;
    }
  }
}