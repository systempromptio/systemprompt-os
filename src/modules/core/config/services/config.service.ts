/**
 * Config service implementation.
 * @module modules/core/config/services/config.service
 */

import type {
 ConfigValue, IConfigEntry, IConfigService
} from '@/modules/core/config/types/index';

/**
 * Service for managing configuration with singleton pattern.
 * TODO: Load configurations from database.
 * TODO: Persist to database.
 * TODO: Remove from database.
 * TODO: Implement validation logic.
 * @class ConfigService
 */
export class ConfigService implements IConfigService {
  private static instance: ConfigService | undefined;
  private readonly configs: Map<string, IConfigEntry> = new Map();
  private initialized = false;

  /**
   * Private constructor for singleton pattern. Private constructor for singleton.
   */
  private constructor() {
    Object.seal(this);
  }

  /**
   * Get singleton instance.
   * @returns {ConfigService} The singleton instance.
   */
  public static getInstance(): ConfigService {
    ConfigService.instance ??= new ConfigService();
    return ConfigService.instance;
  }

  /**
   * Initialize the service.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Get a configuration value.
   * @param {string} key - Configuration key.
   * @returns {Promise<ConfigValue>} Configuration value.
   */
  async get(key: string): Promise<ConfigValue> {
    const entry = this.configs.get(key);
    await Promise.resolve();
    return entry === undefined ? null : entry.value;
  }

  /**
   * Set a configuration value.
   * @param {string} key - Configuration key.
   * @param {ConfigValue} value - Configuration value.
   * @returns {Promise<void>} Promise that resolves when value is set.
   */
  async set(key: string, value: ConfigValue): Promise<void> {
    const now = new Date();
    const existing = this.configs.get(key);

    const entry: IConfigEntry = {
      key,
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.configs.set(key, entry);
    await Promise.resolve();
  }

  /**
   * Delete a configuration value.
   * @param {string} key - Configuration key.
   * @returns {Promise<void>} Promise that resolves when value is deleted.
   */
  async delete(key: string): Promise<void> {
    this.configs.delete(key);
    await Promise.resolve();
  }

  /**
   * List all configuration entries.
   * @returns {Promise<IConfigEntry[]>} All configuration entries.
   */
  async list(): Promise<IConfigEntry[]> {
    await Promise.resolve();
    return Array.from(this.configs.values());
  }

  /**
   * Validate configuration.
   * @returns {Promise<{ valid: boolean; errors?: string[] }>} Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    await Promise.resolve();

    const EMPTY_ERRORS = 0;
    if (errors.length > EMPTY_ERRORS) {
      return {
        valid: false,
        errors,
      };
    }

    return {
      valid: true,
    };
  }
}
