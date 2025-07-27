/**
 * Module manager service for managing injectable modules.
 * Service for managing injectable modules with database persistence.
 * @file Module manager service.
 * @module modules/core/modules/services/module-manager.service
 */

import {
 existsSync, readFileSync, readdirSync
} from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type { DatabaseService } from '@/modules/core/database/index';
import type {
  IModuleInfo,
  IScannedModule
} from '@/modules/core/modules/types/index';
import { ModuleTypeEnum } from '@/modules/core/modules/types/index';
import type {
  IModuleManagerConfig
} from '@/modules/core/modules/types/module-manager.types';
import { ModuleManagerRepository } from '@/modules/core/modules/repositories/module-manager.repository';

/**
 * Service for managing injectable modules with database persistence.
 */
export class ModuleManagerService {
  private static instance: ModuleManagerService;
  private readonly config: IModuleManagerConfig;
  private readonly repository: ModuleManagerRepository;

  /**
   * Private constructor for singleton pattern.
   * @param config - Module manager configuration.
   * @param logger - Logger instance.
   * @param repository - Module manager repository.
   */
  private constructor(
    config: IModuleManagerConfig,
    private readonly logger: ILogger,
    repository: ModuleManagerRepository
  ) {
    this.config = config;
    this.repository = repository;
  }

  /**
   * Get singleton instance.
   * @param config - Module manager configuration.
   * @param logger - Logger instance.
   * @param database - Database service instance.
   * @returns ModuleManagerService instance.
   */
  static getInstance(config?: IModuleManagerConfig, logger?: ILogger, database?: DatabaseService): ModuleManagerService {
    if (!ModuleManagerService.instance) {
      if (!config || !logger || !database) {
        throw new Error('ModuleManagerService not initialized - required parameters missing');
      }
      const repository = ModuleManagerRepository.getInstance(database);
      ModuleManagerService.instance = new ModuleManagerService(config, logger, repository);
    }
    return ModuleManagerService.instance;
  }

  /**
   * Initialize the service and create database tables if needed.
   * @returns Promise that resolves when initialization is complete.
   */
  initialize(): void {
    this.logger.info(LogSource.MODULES, 'Module manager service initialized');
  }

  /**
   * Scan for injectable modules.
   * @returns Promise that resolves to array of scanned modules.
   */
  async scanForModules(): Promise<IScannedModule[]> {
    const modules: IScannedModule[] = [];
    const injectablePath = resolve(process.cwd(), this.config.injectablePath);

    if (!existsSync(injectablePath)) {
      this.logger.warn(LogSource.MODULES, `Injectable modules path does not exist: ${injectablePath}`);
      return modules;
    }

    try {
      const entries = readdirSync(injectablePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const modulePath = join(injectablePath, entry.name);
          const moduleYaml = join(modulePath, 'module.yaml');

          if (existsSync(moduleYaml)) {
            try {
              const content = readFileSync(moduleYaml, 'utf-8');
              const manifestData = parse(content);

              if (manifestData && manifestData.name) {
                const scannedModule: IScannedModule = {
                  name: manifestData.name as string,
                  version: (manifestData.version as string | undefined) ?? '1.0.0',
                  type: ModuleTypeEnum.SERVICE,
                  path: modulePath
                };

                if (manifestData.dependencies) {
                  scannedModule.dependencies = manifestData.dependencies as string[];
                }
                if (manifestData.config) {
                  scannedModule.config = manifestData.config as Record<string, unknown>;
                }
                if (manifestData.metadata) {
                  scannedModule.metadata = manifestData.metadata as Record<string, unknown>;
                }

                modules.push(scannedModule);

                await this.repository.upsertModule(scannedModule);
              }
            } catch (error) {
              const errorObject = error instanceof Error ? error : new Error(String(error));
              this.logger.error(LogSource.MODULES, `Failed to parse module.yaml in ${modulePath}:`, {
                error: errorObject
              });
            }
          }
        }
      }
    } catch (error) {
      const errorObject = error instanceof Error ? error : new Error(String(error));
      this.logger.error(LogSource.MODULES, 'Failed to scan for modules:', {
        error: errorObject
      });
    }

    this.logger.info(LogSource.MODULES, `Discovered ${modules.length} injectable modules`);
    return modules;
  }

  /**
   * Register a core module in the database.
   * @param name - Module name.
   * @param path - Module path.
   * @param dependencies - Array of module dependencies.
   * @returns Promise that resolves when registration is complete.
   */
  async registerCoreModule(name: string, path: string, dependencies: string[] = []): Promise<void> {
    const moduleData: IScannedModule = {
      name,
      version: '1.0.0',
      type: ModuleTypeEnum.SERVICE,
      path
    };

    if (dependencies.length > 0) {
      moduleData.dependencies = dependencies;
    }
    moduleData.config = {};
    moduleData.metadata = { core: true };

    await this.repository.upsertModule(moduleData);
    this.logger.info(LogSource.MODULES, `Registered core module '${name}' in database`);
  }

  /**
   * Get all modules.
   * @returns Promise that resolves to array of all modules.
   */
  async getAllModules(): Promise<IModuleInfo[]> {
    return await this.repository.getAllModules();
  }

  /**
   * Get all enabled modules.
   * @returns Promise that resolves to array of enabled modules.
   */
  async getEnabledModules(): Promise<IModuleInfo[]> {
    return await this.repository.getEnabledModules();
  }

  /**
   * Get a specific module by name.
   * @param name - Module name.
   * @returns Promise that resolves to module info or undefined.
   */
  async getModule(name: string): Promise<IModuleInfo | undefined> {
    return await this.repository.getModule(name);
  }

  /**
   * Enable a module.
   * @param name - Module name to enable.
   * @returns Promise that resolves when module is enabled.
   */
  async enableModule(name: string): Promise<void> {
    await this.repository.enableModule(name);
    this.logger.info(LogSource.MODULES, `Module '${name}' enabled`);
  }

  /**
   * Disable a module.
   * @param name - Module name to disable.
   * @returns Promise that resolves when module is disabled.
   */
  async disableModule(name: string): Promise<void> {
    await this.repository.disableModule(name);
    this.logger.info(LogSource.MODULES, `Module '${name}' disabled`);
  }
}
