import { Container } from 'typedi';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';
/**
 * Config Database Service
 * Uses the core database module's auto-discovery system
 */

import { getDatabase } from '@/modules/core/database/index.js';
import type {
  ConfigSetting,
  ConfigProvider,
  CreateConfigInput,
  CreateProviderInput,
  UpdateConfigInput,
  UpdateProviderInput,
  ConfigQuery,
  ProviderQuery,
  ConfigValue,
} from '../database/models/index.js';

export class ConfigDatabaseService {
  private static instance: ConfigDatabaseService;
  private readonly db = getDatabase();
  private readonly logger: ILogger;

  private constructor() {
    // Get logger from container when available
    try {
      this.logger = Container.get(TYPES.Logger);
    } catch {
      // Fallback to console if logger not available
      this.logger = {
        debug: console.debug,
        info: console.info,
        warn: console.warn,
        error: console.error,
      } as ILogger;
    }
  }

  static getInstance(): ConfigDatabaseService {
    if (!ConfigDatabaseService.instance) {
      ConfigDatabaseService.instance = new ConfigDatabaseService();
    }
    return ConfigDatabaseService.instance;
  }

  // Config settings operations
  async createConfig(input: CreateConfigInput): Promise<ConfigSetting> {
    const query = `
      INSERT INTO config_settings (key, value, type, description, encrypted)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `;

    const results = await this.db.query<ConfigSetting>(query, [
      input.key,
      input.value,
      input.type || 'string',
      input.description || null,
      input.encrypted || false,
    ]);

    if (!results[0]) {
      throw new Error('Failed to create config setting');
    }
    return results[0];
  }

  async updateConfig(key: string, input: UpdateConfigInput): Promise<ConfigSetting | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (input.value !== undefined) {
      fields.push('value = ?');
      values.push(input.value);
    }
    if (input.type !== undefined) {
      fields.push('type = ?');
      values.push(input.type);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      values.push(input.description);
    }
    if (input.encrypted !== undefined) {
      fields.push('encrypted = ?');
      values.push(input.encrypted);
    }

    if (fields.length === 0) {
      return null;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(key);

    const query = `
      UPDATE config_settings
      SET ${fields.join(', ')}
      WHERE key = ?
      RETURNING *
    `;

    const results = await this.db.query<ConfigSetting>(query, values);
    return results[0] || null;
  }

  async getConfig(key: string): Promise<ConfigSetting | null> {
    const results = await this.db.query<ConfigSetting>(
      'SELECT * FROM config_settings WHERE key = ?',
      [key],
    );
    return results[0] || null;
  }

  async getValue(key: string): Promise<ConfigValue | null> {
    const setting = await this.getConfig(key);
    if (!setting) {
      return null;
    }

    return this.parseValue(setting.value, setting.type);
  }

  async setValue(key: string, value: ConfigValue, type?: ConfigSetting['type']): Promise<void> {
    const stringValue = this.stringifyValue(value);
    const valueType = type || this.detectType(value);

    await this.db.execute(
      `INSERT INTO config_settings (key, value, type) 
       VALUES (?, ?, ?) 
       ON CONFLICT(key) DO UPDATE SET 
         value = excluded.value,
         type = excluded.type,
         updated_at = CURRENT_TIMESTAMP`,
      [key, stringValue, valueType],
    );
  }

