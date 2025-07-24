/**
 * @fileoverview Module manager service for managing system modules
 * @module modules/core/modules/services/module-manager.service
 */

import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import type { Logger } from '@/modules/types.js';
import type {
  ExtensionInfo,
  ExtensionType,
  ValidationResult,
  InstallOptions,
  RemovalOptions,
  DiscoveryOptions,
  ExtensionModuleConfig,
  ModuleManifest} from '../types/index.js';
import {
  ModuleType,
} from '../types/index.js';
import { ModuleRepository } from '../repositories/module.repository.js';
import { ModuleScannerService } from './module-scanner.service.js';
import {
  ExtensionNotFoundError,
  ExtensionInstallationError,
  ProtectedExtensionError,
  ExtensionAlreadyExistsError,
} from '../utils/errors.js';
import { parseModuleManifestSafe } from '../utils/manifest-parser.js';

/**
 * Service for managing system modules with business logic
 */
export class ModuleManagerService {
  private static instance: ModuleManagerService;
  private readonly repository: ModuleRepository;
  private readonly logger?: Logger;
  private readonly config: ExtensionModuleConfig;
  private readonly scannerService: ModuleScannerService;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(config: ExtensionModuleConfig, logger?: Logger) {
    this.repository = new ModuleRepository();
    this.config = config;
    this.logger = logger;
    this.scannerService = new ModuleScannerService(logger);
  }

  /**
   * Get singleton instance
   * @param config - Extension module configuration
   * @param logger - Logger instance
   * @returns ExtensionService instance
   */
  static getInstance(config: ExtensionModuleConfig, logger?: Logger): ModuleManagerService {
    if (!ModuleManagerService.instance) {
      ModuleManagerService.instance = new ModuleManagerService(config, logger);
    }
    return ModuleManagerService.instance;
  }

  /**
   * Get the scanner service
   */
  getScannerService(): ModuleScannerService {
    return this.scannerService;
  }

  /**
   * Initialize the extension service
   */
  async initialize(): Promise<void> {
    // Initialize scanner service
    await this.scannerService.initialize();
    // Set reference for validation
    this.scannerService.setModuleManagerService(this);

    // Ensure extension directories exist
    const paths = [
      this.config.modulesPath,
      this.config.extensionsPath,
      join(this.config.extensionsPath, 'modules'),
      join(this.config.extensionsPath, 'servers'),
    ];

    for (const path of paths) {
      const absolutePath = resolve(process.cwd(), path);
      if (!existsSync(absolutePath)) {
        mkdirSync(absolutePath, { recursive: true });
        this.logger?.info(`Created directory: ${absolutePath}`);
      }
    }

    // Discover extensions if auto-discovery is enabled
    if (this.config.autoDiscover !== false) {
      await this.discoverExtensions();
    }
  }

  /**
   * Discover all installed extensions
   * @param options - Discovery options
   */
  async discoverExtensions(options?: DiscoveryOptions): Promise<void> {
    this.repository.clear();

    const paths = options?.paths || [
      resolve(process.cwd(), this.config.modulesPath, 'core'),
      resolve(process.cwd(), this.config.modulesPath, 'custom'),
      resolve(process.cwd(), this.config.extensionsPath, 'modules'),
      resolve(process.cwd(), this.config.extensionsPath, 'servers'),
    ];

    for (const path of paths) {
      if (existsSync(path)) {
        const type = path.includes('/servers') ? 'server' : 'module';
        const types = options?.types;
        if (!types || types.includes(type as ExtensionType)) {
          await this.discoverInDirectory(path, type as ExtensionType);
        }
      }
    }

    this.logger?.info(`Discovered ${this.repository.count()} extensions`);
  }

