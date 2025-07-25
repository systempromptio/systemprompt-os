/**
 * Base interface for all SystemPrompt OS modules.
 */
export interface IModule<TExports = unknown> {
    readonly name: string;

    readonly version: string;

    readonly type?: string;

    readonly dependencies?: readonly string[];

    status: ModuleStatus;

    readonly exports?: TExports;

    setDependencies?(modules: Map<string, IModule>): void;

    initialize(): Promise<void>;

    start(): Promise<void>;

    stop(): Promise<void>;

    healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Module types enum - strongly typed.
 */
export enum ModuleType {
  CORE = 'core',
  SERVICE = 'service',
  DAEMON = 'daemon',
  PLUGIN = 'plugin',
  EXTENSION = 'extension'
}

/**
 * Module status enum - strongly typed.
 */
export enum ModuleStatus {
  /**
   * Module is registered but not initialized.
   */
  PENDING = 'pending',
  /**
   * Module is currently initializing.
   */
  INITIALIZING = 'initializing',
  /**
   * Module is running and operational.
   */
  RUNNING = 'running',
  /**
   * Module is in the process of stopping.
   */
  STOPPING = 'stopping',
  /**
   * Module has been stopped.
   */
  STOPPED = 'stopped',
  /**
   * Module encountered an error.
   */
  ERROR = 'error',
  /**
   * Module is installed but not yet loaded.
   */
  INSTALLED = 'installed',
  /**
   * Module is being loaded.
   */
  LOADING = 'loading'
}

/**
 * Module event types enum - strongly typed.
 */
export enum ModuleEventType {
  DISCOVERED = 'discovered',
  INSTALLED = 'installed',
  STARTED = 'started',
  STOPPED = 'stopped',
  ERROR = 'error',
  HEALTH_CHECK = 'health_check',
  CONFIG_CHANGED = 'config_changed'
}

/**
 * Module health status enum - strongly typed.
 */
export enum ModuleHealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Extension types (legacy compatibility).
 */
export type ExtensionType = 'module' | 'server';

/**
 * Module information interface - required fields are truly required.
 */
export interface ModuleInfo {
  // Required core fields
  name: string;
  version: string;
  type: ModuleType;
  path: string;
  enabled: boolean;
  autoStart: boolean;
  status: ModuleStatus;
  healthStatus: ModuleHealthStatus;

  // Optional database fields
  id?: number;
  createdAt?: Date;
  updatedAt?: Date;

  // Optional module metadata
  dependencies?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;

  // Optional status information
  lastError?: string;
  discoveredAt?: Date;
  lastStartedAt?: Date;
  lastStoppedAt?: Date;
  healthMessage?: string;
  lastHealthCheck?: Date;
}

/**
 * Module event interface - required fields for event tracking.
 */
export interface ModuleEvent {
  // Required fields
  moduleId: number;
  eventType: ModuleEventType;

  // Optional fields
  id?: number;
  eventData?: Record<string, unknown>;
  createdAt?: Date;
}

/**
 * Module dependency interface - explicit dependency tracking.
 */
export interface ModuleDependency {
  // Required fields
  moduleId: number;
  dependencyName: string;
  required: boolean;

  // Optional fields
  id?: number;
  versionConstraint?: string;
  createdAt?: Date;
}

/**
 * Scanned module interface - pre-database module representation.
 */
export interface ScannedModule {
  // Required fields from module manifest
  name: string;
  version: string;
  type: ModuleType;
  path: string;

  // Optional fields from manifest
  dependencies?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Module scan options.
 */
export interface ModuleScanOptions {
  paths?: string[];
  includeDisabled?: boolean;
  deep?: boolean;
}

/**
 * Module configuration - runtime configuration.
 */
export interface ModuleConfig {
  // Required fields
  enabled: boolean;

