/**
 * Base repository class for permissions module
 */

import { DatabaseService } from '../../database/services/database.service.js';
import type { Logger } from '../../../types.js';
import { randomBytes } from 'crypto';

export abstract class BaseRepository {
  protected db: DatabaseService;
  
  constructor(protected logger: Logger) {
    this.db = DatabaseService.getInstance();
  }
  
  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return randomBytes(16).toString('hex');
  }
  
  /**
   * Execute a query and return rows
   */
  protected async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      return await this.db.query<T>(sql, params);
    } catch (error) {
      this.logger.error('Database query error', { sql, params, error });
      throw error;
    }
  }
  
  /**
   * Execute a query and return first row
   */
  protected async get<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results[0] || null;
  }
  
  /**
   * Execute a statement without returning results
   */
  protected async run(sql: string, params?: any[]): Promise<void> {
    try {
      await this.db.execute(sql, params);
    } catch (error) {
      this.logger.error('Database execute error', { sql, params, error });
      throw error;
    }
  }
  
  /**
   * Run a transaction
   */
  protected async transaction<T>(
    callback: () => Promise<T>
  ): Promise<T> {
    return await this.db.transaction(async () => {
      return await callback();
    });
  }
}