/**
 * @fileoverview Configuration management module for SystemPrompt OS
 * @module modules/core/config
 */

// Module interface defined locally
export interface ModuleInterface {
  name: string;
  version: string;
  type: 'core' | 'service' | 'extension';
  initialize(context: { config?: any; logger?: any }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Configuration module that provides centralized configuration management
 * with environment variable resolution, file persistence, and hierarchical access.
 */
export class ConfigModule implements ModuleInterface {
  readonly name = 'config';
  readonly version = '1.0.0';
  readonly type = 'service' as const;
  
  private configStore = new Map<string, unknown>();
  private configPath: string = '';
  private config: Record<string, unknown> = {};
  private logger?: Console;
  
  /**
   * Initializes the configuration module with the provided context
   * @param context - Module initialization context
   * @param context.config - Initial configuration object
   * @param context.logger - Logger instance for debugging
   */
  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.config = context.config || {};
    this.logger = context.logger;
    
    this.configPath = resolve(process.cwd(), this.config.configPath as string || './state/config');
    
    if (!existsSync(this.configPath)) {
      mkdirSync(this.configPath, { recursive: true });
      this.logger?.info(`Created config directory: ${this.configPath}`);
    }
    
    await this.loadConfiguration();
    this.logger?.info('Config module initialized');
  }
  
  /**
   * Starts the configuration module
   */
  async start(): Promise<void> {
    this.logger?.info('Config module started');
  }
  
  /**
   * Stops the configuration module and saves pending changes
   */
  async stop(): Promise<void> {
    await this.saveConfiguration();
    this.logger?.info('Config module stopped');
  }
  
  /**
   * Performs a health check on the configuration module
   * @returns Health status and optional error message
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      if (!existsSync(this.configPath)) {
        return { healthy: false, message: 'Config directory not found' };
      }
      return { healthy: true };
    } catch (error) {
      return { healthy: false, message: `Health check failed: ${error}` };
    }
  }
  
  /**
   * Retrieves configuration value(s) by key
   * @param key - Optional dot-notation key (e.g., 'system.port'). If omitted, returns entire config
   * @returns Configuration value or undefined if not found
   */
  get(key?: string): unknown {
    if (!key) {
      return this.buildNestedObject();
    }
    
    const directValue = this.configStore.get(key);
    if (directValue !== undefined) {
      return directValue;
    }
    
    return this.getNestedObject(key);
  }
  
  /**
   * Sets a configuration value
   * @param key - Dot-notation key for the configuration value
   * @param value - Value to set
   */
  async set(key: string, value: unknown): Promise<void> {
    this.configStore.set(key, value);
    await this.saveConfiguration();
    this.logger?.info(`Configuration updated: ${key} = ${value}`);
  }
  
  /**
   * Validates the current or provided configuration
   * @param config - Optional configuration object to validate. Uses current config if omitted
   * @returns Validation result with status and any errors found
   */
  validate(config?: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const configToValidate = config || this.get();
    
    if (typeof configToValidate !== 'object' || configToValidate === null) {
      return { valid: false, errors: ['Configuration must be an object'] };
    }
    
    const typedConfig = configToValidate as Record<string, any>;
    
    if (typedConfig.system?.port) {
      const port = parseInt(String(typedConfig.system.port));
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push('Invalid port number: must be between 1 and 65535');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Loads configuration from defaults, file, and environment variables
   */
  private async loadConfiguration(): Promise<void> {
    const configFile = join(this.configPath, 'config.json');
    
    if (this.config.defaults) {
      this.loadDefaults(this.config.defaults as Record<string, unknown>);
    }
    
    if (existsSync(configFile)) {
      this.loadFromFile(configFile);
    }
    
    this.loadFromEnvironment();
  }
  
  /**
   * Loads default configuration values
   * @param defaults - Default configuration object
   */
  private loadDefaults(defaults: Record<string, unknown>): void {
    const flattened = this.flattenObject(defaults);
    flattened.forEach((value, key) => {
      this.configStore.set(key, value);
    });
  }
  
  /**
   * Loads configuration from a JSON file
   * @param configFile - Path to the configuration file
   */
  private loadFromFile(configFile: string): void {
    try {
      const data = JSON.parse(readFileSync(configFile, 'utf-8'));
      const flattened = this.flattenObject(data);
      flattened.forEach((value, key) => {
        this.configStore.set(key, value);
      });
    } catch (error) {
      this.logger?.error('Failed to load config file:', error);
    }
  }
  
  /**
   * Loads configuration from environment variables
   * Supports SYSTEMPROMPT_ prefixed variables and ${ENV_VAR} placeholders
   */
  private loadFromEnvironment(): void {
    Object.entries(process.env).forEach(([key, value]) => {
      if (key.startsWith('SYSTEMPROMPT_')) {
        const configKey = key
          .substring('SYSTEMPROMPT_'.length)
          .toLowerCase()
          .replace(/_/g, '.');
        this.configStore.set(configKey, value);
      }
    });
    
    this.resolveEnvironmentPlaceholders();
  }
  
  /**
   * Resolves ${ENV_VAR} placeholders in string configuration values
   */
  private resolveEnvironmentPlaceholders(): void {
    this.configStore.forEach((value, key) => {
      if (typeof value === 'string' && value.includes('${')) {
        const resolved = value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
          return process.env[envVar] || '';
        });
        this.configStore.set(key, resolved);
      }
    });
  }
  
  /**
   * Saves the current configuration to file
   */
  private async saveConfiguration(): Promise<void> {
    const configFile = join(this.configPath, 'config.json');
    const config = this.buildNestedObject();
    writeFileSync(configFile, JSON.stringify(config, null, 2));
  }
  
  /**
   * Flattens a nested object into dot-notation keys
   * @param obj - Object to flatten
   * @param prefix - Key prefix for recursion
   * @returns Map of flattened key-value pairs
   */
  private flattenObject(obj: Record<string, unknown>, prefix = ''): Map<string, unknown> {
    const flattened = new Map<string, unknown>();
    
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (this.isPlainObject(value)) {
        const nested = this.flattenObject(value as Record<string, unknown>, fullKey);
        nested.forEach((nestedValue, nestedKey) => {
          flattened.set(nestedKey, nestedValue);
        });
      } else {
        const resolvedValue = this.resolveIfString(value);
        flattened.set(fullKey, resolvedValue);
      }
    });
    