  // Optional runtime settings
  autoStart?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Module scanner service interface.
 */
export interface ModuleScannerService {
  scan(options: ModuleScanOptions): Promise<ScannedModule[]>;
  getEnabledModules(): Promise<ModuleInfo[]>;
  updateModuleStatus(name: string, status: ModuleStatus, error?: string): Promise<void>;
  setModuleEnabled(name: string, enabled: boolean): Promise<void>;
  updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void>;
  getModule(name: string): Promise<ModuleInfo | undefined>;
  getRegisteredModules(): Promise<ModuleInfo[]>;
}

/**
 * Extension module configuration - path configuration.
 */
export interface ExtensionModuleConfig {
  // Required paths
  modulesPath: string;
  extensionsPath: string;

  // Optional settings
  autoDiscover?: boolean;
}

/**
 * Extension info - complete extension representation.
 */
export interface ExtensionInfo {
  // Required core fields
  name: string;
  type: ExtensionType;
  version: string;
  path: string;
  enabled: boolean;

  // Optional metadata
  description?: string;
  author?: string;
  dependencies?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  exports?: Record<string, unknown>;
  cli?: Record<string, unknown>;
}

/**
 * Extension configuration - runtime settings for extensions.
 */
export interface ExtensionConfig {
  // All fields optional as this is runtime config
  autoStart?: boolean;
  dependencies?: string[];
  settings?: Record<string, unknown>;
  [key: string]: unknown; // Allow dynamic config keys
}

/**
 * Module manifest - YAML module definition.
 */
export interface ModuleManifest {
  // Required fields in a valid manifest
  name: string;
  version: string;
  type: string;

  // Optional metadata
  description?: string;
  author?: string;
  dependencies?: string[];
  config?: Record<string, unknown>;
  cli?: {
    commands?: CLICommand[];
  };
}

/**
 * Validation result - comprehensive validation output.
 */
export interface ValidationResult {
  // Required fields
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Install options interface.
 */
export interface InstallOptions {
  force?: boolean;
  skipDependencies?: boolean;
  autoEnable?: boolean;
  version?: string;
}

/**
 * Removal options interface.
 */
export interface RemovalOptions {
  force?: boolean;
  keepData?: boolean;
  preserveConfig?: boolean;
}

/**
 * Discovery options interface.
 */
export interface DiscoveryOptions {
  paths?: string[];
  recursive?: boolean;
  types?: ExtensionType[];
}

/**
 * CLI command definition - command structure.
 */
export interface CLICommand {
  // Required fields
  name: string;
  description: string;

  // Optional fields
  options?: CLIOption[];
}

/**
 * CLI option definition - command option structure.
 */
export interface CLIOption {
  // Required fields
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;

  // Optional fields
  alias?: string;
  required?: boolean;
  default?: string | number | boolean;
}

/**
 * MCP resource data stored in database.
 */
export interface MCPResource {
  id: number;
  uri: string;
  name: string;
  description?: string;
  mimeType: string;
  contentType: 'text' | 'blob';
  content?: string;
  blobContent?: Buffer;
  size?: number;
  moduleName: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

/**
 * MCP prompt data stored in database.
 */
export interface MCPPrompt {
  id: number;
  name: string;
  description?: string;
  messages: Array<{ role: string; content: string }>;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  moduleName: string;
  filePath?: string;
  metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

/**
 * MCP resource template stored in database.
 */
export interface MCPResourceTemplate {
  id: number;
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
  moduleName: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database row type for modules table.
 */
export interface IDatabaseModuleRow {
  id: number;
  name: string;
  version: string;
  type: string;
  path: string;
  enabled: number;
  autoStart: number;
  dependencies: string;
  config: string;
  status: string;
  lasterror: string | null;
  discoveredAt?: string;
  lastStartedAt?: string;
  lastStoppedAt?: string;
  healthStatus: string;
  healthMessage: string | null;
  lastHealthCheck?: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * MCP content scanner service interface.
 */
export interface IMCPContentScanner {
  scanModule(moduleName: string, modulePath: string): Promise<void>;
  removeModuleContent(moduleName: string): Promise<void>;
}
