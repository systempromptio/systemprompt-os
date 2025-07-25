/**
 * @fileoverview Modules module - Module lifecycle management
 * @module modules/core/modules
 */

import { Service, Inject } from 'typedi';
import type { GlobalConfiguration } from '@/modules/core/config/types/index.js';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import type { ExtensionModuleConfig, ExtensionInfo, ExtensionType } from './types/index.js';
import { ModuleManagerService } from './services/module-manager.service.js';

/**
 * Modules module for managing SystemPrompt OS modules
 */
@Service()
export class ModulesModule implements IModule {
  name = 'modules';
  version = '1.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;

  service!: ModuleManagerService; // Made public so loader can access it

  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject(TYPES.Config) private readonly globalConfig: GlobalConfiguration,
  ) {}

  /**
   * Initialize the extension module
   */
  async initialize(): Promise<void> {
    const defaultConfig: ExtensionModuleConfig = {
      modulesPath: './src/modules',
      extensionsPath: './extensions',
    };

    const config = this.globalConfig?.['modules']?.['modules']
      ? {
        ...defaultConfig,
        ...(this.globalConfig['modules']['modules'] as unknown as ExtensionModuleConfig),
      }
      : defaultConfig;

    // Initialize module manager service
    this.service = ModuleManagerService.getInstance(config, this.logger);
    await this.service.initialize();

    this.logger.info('Modules module initialized');
  }

  /**
   * Start the extension module
   */
  async start(): Promise<void> {
    this.logger.info('Modules module started');
  }

  /**
   * Stop the extension module
   */
  async stop(): Promise<void> {
    this.logger.info('Modules module stopped');
  }

  /**
   * Perform health check
   * @returns Health check result
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const extensions = this.service.getExtensions();
      return {
        healthy: true,
        message: `Managing ${extensions.length} extensions`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get all extensions
   * @param type - Optional type filter
   * @returns Array of extension information
   */
  getExtensions(type?: ExtensionType): ExtensionInfo[] {
    return this.service.getExtensions(type);
  }

  /**
   * Get extension info
   * @param name - Extension name
   * @returns Extension information or undefined
   */
  getExtension(name: string): ExtensionInfo | undefined {
    try {
      return this.service.getExtension(name);
    } catch {
      return undefined;
    }
  }

  /**
   * Validate extension structure
   * @param path - Path to extension
   * @param strict - Use strict validation
   * @returns Validation result
   */
  validateExtension(path: string, strict: boolean = false): { valid: boolean; errors: string[] } {
    const result = this.service.validateExtension(path, strict);
    return {
      valid: result.valid,
      errors: result.errors,
    };
  }

  /**
   * Install an extension
   * @param name - Extension name or path
   * @param options - Installation options
   */
  async installExtension(name: string, options: Record<string, unknown> = {}): Promise<void> {
    const installOptions: any = {};
    if ('version' in options) {installOptions.version = options['version'] as string;}
    if ('force' in options) {installOptions.force = options['force'] as boolean;}
    if ('skipDependencies' in options) {installOptions.skipDependencies = options['skipDependencies'] as boolean;}
    if ('autoEnable' in options) {installOptions.autoEnable = options['autoEnable'] as boolean;}

    await this.service.installExtension(name, installOptions);
  }

  /**
   * Remove an extension
   * @param name - Extension name
   * @param preserveConfig - Whether to preserve configuration
   */
  async removeExtension(name: string, preserveConfig: boolean = false): Promise<void> {
    await this.service.removeExtension(name, { preserveConfig });
  }

  /**
   * Get CLI command
   */
  async getCommand(): Promise<any> {
    const { createModulesCommand } = await import('./cli/index.js');
    return createModulesCommand(this.service, this.logger);
  }

  /**
   * Export extension service for direct access
   */
  get exports() {
    return {
      service: this.service,
    };
  }
}

// Re-export types for external consumption
export * from './types/index.js';

// Export services
export { MCPContentScannerService } from './services/mcp-content-scanner.service.js';