    return flattened;
  }
  
  /**
   * Checks if a value is a plain object (not array, null, or other types)
   * @param value - Value to check
   * @returns true if value is a plain object
   */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && 
           value !== null && 
           !Array.isArray(value) &&
           Object.prototype.toString.call(value) === '[object Object]';
  }
  
  /**
   * Resolves environment variables in string values
   * @param value - Value to resolve
   * @returns Resolved value or original if not a string
   */
  private resolveIfString(value: unknown): unknown {
    if (typeof value === 'string' && value.includes('${')) {
      return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
        return process.env[envVar] || '';
      });
    }
    return value;
  }
  
  /**
   * Builds a nested object from the flat configuration store
   * @returns Nested configuration object
   */
  private buildNestedObject(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    this.configStore.forEach((value, key) => {
      this.setNestedValue(result, key, value);
    });
    
    return result;
  }
  
  /**
   * Gets a nested object for a given key prefix
   * @param keyPrefix - Dot-notation key prefix
   * @returns Nested object or undefined
   */
  private getNestedObject(keyPrefix: string): Record<string, unknown> | undefined {
    const result: Record<string, unknown> = {};
    let hasValues = false;
    
    this.configStore.forEach((value, key) => {
      if (key.startsWith(keyPrefix + '.')) {
        const subKey = key.substring(keyPrefix.length + 1);
        this.setNestedValue(result, subKey, value);
        hasValues = true;
      }
    });
    
    return hasValues ? result : undefined;
  }
  
  /**
   * Sets a value in a nested object using dot-notation path
   * @param obj - Target object
   * @param path - Dot-notation path
   * @param value - Value to set
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || !this.isPlainObject(current[key])) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    
    current[keys[keys.length - 1]] = value;
  }
}