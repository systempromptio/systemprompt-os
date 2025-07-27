/**
 * Service for scanning filesystem directories to discover available modules
 * and register them in the database for the module management system.
 * @file Module Scanner Service - Dynamically discovers and registers modules.
 * @module modules/core/modules/services/module-scanner
 */

import {
  existsSync, readFileSync, readdirSync, statSync
} from 'fs';
import { join, resolve } from 'path';
import {
  type IModuleInfo,
  type IModuleScanOptions,
  type IModuleScannerService,
  type IScannedModule,
  ModuleEventTypeEnum,
  ModuleHealthStatusEnum,
  ModuleStatusEnum,
  ModuleTypeEnum
} from '@/modules/core/modules/types/index';
import { parseModuleManifestSafe } from '@/modules/core/modules/utils/manifest-parser';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';

/**
 * Interface for module repository operations.
 */
interface IModuleRepository {
  getAllModules(): Promise<IModuleInfo[]>;
  getEnabledModules(): Promise<IModuleInfo[]>;
  getModuleByName(name: string): Promise<IModuleInfo | undefined>;
  updateModuleStatus(name: string, status: ModuleStatusEnum, error?: string): Promise<void>;
  setModuleEnabled(name: string, enabled: boolean): Promise<void>;
  updateModuleHealth(name: string, healthy: boolean, message?: string): Promise<void>;
  createModule(module: IModuleInfo): Promise<void>;
  createModuleEvent(name: string, eventType: ModuleEventTypeEnum, data: Record<string, unknown>): Promise<void>;
}

/**
 * Service for scanning and discovering available modules.
 * Implements singleton pattern as required for core modules.
 */
export class ModuleScannerService implements IModuleScannerService {
  private static instance: ModuleScannerService | null = null;
  private readonly defaultPaths = ['src/modules/core', 'src/modules/custom', 'extensions/modules'];
  private logger: ILogger | undefined;
  private moduleRepository: IModuleRepository | undefined;

  /**
   * Private constructor to enforce singleton pattern.
   * Empty by design to ensure all initialization happens in the initialize method.
   */
  private constructor() {}

  /**
   * Get singleton instance of ModuleScannerService.
   * @returns The singleton instance.
   */
  public static getInstance(): ModuleScannerService {
    ModuleScannerService.instance ??= new ModuleScannerService();
    return ModuleScannerService.instance;
  }

  /**
   * Initialize the scanner service with logger.
   * @param logger - Logger instance for service operations.
   */
  public async initialize(logger?: ILogger): Promise<void> {
    if (logger !== undefined) {
      this.logger = logger;
    }
    this.moduleRepository = {
      getAllModules: async (): Promise<IModuleInfo[]> => {
        return [];
      },
      getEnabledModules: async (): Promise<IModuleInfo[]> => {
        return [];
      },
      getModuleByName: async (name: string): Promise<IModuleInfo | undefined> => {
        void name;
        return undefined;
      },
      updateModuleStatus: async (name: string, status: ModuleStatusEnum, error?: string): Promise<void> => {
        void name;
        void status;
        void error;
      },
      setModuleEnabled: async (name: string, enabled: boolean): Promise<void> => {
        void name;
        void enabled;
      },
      updateModuleHealth: async (name: string, healthy: boolean, message?: string): Promise<void> => {
        void name;
        void healthy;
        void message;
      },
      createModule: async (module: IModuleInfo): Promise<void> => {
        void module;
      },
      createModuleEvent: async (name: string, eventType: ModuleEventTypeEnum, data: Record<string, unknown>): Promise<void> => {
        void name;
        void eventType;
        void data;
      }
    };
    this.ensureSchema();
  }

  /**
   * Set the module manager service for validation.
   * Currently unused but kept for future validation needs.
   * @param service - The module manager service instance.
   */
  public setModuleManagerService(service: unknown): void {
    void service;
  }

  /**
   * Scan for available modules.
   * @param options - Options for scanning modules.
   * @returns Promise resolving to array of scanned modules.
   */
  public async scan(options: IModuleScanOptions = {}): Promise<IScannedModule[]> {
    const paths = options.paths ?? this.defaultPaths;
    const modules: IScannedModule[] = [];

    const validPaths = paths
      .map((basePath): string => { return resolve(process.cwd(), basePath) })
      .filter((absolutePath): boolean => {
        if (existsSync(absolutePath)) {
          return true;
        }
        this.logger?.debug(
          LogSource.MODULES,
          `Skipping non-existent path: ${absolutePath}`
        );
        return false;
      });

    const scanPromises = validPaths.map(
      async (absolutePath): Promise<IScannedModule[]> => {
        return await this.scanDirectory(absolutePath, options);
      }
    );

    const scanResults = await Promise.all(scanPromises);
    for (const scannedModules of scanResults) {
      modules.push(...scannedModules);
    }

    await this.storeModules(modules);

    return modules;
  }