  async deleteConfig(key: string): Promise<boolean> {
    try {
      // First check if the key exists
      const existing = await this.db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM config_settings WHERE key = ?',
        [key],
      );

      if (existing[0]?.count === 0) {
        return false;
      }

      // Delete the config
      await this.db.execute('DELETE FROM config_settings WHERE key = ?', [key]);

      return true;
    } catch (error) {
      this.logger.error('Failed to delete config', { key, error });
      return false;
    }
  }

  async queryConfigs(query: ConfigQuery = {}): Promise<ConfigSetting[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (query.key) {
      conditions.push('key = ?');
      values.push(query.key);
    }
    if (query.type) {
      conditions.push('type = ?');
      values.push(query.type);
    }
    if (query.encrypted !== undefined) {
      conditions.push('encrypted = ?');
      values.push(query.encrypted ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM config_settings ${whereClause} ORDER BY key`;

    return await this.db.query<ConfigSetting>(sql, values);
  }

  // Provider operations
  async createProvider(input: CreateProviderInput): Promise<ConfigProvider> {
    const query = `
      INSERT INTO config_providers (name, type, enabled, config, metadata, priority)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `;

    const results = await this.db.query<ConfigProvider>(query, [
      input.name,
      input.type,
      input.enabled !== undefined ? (input.enabled ? 1 : 0) : 1,
      JSON.stringify(input.config || {}),
      JSON.stringify(input.metadata || {}),
      input.priority || 0,
    ]);

    if (!results[0]) {
      throw new Error('Failed to create config provider');
    }
    return results[0];
  }

  async updateProvider(name: string, input: UpdateProviderInput): Promise<ConfigProvider | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (input.type !== undefined) {
      fields.push('type = ?');
      values.push(input.type);
    }
    if (input.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(input.enabled ? 1 : 0);
    }
    if (input.config !== undefined) {
      fields.push('config = ?');
      values.push(JSON.stringify(input.config));
    }
    if (input.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(input.metadata));
    }
    if (input.priority !== undefined) {
      fields.push('priority = ?');
      values.push(input.priority);
    }

    if (fields.length === 0) {
      return null;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(name);

    const query = `
      UPDATE config_providers
      SET ${fields.join(', ')}
      WHERE name = ?
      RETURNING *
    `;

    const results = await this.db.query<ConfigProvider>(query, values);
    return results[0] || null;
  }

  async getProvider(name: string): Promise<ConfigProvider | null> {
    const results = await this.db.query<ConfigProvider>(
      'SELECT * FROM config_providers WHERE name = ?',
      [name],
    );

    if (results[0]) {
      results[0].config =
        typeof results[0].config === 'string' ? JSON.parse(results[0].config) : results[0].config;
      results[0].metadata =
        typeof results[0].metadata === 'string'
          ? JSON.parse(results[0].metadata)
          : results[0].metadata;
    }

    return results[0] || null;
  }

  async deleteProvider(name: string): Promise<boolean> {
    try {
      // First check if the provider exists
      const existing = await this.db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM config_providers WHERE name = ?',
        [name],
      );

      if (existing[0]?.count === 0) {
        return false;
      }

      // Delete the provider
      await this.db.execute('DELETE FROM config_providers WHERE name = ?', [name]);

      return true;
    } catch (error) {
      this.logger.error('Failed to delete provider', { name, error });
      return false;
    }
  }

  async queryProviders(query: ProviderQuery = {}): Promise<ConfigProvider[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (query.name) {
      conditions.push('name = ?');
      values.push(query.name);
    }
    if (query.type) {
      conditions.push('type = ?');
      values.push(query.type);
    }
    if (query.enabled !== undefined) {
      conditions.push('enabled = ?');
      values.push(query.enabled ? 1 : 0);
    }
    if (query.minPriority !== undefined) {
      conditions.push('priority >= ?');
      values.push(query.minPriority);
    }
    if (query.maxPriority !== undefined) {
      conditions.push('priority <= ?');
      values.push(query.maxPriority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM config_providers ${whereClause} ORDER BY priority DESC, name`;

    const results = await this.db.query<ConfigProvider>(sql, values);

    // Parse JSON fields
    return results.map((provider: ConfigProvider) => ({
      ...provider,
      config: typeof provider.config === 'string' ? JSON.parse(provider.config) : provider.config,
      metadata:
        typeof provider.metadata === 'string' ? JSON.parse(provider.metadata) : provider.metadata,
    }));
  }

  // Utility methods
  private parseValue(value: string, type: ConfigSetting['type']): ConfigValue {
    switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true' || value === '1';
    case 'json':
    case 'array':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
    }
  }

  private stringifyValue(value: ConfigValue): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return JSON.stringify(value);
  }

  private detectType(value: ConfigValue): ConfigSetting['type'] {
    if (typeof value === 'string') {
      return 'string';
    }
    if (typeof value === 'number') {
      return 'number';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    if (Array.isArray(value)) {
      return 'array';
    }
    if (typeof value === 'object' && value !== null) {
      return 'json';
    }
    return 'string';
  }
}

export default ConfigDatabaseService.getInstance();
