/**
 * Config module data models
 */

export interface ConfigSetting {
  id: number;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  description?: string;
  encrypted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ConfigProvider {
  id: number;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, any>;
  metadata?: Record<string, any>;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

// Input types for create operations
export type CreateConfigInput = Omit<ConfigSetting, 'id' | 'created_at' | 'updated_at'>;
export type CreateProviderInput = Omit<ConfigProvider, 'id' | 'created_at' | 'updated_at'>;

// Input types for update operations
export type UpdateConfigInput = Partial<Omit<ConfigSetting, 'id' | 'key' | 'created_at' | 'updated_at'>>;
export type UpdateProviderInput = Partial<Omit<ConfigProvider, 'id' | 'name' | 'created_at' | 'updated_at'>>;

// Query interfaces for filtering
export interface ConfigQuery {
  key?: string;
  type?: ConfigSetting['type'];
  encrypted?: boolean;
}

export interface ProviderQuery {
  name?: string;
  type?: string;
  enabled?: boolean;
  minPriority?: number;
  maxPriority?: number;
}

// Utility types
export type ConfigValue = string | number | boolean | Record<string, any> | any[];

export interface ParsedConfig<T = ConfigValue> {
  key: string;
  value: T;
  type: ConfigSetting['type'];
}

export interface ProviderRegistration {
  name: string;
  type: string;
  config: Record<string, any>;
  priority?: number;
  enabled?: boolean;
  metadata?: Record<string, any>;
}