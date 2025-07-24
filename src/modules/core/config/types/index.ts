/**
 * Configuration value types.
 */
export type ConfigValue = string | number | boolean | null | ConfigObject | ConfigArray;

/**
 * Configuration object type.
 */
export interface ConfigObject {
  [key: string]: ConfigValue;
}

/**
 * Configuration array type.
 */
export type ConfigArray = ConfigValue[];

/**
 * Configuration entry.
 */
export interface ConfigEntry {
  key: string;
  value: ConfigValue;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuration service interface.
 */
export interface IConfigService {
    initialize(): Promise<void>;

    get(key: string): Promise<ConfigValue>;

    set(key: string, value: ConfigValue): Promise<void>;

    delete(key: string): Promise<void>;

    list(): Promise<ConfigEntry[]>;

    validate(): Promise<{ valid: boolean; errors?: string[] }>;
}
