/**
 * Config service implementation - manages configuration key-value operations.
 * @file Config service implementation.
 * @module modules/core/config/services/config
 */

import { randomUUID } from 'crypto';
import { type ILogger, LogSource } from '../../logger/types/manual';
import { ConfigRepository } from '../repositories/config.repository';
import { EventBusService } from '../../events/services/events.service';
import {
  type IConfig,
  type IConfigCreateData,
  type IConfigUpdateData,
  type IConfigService
} from '../types/config.module.generated';
import { ConfigType, type IConfigRow } from '../types/database.generated';

/**
 * Service for managing configuration.
 */
export class ConfigService implements IConfigService {
  private static instance: ConfigService;
  private readonly repository: ConfigRepository;
  private readonly eventBus: EventBusService;
  private logger?: ILogger;
  private initialized = false;

  private constructor() {
    this.repository = ConfigRepository.getInstance();
    this.eventBus = EventBusService.getInstance();
  }

  static getInstance(): ConfigService {
    ConfigService.instance ||= new ConfigService();
    return ConfigService.instance;
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.repository.initialize();
    this.initialized = true;
    this.logger?.info(LogSource.CONFIG, 'ConfigService initialized');
  }

  async setConfig(key: string, value: string, type?: ConfigType): Promise<IConfig> {
    await this.ensureInitialized();
    
    const now = new Date();
    const configType = type || ConfigType.STRING;

    this.logger?.info(LogSource.CONFIG, `Setting config: ${key}`);

    // Validate the value for the specified type
    this.validateConfigValue(value, configType);

    const configData: IConfigCreateData = {
      key,
      value,
      type: configType,
      description: null
    };

    const configRow = await this.repository.setConfig(configData);
    const config = this.rowToConfig(configRow);

    // Emit events for other modules
    this.eventBus.emit('config:updated', {
      key: config.key,
      value: config.value,
      type: config.type,
      timestamp: now
    });

    return config;
  }

  async getConfig(key: string): Promise<IConfig | null> {
    await this.ensureInitialized();
    
    const configRow = await this.repository.getConfig(key);
    if (!configRow) {
      return null;
    }

    return this.rowToConfig(configRow);
  }

  async listConfigs(prefix?: string): Promise<IConfig[]> {
    await this.ensureInitialized();
    
    const configRows = await this.repository.listConfigs(prefix);
    return configRows.map(row => this.rowToConfig(row));
  }

  async deleteConfig(key: string): Promise<void> {
    await this.ensureInitialized();
    
    const existing = await this.repository.getConfig(key);
    if (!existing) {
      throw new Error(`Config key not found: ${key}`);
    }

    await this.repository.deleteConfig(key);
    
    this.eventBus.emit('config:deleted', {
      key,
      timestamp: new Date()
    });

    this.logger?.info(LogSource.CONFIG, `Deleted config: ${key}`);
  }

  async updateConfig(key: string, data: IConfigUpdateData): Promise<IConfig> {
    await this.ensureInitialized();
    
    const existing = await this.repository.getConfig(key);
    if (!existing) {
      throw new Error(`Config key not found: ${key}`);
    }

    // Validate the value if provided
    if (data.value !== undefined && data.type !== undefined) {
      this.validateConfigValue(data.value, data.type);
    } else if (data.value !== undefined) {
      this.validateConfigValue(data.value, existing.type);
    }

    // Note: updated_at is handled by repository
    const configRow = await this.repository.updateConfig(key, data);
    const config = this.rowToConfig(configRow);

    this.eventBus.emit('config:updated', {
      key: config.key,
      value: config.value,
      type: config.type,
      timestamp: new Date()
    });

    this.logger?.info(LogSource.CONFIG, `Updated config: ${key}`);

    return config;
  }

  /**
   * Validate configuration value against its type.
   * @param value - The value to validate.
   * @param type - The expected type.
   * @throws Error if validation fails.
   */
  private validateConfigValue(value: string, type: ConfigType): void {
    switch (type) {
      case ConfigType.NUMBER:
        if (isNaN(Number(value)) || !isFinite(Number(value))) {
          throw new Error('Value must be a valid number for number type');
        }
        break;
      case ConfigType.BOOLEAN:
        if (!['true', 'false'].includes(value.toLowerCase())) {
          throw new Error('Value must be true or false for boolean type');
        }
        break;
      case ConfigType.JSON:
        try {
          JSON.parse(value);
        } catch {
          throw new Error('Value must be valid JSON for json type');
        }
        break;
      case ConfigType.STRING:
      default:
        // No validation needed for string type
        break;
    }
  }

  /**
   * Convert database row to domain object.
   * @param row - Database row.
   * @returns Domain config object.
   */
  private rowToConfig(row: IConfigRow): IConfig {
    return {
      id: row.id,
      key: row.key,
      value: row.value,
      type: row.type,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}