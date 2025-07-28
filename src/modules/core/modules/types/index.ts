import type { ICoreModuleDefinition } from '@/types/bootstrap';

/**
 * Module status enum - strongly typed.
 */
export const enum ModuleStatusEnum {
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
 * Module types enum - strongly typed.
 */
export const enum ModuleTypeEnum {
  CORE = 'core',
  CUSTOM = 'custom',
  SERVICE = 'service',
  DAEMON = 'daemon',
  PLUGIN = 'plugin',
  EXTENSION = 'extension'
}

/**
 * Base interface for all SystemPrompt OS modules.
 */
export interface IModule<TExports = unknown> {
    readonly name: string;

    readonly version: string;

    readonly type?: string;

    readonly dependencies?: readonly string[];

    status: ModuleStatusEnum;

    readonly exports: TExports;

    setDependencies?(modules: Map<string, IModule>): void;

    initialize(): Promise<void>;

    start(): Promise<void>;

    stop(): Promise<void>;

    healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Module event types enum - strongly typed.
 */
export const enum ModuleEventTypeEnum {
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
export const enum ModuleHealthStatusEnum {
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
export interface IModuleInfo {
  name: string;
  version: string;
  type: ModuleTypeEnum;
  path: string;
  enabled: boolean;
  autoStart: boolean;
  status: ModuleStatusEnum;
  healthStatus: ModuleHealthStatusEnum;
  id?: number;
  createdAt?: Date;
  updatedAt?: Date;
  dependencies?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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
export interface IModuleEvent {
  moduleId: number;
  eventType: ModuleEventTypeEnum;
  id?: number;
  eventData?: Record<string, unknown>;
  createdAt?: Date;
}

/**
 * Module dependency interface - explicit dependency tracking.
 */
export interface IModuleDependency {
  moduleId: number;
  dependencyName: string;
  required: boolean;
  id?: number;
  versionConstraint?: string;
  createdAt?: Date;
}

/**
 * Scanned module interface - pre-database module representation.
 */
export interface IScannedModule {
  name: string;
  version: string;
  type: ModuleTypeEnum;
  path: string;
  dependencies?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Module scan options.
 */
export interface IModuleScanOptions {
  paths?: string[];
  includeDisabled?: boolean;
  deep?: boolean;
}

/**
 * Module configuration - runtime configuration.
 */
export interface IModuleConfig {
  enabled: boolean;
  autoStart?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Module scanner service interface.
 */
export interface IModuleScannerService {
  scan(options: IModuleScanOptions): Promise<IScannedModule[]>;
  getEnabledModules(): Promise<IModuleInfo[]>;
  updateModuleStatus(name: string, status: ModuleStatusEnum, error?: string): Promise<void>;
  setModuleEnabled(name: string, enabled: boolean): Promise<void>;
  updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void>;
  getModule(name: string): Promise<IModuleInfo | undefined>;
  getRegisteredModules(): Promise<IModuleInfo[]>;
}

/**
 * Extension module configuration - path configuration.
 */
export interface IExtensionModuleConfig {
  modulesPath: string;
  extensionsPath: string;
  autoDiscover?: boolean;
}

/**
 * Extension info - complete extension representation.
 */
export interface IExtensionInfo {
  name: string;
  type: ExtensionType;
  version: string;
  path: string;
  enabled: boolean;
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
export interface IExtensionConfig {
  autoStart?: boolean;
  dependencies?: string[];
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * CLI option definition - command option structure.
 */
export interface ICliOption {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  alias?: string;
  required?: boolean;
  default?: string | number | boolean;
}

/**
 * CLI command definition - command structure.
 */
export interface ICliCommand {
  name: string;
  description: string;
  options?: ICliOption[];
}

/**
 * Module manifest - YAML module definition.
 */
export interface IModuleManifest {
  name: string;
  version: string;
  type: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  config?: Record<string, unknown>;
  cli?: {
    commands?: ICliCommand[];
  };
}

/**
 * Validation result - comprehensive validation output.
 */
export interface IValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Install options interface.
 */
export interface IInstallOptions {
  force?: boolean;
  skipDependencies?: boolean;
  autoEnable?: boolean;
  version?: string;
}

/**
 * Removal options interface.
 */
export interface IRemovalOptions {
  force?: boolean;
  keepData?: boolean;
  preserveConfig?: boolean;
}

/**
 * Discovery options interface.
 */
export interface IDiscoveryOptions {
  paths?: string[];
  recursive?: boolean;
  types?: ExtensionType[];
}

/**
 * MCP resource data stored in database.
 */
export interface IResourceData {
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
export interface IPromptData {
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
export interface IResourceTemplateData {
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
 * MCP resource data interface for scanning resources.
 */
export interface IResourceScanData {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * MCP prompt data interface for scanning prompts.
 */
export interface IPromptScanData {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
  };
}

/**
 * File information interface for scanned files.
 */
export interface IFileInfo {
  path: string;
  relativePath: string;
  stats: Record<string, unknown>;
  hash?: string;
}

/**
 * MCP content scanner service interface.
 */
export interface IContentScanner {
  scanModule(moduleName: string, modulePath: string): Promise<void>;
  removeModuleContent(moduleName: string): Promise<void>;
}

/**
 * Strongly typed exports interface for Modules module.
 */
export interface IModulesModuleExports {
  readonly service: () => IModuleScannerService | undefined;
  readonly scanForModules: () => Promise<IScannedModule[]>;
  readonly getEnabledModules: () => Promise<IModuleInfo[]>;
  readonly getModule: (name: string) => Promise<IModuleInfo | undefined>;
  readonly enableModule: (name: string) => Promise<void>;
  readonly disableModule: (name: string) => Promise<void>;
  readonly registerCoreModule: (
    name: string,
    path: string,
    dependencies?: string[],
  ) => Promise<void>;
  // Core module loading methods
  readonly loadCoreModule: (definition: ICoreModuleDefinition) => Promise<IModule>;
  readonly initializeCoreModule: (name: string) => Promise<void>;
  readonly startCoreModule: (name: string) => Promise<void>;
  readonly getCoreModule: (name: string) => IModule | undefined;
  readonly getAllCoreModules: () => Map<string, IModule>;
  readonly registerPreLoadedModule: (name: string, module: IModule) => void;
}
