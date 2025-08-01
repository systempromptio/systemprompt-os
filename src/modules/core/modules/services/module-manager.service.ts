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
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import type { IScannedModule } from "@/modules/core/modules/types/scanner.types";
import { ModulesType } from '@/modules/core/modules/types/database.generated';
import type { ModuleManagerRepository } from
  '@/modules/core/modules/repositories/module-manager.repository';
import type { IModulesRow } from '@/modules/core/modules/types/database.generated';

/**
 * Service for managing injectable modules with database persistence.
 */
export class ModuleManagerService {
  private static instance: ModuleManagerService;
  private readonly config: {
    modulesPath: string;
    injectablePath: string;
    extensionsPath: string;
  };
  private readonly repository: ModuleManagerRepository;
  private readonly logger: ILogger;

  /**
   * Private constructor for singleton pattern.
   * @param config - Module manager configuration.
   * @param config.modulesPath
   * @param logger - Logger instance.
   * @param config.injectablePath
   * @param repository - Module manager repository.
   * @param config.extensionsPath
   */
  private constructor(
    config: {
      modulesPath: string;
      injectablePath: string;
      extensionsPath: string;
    },
    logger: ILogger,
    repository: ModuleManagerRepository
  ) {
    this.config = config;
    this.logger = logger;
    this.repository = repository;
  }

  /**
   * Get singleton instance.
   * @param config - Module manager configuration.
   * @param config.modulesPath
   * @param logger - Logger instance.
   * @param config.injectablePath
   * @param repository - Module manager repository.
   * @param config.extensionsPath
   * @returns ModuleManagerService instance.
   * @throws {Error} If required parameters are missing during initialization.
   */
  static getInstance(
    config?: {
      modulesPath: string;
      injectablePath: string;
      extensionsPath: string;
    },
    logger?: ILogger,
    repository?: ModuleManagerRepository
  ): ModuleManagerService {
    if (ModuleManagerService.instance === undefined) {
      if (config === undefined || logger === undefined || repository === undefined) {
        throw new Error(
          'ModuleManagerService not initialized - required parameters missing'
        );
      }
      ModuleManagerService.instance = new ModuleManagerService(
        config,
        logger,
        repository
      );
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
    const injectablePath = this.getInjectablePath();

    if (!this.pathExists(injectablePath)) {
      this.logPathNotFound(injectablePath);
      return modules;
    }

    try {
      const discoveredModules = this.discoverModules(injectablePath);
      modules.push(...discoveredModules);
      await this.persistModules(discoveredModules);
    } catch (error) {
      this.logScanError(error);
    }

    this.logScanComplete(modules.length);
    return modules;
  }

  /**
   * Register a core module in the database.
   * @param name - Module name.
   * @param path - Module path.
   * @param dependencies - Array of module dependencies.
   * @returns Promise that resolves when registration is complete.
   */
  async registerCoreModule(
    name: string,
    path: string,
    dependencies: string[] = []
  ): Promise<void> {
    const moduleData = this.buildCoreModuleData(name, path, dependencies);
    await this.repository.upsertModule(moduleData);
    this.logCoreModuleRegistration(name);
  }

  /**
   * Get all modules.
   * @returns Promise that resolves to array of all modules.
   */
  async getAllModules(): Promise<IModulesRow[]> {
    return await this.repository.getAllModules();
  }

  /**
   * Get all enabled modules.
   * @returns Promise that resolves to array of enabled modules.
   */
  async getEnabledModules(): Promise<IModulesRow[]> {
    return await this.repository.getEnabledModules();
  }

  /**
   * Get a specific module by name.
   * @param name - Module name.
   * @returns Promise that resolves to module info or undefined.
   */
  async getModule(name: string): Promise<IModulesRow | undefined> {
    return await this.repository.getModule(name);
  }

  /**
   * Enable a module.
   * @param name - Module name to enable.
   * @returns Promise that resolves when module is enabled.
   */
  async enableModule(name: string): Promise<void> {
    await this.repository.enableModule(name);
    this.logModuleStatusChange(name, 'enabled');
  }

  /**
   * Disable a module.
   * @param name - Module name to disable.
   * @returns Promise that resolves when module is disabled.
   */
  async disableModule(name: string): Promise<void> {
    await this.repository.disableModule(name);
    this.logModuleStatusChange(name, 'disabled');
  }

  /**
   * Get the injectable modules path.
   * @returns Resolved injectable path.
   */
  private getInjectablePath(): string {
    return resolve(process.cwd(), this.config.injectablePath);
  }

  /**
   * Check if a path exists.
   * @param path - Path to check.
   * @returns True if path exists.
   */
  private pathExists(path: string): boolean {
    return existsSync(path);
  }

  /**
   * Log debug message when injectable path is not found.
   * @param injectablePath - The path that was not found.
   */
  private logPathNotFound(injectablePath: string): void {
    this.logger.debug(
      LogSource.MODULES,
      `Optional injectable modules path does not exist: ${injectablePath} (this is normal)`
    );
  }

  /**
   * Discover modules in the given path.
   * @param injectablePath - Path to scan for modules.
   * @returns Array of discovered modules.
   */
  private discoverModules(injectablePath: string): IScannedModule[] {
    const modules: IScannedModule[] = [];
    const entries = readdirSync(injectablePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const discoveredModule = this.processModuleDirectory(
          injectablePath,
          entry.name
        );
        if (discoveredModule !== undefined) {
          modules.push(discoveredModule);
        }
      }
    }

    return modules;
  }

