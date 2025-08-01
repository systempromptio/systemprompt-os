/**
 * Repository for config-related database operations.
 * @file Config Repository for database operations.
 * @module modules/core/config/repositories/config
 */

import { randomUUID } from 'crypto';
import type { IConfigRow, ConfigType } from '../types/database.generated';
import type { IConfigCreateData } from '../types/config.module.generated';
import { DatabaseService } from '../../database/services/database.service';
import type { IDatabaseConnection } from '../../database/types/manual';

export class ConfigRepository {
  private static instance: ConfigRepository;
  private dbService?: DatabaseService;

  private constructor() {}

  static getInstance(): ConfigRepository {
    ConfigRepository.instance ||= new ConfigRepository();
    return ConfigRepository.instance;
  }

  async initialize(): Promise<void> {
    this.dbService = DatabaseService.getInstance();
  }

  private async getDatabase(): Promise<IDatabaseConnection> {
    if (!this.dbService) {
      throw new Error('Repository not initialized');
    }
    return await this.dbService.getConnection();
  }

  async setConfig(configData: IConfigCreateData): Promise<IConfigRow> {
    const database = await this.getDatabase();
    
    // Check if config exists for upsert
    const existing = await this.getConfig(configData.key);
    
    if (existing) {
      // Update existing config
      const stmt = await database.prepare(
        `UPDATE config SET 
          value = ?, 
          type = ?, 
          description = ?,
          updated_at = ?
        WHERE key = ?`
      );

      await stmt.run([
        configData.value,
        configData.type || 'string',
        configData.description || null,
        new Date().toISOString(),
        configData.key
      ]);

      await stmt.finalize();
      
      // Return updated record
      const updated = await this.getConfig(configData.key);
      if (!updated) {
        throw new Error(`Config not found after update: ${configData.key}`);
      }
      return updated;
    } else {
      // Generate fields that should be auto-created
      const id = randomUUID();
      const timestamp = new Date().toISOString();
      
      // Insert new config
      const stmt = await database.prepare(
        `INSERT INTO config (
          id, key, value, type, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      await stmt.run([
        id,
        configData.key,
        configData.value,
        configData.type,
        configData.description || null,
        timestamp,
        timestamp
      ]);

      await stmt.finalize();
      
      // Return auto-generated database row type
      return {
        id,
        key: configData.key,
        value: configData.value,
        type: configData.type,
        description: configData.description || null,
        created_at: timestamp,
        updated_at: timestamp
      };
    }
  }

  async getConfig(key: string): Promise<IConfigRow | null> {
    const database = await this.getDatabase();
    const result = await database.query<IConfigRow>(
      'SELECT * FROM config WHERE key = ?',
      [key]
    );
    return result.rows[0] || null;
  }

  async listConfigs(prefix?: string): Promise<IConfigRow[]> {
    const database = await this.getDatabase();
    
    let query = 'SELECT * FROM config';
    const params: string[] = [];
    
    if (prefix) {
      query += ' WHERE key LIKE ?';
      params.push(`${prefix}%`);
    }
    
    query += ' ORDER BY key ASC';
    
    const result = await database.query<IConfigRow>(query, params);
    return result.rows;
  }

  async findById(id: string): Promise<IConfigRow | null> {
    const database = await this.getDatabase();
    const result = await database.query<IConfigRow>(
      'SELECT * FROM config WHERE id = ?',
      [id]
    );
    return result.rows[0] || null;
  }

  async updateConfig(key: string, data: Partial<IConfigRow>): Promise<IConfigRow> {
    const database = await this.getDatabase();
    
    const updates = [];
    const values = [];

    // Use exact column names from auto-generated schema
    if (data.value !== undefined) {
      updates.push('value = ?');
      values.push(data.value);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');  
      values.push(data.type);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');  
      values.push(data.description);
    }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(key);

    const stmt = await database.prepare(
      `UPDATE config SET ${updates.join(', ')} WHERE key = ?`
    );
    await stmt.run(values);
    await stmt.finalize();
    
    const config = await this.getConfig(key);
    if (!config) {
      throw new Error(`Config not found after update: ${key}`);
    }
    return config;
  }

  async deleteConfig(key: string): Promise<void> {
    const database = await this.getDatabase();
    const stmt = await database.prepare('DELETE FROM config WHERE key = ?');
    await stmt.run([key]);
    await stmt.finalize();
  }

  async deleteById(id: string): Promise<void> {
    const database = await this.getDatabase();
    const stmt = await database.prepare('DELETE FROM config WHERE id = ?');
    await stmt.run([id]);
    await stmt.finalize();
  }
}