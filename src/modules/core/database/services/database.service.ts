/**
 * Core database service that manages connections and provides
 * a unified interface for all modules
 */

import type { 
  DatabaseAdapter, 
  DatabaseConfig, 
  DatabaseConnection 
} from '../interfaces/database.interface.js';
import { SQLiteAdapter } from '../adapters/sqlite.adapter.js';
import { logger } from '@utils/logger.js';

export class DatabaseService {
  private static instance: DatabaseService;
  private adapter: DatabaseAdapter | null = null;
  private connection: DatabaseConnection | null = null;
  private config: DatabaseConfig;

  private constructor(config: DatabaseConfig) {
    this.config = config;
  }

  static initialize(config: DatabaseConfig): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(config);
    }
    return DatabaseService.instance;
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      throw new Error('DatabaseService not initialized. Call initialize() first.');
    }
    return DatabaseService.instance;
  }

  /**
   * Get a database connection, creating one if needed
   */
  async getConnection(): Promise<DatabaseConnection> {
    if (!this.connection || !this.adapter?.isConnected()) {
      await this.connect();
    }
    
    if (!this.connection) {
      throw new Error('Failed to establish database connection');
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
      logger.info('Database connection established', { type: this.config.type });
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  /**
   * Execute a raw SQL query
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const conn = await this.getConnection();
    const result = await conn.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Execute a SQL statement without returning results
   */
  async execute(sql: string, params?: any[]): Promise<void> {
    const conn = await this.getConnection();
    await conn.execute(sql, params);
  }

  /**
   * Run a transaction
   */
  async transaction<T>(
    callback: (conn: DatabaseConnection) => Promise<T>
  ): Promise<T> {
    const conn = await this.getConnection();
    return conn.transaction(async (tx) => {
      // Create a pseudo-connection that uses the transaction
      const txConn: DatabaseConnection = {
        query: tx.query.bind(tx),
        execute: tx.execute.bind(tx),
        prepare: tx.prepare.bind(tx),
        transaction: () => {
          throw new Error('Nested transactions not supported');
        },
        close: async () => {
          // No-op for transaction
        }
      };
      return callback(txConn);
    });
  }

  /**
   * Close the database connection
   */
  async disconnect(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
      this.connection = null;
    }
  }

  /**
   * Get current database type
   */
  getDatabaseType(): 'sqlite' | 'postgres' {
    return this.config.type;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.adapter?.isConnected() ?? false;
  }

  /**
   * Check if database is initialized with base schema
   */
  async isInitialized(): Promise<boolean> {
    try {
      // Check if we can connect
      if (!this.isConnected()) {
        await this.connect();
      }

      // Check for existence of system tables
      const result = await this.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM sqlite_master 
         WHERE type='table' AND name='_schema_versions'`
      );

      return result.length > 0 && result[0].count > 0;
    } catch (error) {
      logger.debug('Database not initialized', { error });
      return false;
    }
  }
}