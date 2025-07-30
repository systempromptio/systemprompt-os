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
 * MCP Server configuration interface.
 */
export interface IMcpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  scope?: 'local' | 'project' | 'user';
  transport?: 'stdio' | 'sse' | 'http';
  description?: string;
  metadata?: Record<string, unknown>;
  oauthConfig?: {
    clientId: string;
    clientSecret: string;
    authUrl: string;
    tokenUrl: string;
    scope?: string;
  };
}

/**
 * MCP Server entry interface.
 */
export interface IMcpServerEntry {
  id: number;
  name: string;
  command: string;
  args: string[] | null;
  env: Record<string, string> | null;
  scope: 'local' | 'project' | 'user';
  transport: 'stdio' | 'sse' | 'http';
  status: 'active' | 'inactive' | 'error' | 'starting' | 'stopping';
  description: string | null;
  metadata: Record<string, unknown> | null;
  oauthConfig: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  lastStartedAt: Date | null;
  lastError: string | null;
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

    // MCP Server management methods
    addMcpServer(config: IMcpServerConfig): Promise<void>;
    deleteMcpServer(name: string): Promise<void>;
    getMcpServer(name: string): Promise<IMcpServerEntry | null>;
    listMcpServers(): Promise<IMcpServerEntry[]>;
    updateMcpServerStatus(name: string, status: 'active' | 'inactive' | 'error' | 'starting' | 'stopping', error?: string): Promise<void>;
}

/**
 * System defaults configuration interface.
 */
export interface ISystemDefaults {
  port?: number;
  host?: string;
  environment?: string;
  logLevel?: string;
}

/**
 * Defaults configuration interface.
 */
export interface IDefaultsConfig {
  system?: ISystemDefaults;
}

/**
 * Providers configuration interface.
 */
export interface IProvidersConfig {
  available?: string[];
  enabled?: string[];
  default?: string;
}

/**
 * Main configuration structure interface.
 */
export interface IConfigStructure {
  defaults?: IDefaultsConfig;
  providers?: IProvidersConfig;
  [key: string]: unknown;
}

/**
 * Validate command context interface.
 */
export interface IValidateCommandContext {
  file?: string;
}

/**
 * Strongly typed exports interface for Config module.
 */
export interface IConfigModuleExports {
  readonly service: () => IConfigService;
  readonly get: (key?: string) => Promise<ConfigValue | IConfigEntry[]>;
  readonly set: (key: string, value: ConfigValue) => Promise<void>;
}