  /**
   * Get all registered modules from database.
   * @returns Promise resolving to array of module information.
   */
  public async getRegisteredModules(): Promise<IModuleInfo[]> {
    if (this.moduleRepository === undefined) {
      throw new Error('Repository not initialized');
    }
    return await this.moduleRepository.getAllModules();
  }

  /**
   * Get enabled modules.
   * @returns Promise resolving to array of enabled modules.
   */
  public async getEnabledModules(): Promise<IModuleInfo[]> {
    if (this.moduleRepository === undefined) {
      throw new Error('Repository not initialized');
    }
    return await this.moduleRepository.getEnabledModules();
  }

  /**
   * Get module by name.
   * @param name - The name of the module.
   * @returns Promise resolving to module information or undefined if not found.
   */
  public async getModule(name: string): Promise<IModuleInfo | undefined> {
    if (this.moduleRepository === undefined) {
      throw new Error('Repository not initialized');
    }
    return await this.moduleRepository.getModuleByName(name);
  }

  /**
   * Update module status.
   * @param name - The module name.
   * @param status - The new status.
   * @param error - Optional error message.
   */
  public async updateModuleStatus(
    name: string,
    status: ModuleStatusEnum,
    error?: string
  ): Promise<void> {
    if (this.moduleRepository === undefined) {
      throw new Error('Repository not initialized');
    }
    await this.moduleRepository.updateModuleStatus(name, status, error);
  }

  /**
   * Enable or disable a module.
   * @param name - The module name.
   * @param enabled - Whether to enable or disable.
   */
  public async setModuleEnabled(name: string, enabled: boolean): Promise<void> {
    if (this.moduleRepository === undefined) {
      throw new Error('Repository not initialized');
    }
    await this.moduleRepository.setModuleEnabled(name, enabled);
  }

  /**
   * Update module health status.
   * @param name - The module name.
   * @param healthy - Whether the module is healthy.
   * @param message - Optional health message.
   */
  public async updateModuleHealth(
    name: string,
    healthy: boolean,
    message?: string
  ): Promise<void> {
    if (this.moduleRepository === undefined) {
      throw new Error('Repository not initialized');
    }
    await this.moduleRepository.updateModuleHealth(name, healthy, message);
  }

  /**
   * Ensure database schema exists.
   */
  private ensureSchema(): void {
    this.logger?.debug(LogSource.MODULES, 'Module database schema would be initialized here');
  }

  /**
   * Scan a directory for modules.
   * @param dirPath - The directory path to scan.
   * @param options - Options for scanning modules.
   * @returns Promise resolving to array of scanned modules.
   */
  private async scanDirectory(
    dirPath: string,
    options: IModuleScanOptions,
  ): Promise<IScannedModule[]> {
    const modules: IScannedModule[] = [];

    try {
      const entries = readdirSync(dirPath);
      const modulePromises: Promise<void>[] = [];

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          modulePromises.push(
            this.processDirectory(fullPath, options, modules)
          );
        }
      }