  /**
   * Process a single module directory.
   * @param basePath - Base path containing modules.
   * @param directoryName - Name of the module directory.
   * @returns Scanned module or undefined.
   */
  private processModuleDirectory(
    basePath: string,
    directoryName: string
  ): IScannedModule | undefined {
    const modulePath = join(basePath, directoryName);
    const moduleYaml = join(modulePath, 'module.yaml');

    if (!existsSync(moduleYaml)) {
      return undefined;
    }

    try {
      return this.parseModuleManifest(moduleYaml, modulePath);
    } catch (error) {
      this.logModuleParseError(modulePath, error);
      return undefined;
    }
  }

  /**
   * Parse module manifest file.
   * @param moduleYamlPath - Path to module.yaml file.
   * @param modulePath - Path to module directory.
   * @returns Promise that resolves to scanned module or undefined.
   */
  private parseModuleManifest(
    moduleYamlPath: string,
    modulePath: string
  ): IScannedModule | undefined {
    const content = readFileSync(moduleYamlPath, 'utf-8');
    const manifestData = parse(content);

    if (!this.isValidManifestData(manifestData)) {
      return undefined;
    }

    return this.createScannedModule(manifestData, modulePath);
  }

  /**
   * Check if manifest data is valid.
   * @param manifestData - Parsed manifest data.
   * @returns True if manifest data is valid.
   */
  private isValidManifestData(
    manifestData: unknown
  ): manifestData is Record<string, unknown> {
    return (
      typeof manifestData === 'object'
      && manifestData !== null
      && 'name' in manifestData
      && this.hasValidName(manifestData)
    );
  }

  /**
   * Check if manifest has a valid name property.
   * @param manifestData - Manifest data to check.
   * @returns True if has valid name.
   */
  private hasValidName(manifestData: Record<string, unknown>): boolean {
    const { name } = manifestData;
    return typeof name === 'string';
  }

  /**
   * Create a scanned module from manifest data.
   * @param manifestData - Parsed manifest data.
   * @param modulePath - Path to module directory.
   * @returns Scanned module object.
   */
  private createScannedModule(
    manifestData: Record<string, unknown>,
    modulePath: string
  ): IScannedModule {
    const { name, version } = manifestData;
    const scannedModule: IScannedModule = {
      name: String(name),
      version: typeof version === 'string' ? version : '1.0.0',
      type: ModulesType.SERVICE,
      path: modulePath
    };

    return this.addOptionalFields(scannedModule, manifestData);
  }

  /**
   * Add optional fields to scanned module.
   * @param scannedModule - Module to add fields to.
   * @param manifestData - Source manifest data.
   * @returns Modified scanned module with optional fields.
   */
  private addOptionalFields(
    scannedModule: IScannedModule,
    manifestData: Record<string, unknown>
  ): IScannedModule {
    const {
      dependencies,
      config,
      metadata
    } = manifestData;
    const result = { ...scannedModule };

    if (Array.isArray(dependencies)) {
      result.dependencies = dependencies;
    }
    if (this.isValidRecord(config)) {
      result.config = config;
    }
    if (this.isValidRecord(metadata)) {
      result.metadata = metadata;
    }

    return result;
  }

  /**
   * Check if value is a valid record.
   * @param value - Value to check.
   * @returns True if value is a valid record.
   */
  private isValidRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Persist discovered modules to database.
   * Uses parallel execution for better performance as module upserts are independent.
   * @param modules - Modules to persist.
   * @returns Promise that resolves when all modules are persisted.
   */
  private async persistModules(modules: IScannedModule[]): Promise<void> {
    await Promise.all(
      modules.map(async (moduleInfo: IScannedModule): Promise<void> => {
        await this.repository.upsertModule(moduleInfo);
      })
    );
  }

  /**
   * Log module parsing error.
   * @param modulePath - Path where error occurred.
   * @param error - Error that occurred.
   */
  private logModuleParseError(modulePath: string, error: unknown): void {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    this.logger.error(
      LogSource.MODULES,
      `Failed to parse module.yaml in ${modulePath}:`,
      { error: errorObject }
    );
  }

  /**
   * Log module scanning error.
   * @param error - Error that occurred during scanning.
   */
  private logScanError(error: unknown): void {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    this.logger.error(LogSource.MODULES, 'Failed to scan for modules:', {
      error: errorObject
    });
  }

  /**
   * Log scan completion.
   * @param moduleCount - Number of modules discovered.
   */
  private logScanComplete(moduleCount: number): void {
    this.logger.info(
      LogSource.MODULES,
      `Discovered ${String(moduleCount)} injectable modules`
    );
  }

  /**
   * Build core module data for registration.
   * @param name - Module name.
   * @param path - Module path.
   * @param dependencies - Module dependencies.
   * @returns Core module data.
   */
  private buildCoreModuleData(
    name: string,
    path: string,
    dependencies: string[]
  ): IScannedModule {
    const moduleData: IScannedModule = {
      name,
      version: '1.0.0',
      type: ModulesType.SERVICE,
      path,
      config: {},
      metadata: { core: true }
    };

    if (dependencies.length > 0) {
      moduleData.dependencies = dependencies;
    }

    return moduleData;
  }

  /**
   * Log core module registration.
   * @param name - Name of registered module.
   */
  private logCoreModuleRegistration(name: string): void {
    this.logger.info(
      LogSource.MODULES,
      `Registered core module '${name}' in database`
    );
  }

  /**
   * Log module status change.
   * @param name - Module name.
   * @param status - New status.
   */
  private logModuleStatusChange(name: string, status: string): void {
    this.logger.info(LogSource.MODULES, `Module '${name}' ${status}`);
  }

  /**
   * Upsert a module into the database.
   * @param moduleInfo - Module information to upsert.
   * @returns Promise that resolves when upsert is complete.
   */
  async upsertModule(moduleInfo: IScannedModule): Promise<void> {
    await this.repository.upsertModule(moduleInfo);
  }
}
