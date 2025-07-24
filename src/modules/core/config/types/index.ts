/**
 * JSON-compatible primitive types.
 */
type JsonPrimitive = string | number | boolean | null;

/**
 * JSON-compatible value type.
 */
type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];

/**
 * Configuration value types.
 */
export type ConfigValue = JsonValue;

/**
 * Configuration object type with string keys and config values.
 */
export interface IConfigObject {
  [key: string]: ConfigValue;
}

/**
 * Configuration array type containing config values.
 */
export interface IConfigArray extends Array<ConfigValue> {
  map<TResult>(
    callbackfn: (value: ConfigValue, index: number, array: ConfigValue[]) => TResult,
    thisArg?: unknown
  ): TResult[];
}

/**
 * Configuration entry.
 */
export interface IConfigEntry {
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

    list(): Promise<IConfigEntry[]>;

    validate(): Promise<{ valid: boolean; errors?: string[] }>;
}