      await Promise.all(modulePromises);
    } catch (error) {
      this.logger?.error(
        LogSource.MODULES,
        `Error scanning directory ${dirPath}:`,
        { error: error instanceof Error ? error : new Error(String(error)) }
      );
    }

    return modules;
  }

  /**
   * Process a single directory for module discovery.
   * @param fullPath - The full path to the directory.
   * @param options - Scan options.
   * @param modules - Array to push discovered modules to.
   */
  private async processDirectory(
    fullPath: string,
    options: IModuleScanOptions,
    modules: IScannedModule[]
  ): Promise<void> {
    const moduleYamlPath = join(fullPath, 'module.yaml');
    if (existsSync(moduleYamlPath)) {
      const moduleInfo = this.loadModuleInfo(fullPath);
      if (moduleInfo !== null) {
        modules.push(moduleInfo);
        this.logger?.debug(
          LogSource.MODULES,
          `Discovered module: ${moduleInfo.name} at ${fullPath}`
        );
      }
    } else if (options.deep === true) {
      const subModules = await this.scanDirectory(fullPath, options);
      modules.push(...subModules);
    }
  }

  /**
   * Load module information from a directory.
   * @param modulePath - The path to the module directory.
   * @returns Scanned module or null if invalid.
   */
  private loadModuleInfo(modulePath: string): IScannedModule | null {
    try {
      const moduleYamlPath = join(modulePath, 'module.yaml');
      const moduleYaml = readFileSync(moduleYamlPath, 'utf-8');
      const parseResult = parseModuleManifestSafe(moduleYaml);

      if (!parseResult.manifest) {
        this.logger?.warn(
          LogSource.MODULES,
          `Skipping ${moduleYamlPath}: ${parseResult.errors?.join(', ') ?? 'Unknown parsing error'}`
        );
        return null;
      }

      const { manifest } = parseResult;

      if (!manifest.name || !manifest.version) {
        this.logger?.error(
          LogSource.MODULES,
          `Module at ${modulePath} has invalid manifest: missing name or version`
        );
        return null;
      }

      const indexPath = join(modulePath, 'index.ts');
      const indexJsPath = join(modulePath, 'index.js');

      if (!existsSync(indexPath) && !existsSync(indexJsPath)) {
        this.logger?.warn(
          LogSource.MODULES,
          `Module ${manifest.name} missing index file at ${modulePath}`
        );
        return null;
      }

      const isCore = modulePath.includes('/modules/core/');
      let moduleType: ModuleTypeEnum;

      if (isCore) {
        moduleType = ModuleTypeEnum.CORE;
        this.logger?.debug(
          LogSource.MODULES,
          `Module ${manifest.name} is in core directory, setting type to CORE`
        );
      } else {
        const parsedType = this.parseModuleType(manifest.type);
        if (parsedType === null) {
          this.logger?.error(
            LogSource.MODULES,
            `Invalid module type '${manifest.type}' for module ${manifest.name}`
          );
          return null;
        }
        moduleType = parsedType;
      }

      return {
        name: manifest.name,
        version: manifest.version,
        type: moduleType,
        path: modulePath,
        dependencies: manifest.dependencies ?? [],
        config: manifest.config ?? {},
        metadata: {
          description: manifest.description,
          author: manifest.author,
          cli: manifest.cli,
        },
      };
    } catch (error) {
      this.logger?.error(
        LogSource.MODULES,
        `Error loading module info from ${modulePath}:`,
        { error: error instanceof Error ? error : new Error(String(error)) }
      );
      return null;
    }
  }

  /**
   * Parse module type string to enum.
   * @param type - The module type string.
   * @returns The parsed module type or null if invalid.
   */
  private parseModuleType(type: string): ModuleTypeEnum | null {
    const typeMap: Record<string, ModuleTypeEnum> = {
      core: ModuleTypeEnum.CORE,
      service: ModuleTypeEnum.SERVICE,
      daemon: ModuleTypeEnum.DAEMON,
      plugin: ModuleTypeEnum.PLUGIN,
      extension: ModuleTypeEnum.EXTENSION,
    };

    return typeMap[type.toLowerCase()] ?? null;
  }

  /**
   * Store discovered modules in database.
   * @param modules - Array of scanned modules to store.
   */
  private async storeModules(modules: IScannedModule[]): Promise<void> {
    await Promise.all(modules.map(async (mod): Promise<void> => {
      await this.storeModule(mod);
    }));
  }

  /**
   * Store a single module in the database.
   * @param mod - The module to store.
   */
  private async storeModule(mod: IScannedModule): Promise<void> {
    try {
      if (!this.isValidModuleType(mod.type)) {
        this.logger?.error(
          LogSource.MODULES,
          `Invalid module type for ${mod.name}: ${mod.type}`
        );
        return;
      }

      await this.insertModuleRecord(mod);
      await this.insertModuleEvent(mod);
    } catch (error) {
      this.logger?.error(
        LogSource.MODULES,
        `Error storing module ${mod.name}:`,
        { error: error instanceof Error ? error : new Error(String(error)) }
      );
    }
  }

  /**
   * Validate if the module type is supported.
   * @param type - The module type to validate.
   * @returns True if valid, false otherwise.
   */
  private isValidModuleType(type: ModuleTypeEnum): boolean {
    const validTypes = [
      ModuleTypeEnum.CORE,
      ModuleTypeEnum.SERVICE,
      ModuleTypeEnum.DAEMON,
      ModuleTypeEnum.PLUGIN,
      ModuleTypeEnum.EXTENSION
    ];
    return validTypes.includes(type);
  }

  /**
   * Insert module record into database.
   * @param mod - The module to insert.
   */
  private async insertModuleRecord(mod: IScannedModule): Promise<void> {
    if (this.moduleRepository === undefined) {
      throw new Error('Repository not initialized');
    }
    await this.moduleRepository.createModule({
      name: mod.name,
      version: mod.version,
      type: mod.type,
      path: mod.path,
      enabled: true,
      autoStart: false,
      dependencies: mod.dependencies ?? [],
      config: mod.config ?? {},
      status: ModuleStatusEnum.INSTALLED,
      healthStatus: ModuleHealthStatusEnum.UNKNOWN,
      metadata: mod.metadata ?? {},
    });
  }

  /**
   * Insert module discovery event into database.
   * @param mod - The module that was discovered.
   */
  private async insertModuleEvent(mod: IScannedModule): Promise<void> {
    if (this.moduleRepository === undefined) {
      throw new Error('Repository not initialized');
    }
    await this.moduleRepository.createModuleEvent(
      mod.name,
      ModuleEventTypeEnum.DISCOVERED,
      {
        version: mod.version,
        path: mod.path
      }
    );
  }
}