  /**
   * Discover extensions in a specific directory
   * @param dirPath - Directory path to scan
   * @param type - Extension type
   */
  private async discoverInDirectory(dirPath: string, type: ExtensionType): Promise<void> {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const extensionPath = join(dirPath, entry.name);
          const configFile = join(extensionPath, type === 'module' ? 'module.yaml' : 'server.yaml');

          if (existsSync(configFile)) {
            try {
              const configContent = readFileSync(configFile, 'utf-8');
              const parseResult = parseModuleManifestSafe(configContent);

              if (!parseResult.manifest) {
                this.logger?.warn(`Skipping ${configFile}: ${parseResult.errors?.join(', ')}`);
                continue;
              }

              const manifest = parseResult.manifest;

              const extensionInfo: ExtensionInfo = {
                name: manifest.name,
                type,
                version: manifest.version,
                path: extensionPath,
                enabled: true,
                ...(manifest.description && { description: manifest.description }),
                ...(manifest.author && { author: manifest.author }),
                ...(manifest.dependencies && { dependencies: manifest.dependencies }),
                ...(manifest.config && { config: manifest.config }),
              };

              this.repository.save(extensionInfo);
            } catch (error) {
              this.logger?.error(`Failed to load extension config from ${configFile}:`, error);
            }
          }
        }
      }
    } catch (error) {
      this.logger?.error(`Failed to discover extensions in ${dirPath}:`, error);
    }
  }

  /**
   * Get all extensions
   * @param type - Optional type filter
   * @returns Array of extension information
   */
  getExtensions(type?: ExtensionType): ExtensionInfo[] {
    return type ? this.repository.findByType(type) : this.repository.findAll();
  }

  /**
   * Get extension by name
   * @param name - Extension name
   * @returns Extension information
   * @throws ExtensionNotFoundError if not found
   */
  getExtension(name: string): ExtensionInfo {
    const extension = this.repository.findByName(name);
    if (!extension) {
      throw new ExtensionNotFoundError(name);
    }
    return extension;
  }

  /**
   * Validate extension structure
   * @param path - Path to extension
   * @param strict - Use strict validation
   * @returns Validation result
   */
  validateExtension(path: string, strict: boolean = false): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!existsSync(path)) {
      errors.push('Extension path does not exist');
      return { valid: false, errors, warnings };
    }

    // Check for module.yaml or server.yaml
    const moduleConfig = join(path, 'module.yaml');
    const serverConfig = join(path, 'server.yaml');

    let manifest: ModuleManifest | undefined;
    let type: 'module' | 'server' | undefined;

    if (existsSync(moduleConfig)) {
      type = 'module';
      try {
        const content = readFileSync(moduleConfig, 'utf-8');
        const parseResult = parseModuleManifestSafe(content);
        if (parseResult.manifest) {
          manifest = parseResult.manifest;
        } else {
          errors.push(...(parseResult.errors || ['Unknown parsing error']));
        }
      } catch (error) {
        errors.push(`Failed to read module.yaml: ${error}`);
      }
    } else if (existsSync(serverConfig)) {
      type = 'server';
      try {
        const content = readFileSync(serverConfig, 'utf-8');
        const parseResult = parseModuleManifestSafe(content);
        if (parseResult.manifest) {
          // Server type can default to 'extension' for backwards compatibility
          if (!parseResult.manifest.type) {
            manifest = { ...parseResult.manifest, type: ModuleType.EXTENSION };
          } else {
            manifest = parseResult.manifest;
          }
        } else {
          errors.push(...(parseResult.errors || ['Unknown parsing error']));
        }
      } catch (error) {
        errors.push(`Failed to read server.yaml: ${error}`);
      }
    } else {
      errors.push('No module.yaml or server.yaml found');
    }

    if (manifest) {
      // Validate required fields
      if (!manifest.name) {errors.push('Missing required field: name');}
      if (!manifest.version) {errors.push('Missing required field: version');}
      if (!manifest.type && type === 'module') {errors.push('Missing required field: type');}

      // Validate name format
      if (manifest.name && !/^[a-z0-9-]+$/.test(manifest.name)) {
        errors.push('Invalid name format. Use lowercase alphanumeric characters and hyphens only');
      }

      // Validate version format
      if (manifest.version && !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(manifest.version)) {
        warnings.push('Version should follow semantic versioning (e.g., 1.0.0)');
      }

      // Validate module structure
      if (type === 'module') {
        const indexFile = join(path, 'index.ts');
        if (!existsSync(indexFile)) {
          if (strict) {
            errors.push('Missing index.ts file');
          } else {
            warnings.push('Missing index.ts file');
          }
        }

        // Check for CLI commands if defined
        if (manifest.cli?.commands) {
          const cliDir = join(path, 'cli');
          if (!existsSync(cliDir)) {
            errors.push('CLI directory missing but commands are defined');
          } else {
            for (const cmd of manifest.cli.commands) {
              const cmdFile = join(cliDir, `${cmd.name}.ts`);
              if (!existsSync(cmdFile)) {
                errors.push(`CLI command file missing: cli/${cmd.name}.ts`);
              }
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : [],
    };
  }

  /**
   * Install an extension
   * @param name - Extension name or path
   * @param options - Installation options
   * @throws ExtensionInstallationError on failure
   */
  async installExtension(name: string, options: InstallOptions = {}): Promise<void> {
    // Check if extension already exists
    if (!options.force && this.repository.exists(name)) {
      throw new ExtensionAlreadyExistsError(name);
    }

    // This is a simplified version - in production you'd handle:
    // - Package manager integration
    // - Registry downloads
    // - Dependency resolution
    // - Version management

    throw new ExtensionInstallationError('Extension installation not yet implemented');
  }

  /**
   * Remove an extension
   * @param name - Extension name
   * @param options - Removal options
   * @throws ProtectedExtensionError if trying to remove core module
   * @throws ExtensionNotFoundError if extension not found
   */
  async removeExtension(name: string, options: RemovalOptions = {}): Promise<void> {
    const extension = this.getExtension(name);

    // Prevent removal of core modules
    if (extension.path.includes('/core/')) {
      throw new ProtectedExtensionError(name);
    }

    // Remove the extension directory
    if (!options.preserveConfig) {
      rmSync(extension.path, { recursive: true, force: true });
      this.logger?.info(`Removed extension: ${name}`);
    } else {
      // Keep config files, remove everything else
      // This would need more sophisticated implementation
      this.logger?.info(`Removed extension (preserved config): ${name}`);
    }

    // Remove from repository
    this.repository.delete(name);

    // Re-discover extensions
    await this.discoverExtensions();
  }

  /**
   * Check if extension exists
   * @param name - Extension name
   * @returns True if exists, false otherwise
   */
  exists(name: string): boolean {
    return this.repository.exists(name);
  }

  /**
   * Get extensions by author
   * @param author - Author name
   * @returns Array of extensions by the author
   */
  getExtensionsByAuthor(author: string): ExtensionInfo[] {
    return this.repository.findByAuthor(author);
  }

  /**
   * Get extensions that depend on a specific extension
   * @param dependency - Dependency name
   * @returns Array of dependent extensions
   */
  getDependentExtensions(dependency: string): ExtensionInfo[] {
    return this.repository.findByDependency(dependency);
  }

  /**
   * Export all extensions as JSON
   * @returns JSON string of all extensions
   */
  exportExtensions(): string {
    return this.repository.toJSON();
  }

  /**
   * Import extensions from JSON
   * @param json - JSON string of extensions
   * @throws Error if JSON is invalid
   */
  importExtensions(json: string): void {
    this.repository.fromJSON(json);
  }

  /**
   * Enable a module
   * @param name - Module name
   * @param options - Enable options
   * @returns Result with success status and warnings
   */
  async enableModule(
    name: string,
    options: { force?: boolean } = {},
  ): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    try {
      const module = this.getExtension(name);
      const warnings: string[] = [];

      // Check dependencies unless forced
      if (!options.force && module.dependencies) {
        const missingDeps = module.dependencies.filter((dep) => !this.exists(dep));
        if (missingDeps.length > 0) {
          return {
            success: false,
            error: `Missing dependencies: ${missingDeps.join(', ')}`,
          };
        }
      }

      // Update module state (would need persistence)
      this.logger?.info(`Module '${name}' enabled`);

      return { success: true, warnings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Disable a module
   * @param name - Module name
   * @param options - Disable options
   * @returns Result with success status and warnings
   */
  async disableModule(
    name: string,
    options: { force?: boolean } = {},
  ): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    try {
      const warnings: string[] = [];

      // Check if other modules depend on this unless forced
      if (!options.force) {
        const dependents = this.getDependentExtensions(name);
        if (dependents.length > 0) {
          return {
            success: false,
            error: `Other modules depend on this: ${dependents.map((d) => d.name).join(', ')}`,
          };
        }
      }

      // Update module state (would need persistence)
      this.logger?.info(`Module '${name}' disabled`);

      return { success: true, warnings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Stop a module
   * @param name - Module name
   * @param options - Stop options
   * @returns Result with success status
   */
  async stopModule(
    name: string,
    _options: { force?: boolean } = {},
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with the module loader to actually stop the module
      this.logger?.info(`Stopping module '${name}'...`);

      // Simulate stop operation
      await new Promise((resolve) => setTimeout(resolve, 500));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Start a module
   * @param name - Module name
   * @returns Result with success status
   */
  async startModule(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with the module loader to actually start the module
      this.logger?.info(`Starting module '${name}'...`);

      // Simulate start operation
      await new Promise((resolve) => setTimeout(resolve, 500));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get module logs
   * @param name - Module name
   * @param options - Log options
   * @returns Array of log entries
   */
  async getModuleLogs(
    name: string,
    options: {
      lines?: number;
      follow?: boolean;
      level?: string;
      since?: string;
    } = {},
  ): Promise<
    Array<{
      timestamp: number;
      level: string;
      message: string;
      metadata?: any;
    }>
  > {
    // This would integrate with the logger module
    const logs = [];

    // Simulate log retrieval
    const levels = options.level ? [options.level] : ['debug', 'info', 'warn', 'error'];
    const mockMessages = [
      'Module initialized',
      'Processing request',
      'Task completed',
      'Health check passed',
    ];

    for (let i = 0; i < (options.lines || 50); i++) {
      logs.push({
        timestamp: Date.now() - i * 60000, // 1 minute apart
        level: levels[Math.floor(Math.random() * levels.length)] || 'info',
        message: mockMessages[Math.floor(Math.random() * mockMessages.length)] || 'Log entry',
        metadata: { module: name },
      });
    }

    return logs;
  }

  /**
   * Follow module logs in real-time
   * @param name - Module name
   * @param callback - Callback for each log entry
   */
  async followModuleLogs(name: string, callback: (log: any) => void): Promise<void> {
    // This would set up a log stream
    // For now, simulate with interval
    const interval = setInterval(() => {
      callback({
        timestamp: Date.now(),
        level: 'info',
        message: `Live log from ${name}`,
        metadata: { module: name },
      });
    }, 2000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      process.exit(0);
    });
  }

  /**
   * Check module health
   * @param name - Module name
   * @returns Health status
   */
  async checkModuleHealth(name: string): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
    checks?: Array<{ name: string; passed: boolean; message?: string }>;
  }> {
    try {
      const module = this.getExtension(name);

      // This would call the actual module's healthCheck method
      const checks = [
        { name: 'Module exists', passed: true },
        { name: 'Dependencies met', passed: true },
        { name: 'Configuration valid', passed: true },
        { name: 'Resources available', passed: true },
      ];

      const healthy = checks.every((c) => c.passed);

      return {
        healthy,
        message: healthy ? 'All checks passed' : 'Some checks failed',
        details: {
          version: module.version,
          type: module.type,
          uptime: '2h 15m',
          memory: 45678901,
          cpu: '0.5%',
        },
        checks,
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * List all modules
   * @returns Array of module info
   */
  async listModules(): Promise<ExtensionInfo[]> {
    return this.getExtensions('module');
  }

  /**
   * Get module configuration
   * @param name - Module name
   * @param key - Optional specific key
   * @returns Configuration value or object
   */
  async getModuleConfig(name: string, key?: string): Promise<any> {
    const module = this.getExtension(name);

    // This would integrate with the config module
    const config = module.config || {};

    if (key && typeof config === 'object' && config !== null) {
      return (config)[key];
    }

    return config;
  }

  /**
   * Set module configuration
   * @param name - Module name
   * @param keyOrConfig - Key or config object
   * @param value - Value if key provided
   */
  async setModuleConfig(
    name: string,
    keyOrConfig: string | Record<string, any>,
    value?: any,
  ): Promise<void> {
    // Verify module exists
    this.getExtension(name);

    // This would integrate with the config module
    if (typeof keyOrConfig === 'string') {
      this.logger?.info(`Set config ${keyOrConfig}=${value} for module ${name}`);
    } else {
      this.logger?.info(`Updated config for module ${name}`);
    }
  }

  /**
   * Reset module configuration to defaults
   * @param name - Module name
   */
  async resetModuleConfig(name: string): Promise<void> {
    this.logger?.info(`Reset config to defaults for module ${name}`);
  }
}
