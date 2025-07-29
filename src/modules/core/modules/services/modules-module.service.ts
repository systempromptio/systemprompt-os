/**
 * Modules Module Service.
 * This service implements the modules module itself - the module that manages
 * all other modules in the system. It coordinates between the loader, registry,
 * and manager services.
 */

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import type { ILogger } from '@/modules/core/logger/types';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types';
import type { IModule } from '@/modules/core/modules/types';
import { ModulesStatus, ModulesType } from '@/modules/core/modules/types/database.generated';
import type { IModuleContext } from '@/modules/core/modules/types/loader.types';
import type {
  IModuleScanOptions,
  IModuleScannerService,
} from '@/modules/core/modules/types/scanner.types';
import type { IModulesModuleExports } from '@/modules/core/modules/types/modules-exports.types';
import type { ICoreModuleDefinition } from '@/types/bootstrap';
import type { IModulesRow } from '@/modules/core/modules/types/database.generated';
import { ModuleLoaderService } from '@/modules/core/modules/services/module-loader.service';
import { ModuleRegistryService } from '@/modules/core/modules/services/module-registry.service';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';
import { ModuleManagerRepository } from '@/modules/core/modules/repositories/module-manager.repository';

export class ModulesModuleService implements IModule<IModulesModuleExports> {
  private static readonly instance: ModulesModuleService;
  public readonly name = 'modules';
  public readonly version = '1.0.0';
  public readonly type = ModulesType.CORE;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private readonly logger: ILogger;
  private moduleLoaderService?: ModuleLoaderService;
  private moduleRegistryService?: ModuleRegistryService;
  private moduleManagerService?: ModuleManagerService;
  private initialized = false;
  private started = false;
  get exports(): IModulesModuleExports {
    if (!this.initialized) {
      throw new Error('Modules module not initialized');
    }

    return {
      service: () => {
        return this.createScannerService();
      },

      scanForModules: async () => {
        return await (this.moduleManagerService?.scanForModules() ?? []);
      },

      getEnabledModules: async () => {
        return await (this.moduleManagerService?.getEnabledModules() ?? []);
      },

      getModule: async (name: string) => {
        if (!this.moduleManagerService) {
          throw new Error('Module manager not initialized');
        }
        return await this.moduleManagerService.getModule(name);
      },

      enableModule: async (name: string) => {
        await this.moduleManagerService?.enableModule(name);
      },

      disableModule: async (name: string) => {
        await this.moduleManagerService?.disableModule(name);
      },

      registerCoreModule: async (name: string, path: string, dependencies?: string[]) => {
        if (!this.moduleManagerService) {
          throw new Error('Module manager not initialized');
        }

        await this.moduleManagerService.registerCoreModule(name, path, dependencies || []);

        this.logger.debug(LogSource.MODULES, `Registered core module: ${name}`, {
          path,
          dependencies: dependencies?.join(', ') || 'none',
        });
      },

      loadCoreModule: async (definition: ICoreModuleDefinition) => {
        if (!this.moduleLoaderService) {
          throw new Error('Module loader not initialized');
        }
        await this.moduleLoaderService.loadModule(definition.name, {
          enabled: true,
          autoStart: definition.critical,
          dependencies: definition.dependencies,
        });
        return this.moduleRegistryService!.get(definition.name) as IModule;
      },
      startCoreModule: async (name: string) => {
        const module = this.moduleRegistryService?.get(name);
        if (module?.start) {
          await module.start();
        }
      },

      getCoreModule: async (name: string) => {
        if (this.moduleManagerService) {
          const moduleInfo = await this.moduleManagerService.getModule(name);
          if (!moduleInfo || !moduleInfo.enabled) {
            return undefined;
          }
        }
        return this.moduleRegistryService?.get(name);
      },

      getAllCoreModules: () => {
        return this.moduleRegistryService?.getAll() ?? new Map();
      },

      registerPreLoadedModule: (_name: string, module: IModule) => {
        if (!this.moduleRegistryService) {
          throw new Error('Module registry not initialized');
        }
        this.moduleRegistryService.register(module);
      },

      getRegistry: () => {
        return this.moduleRegistryService;
      },
      getLoader: () => {
        return this.moduleLoaderService;
      },
      getManager: () => {
        return this.moduleManagerService;
      },

      validateCoreModules: async () => {
        if (!this.moduleRegistryService || !this.moduleManagerService) {
          throw new Error('Services not initialized');
        }

        const registryModules = this.moduleRegistryService.getAll();
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const [name, module] of registryModules) {
          if (module.type !== ModulesType.CORE) {
            continue;
          }

          const dbModule = await this.moduleManagerService.getModule(name);

          if (!dbModule) {
            errors.push(`Core module '${name}' not found in database`);
            continue;
          }

          if (!dbModule.enabled) {
            errors.push(`Core module '${name}' is disabled in database`);
          }

          if (dbModule.type !== ModulesType.CORE) {
            errors.push(`Module '${name}' has wrong type in database: ${dbModule.type}`);
          }

          await this.validateModuleYamlMatch(name, dbModule, warnings);
        }

        if (warnings.length > 0) {
          this.logger.warn(
            LogSource.MODULES,
            `Module configuration mismatches detected:\n${warnings.join('\n')}`,
          );
        }

        if (errors.length > 0) {
          const errorMessage = `Core module validation failed:\n${errors.join('\n')}`;
          this.logger.error(LogSource.MODULES, errorMessage);
          throw new Error(errorMessage);
        }

        this.logger.info(
          LogSource.MODULES,
          `Validated ${registryModules.size} core modules against database`,
        );
      },
    };
  }

  /**
   * Initialize the module.
   * @param context
   */
  async initialize(context?: IModuleContext): Promise<void> {
    if (this.initialized) {
      this.logger.warn(LogSource.MODULES, 'Modules module already initialized');
      return;
    }

    try {
      this.status = ModulesStatus.INITIALIZING;
      this.logger.info(LogSource.MODULES, 'Initializing modules module');

      const config = context?.config || {
        modulesConfigPath: join(process.cwd(), 'config', 'modules.json'),
        modulesPath: './src/modules',
        injectablePath: './injectable',
        extensionsPath: './extensions',
      };

      await this.initializeServices(config);

      this.initialized = true;
      this.status = ModulesStatus.STOPPED;
      this.logger.info(LogSource.MODULES, 'Modules module initialized successfully');
    } catch (error) {
      this.status = ModulesStatus.ERROR;
      this.logger.error(LogSource.MODULES, 'Failed to initialize modules module:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start the module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Modules module not initialized');
    }

    if (this.started) {
      this.logger.debug(LogSource.MODULES, 'Modules module already started');
      return;
    }

    try {
      this.status = ModulesStatus.INITIALIZING;
      this.logger.info(LogSource.MODULES, 'Starting modules module');

      if (this.moduleLoaderService) {
        await this.moduleLoaderService.loadModules();
        await this.moduleLoaderService.startModules();
      }

      this.started = true;
      this.status = ModulesStatus.RUNNING;
      this.logger.info(LogSource.MODULES, 'Modules module started successfully');
    } catch (error) {
      this.status = ModulesStatus.ERROR;
      this.logger.error(LogSource.MODULES, 'Failed to start modules module:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop the module.
   */
  async stop(): Promise<void> {
    if (!this.started) {
      this.logger.debug(LogSource.MODULES, 'Modules module not started');
      return;
    }

    try {
      this.status = ModulesStatus.STOPPING;
      this.logger.info(LogSource.MODULES, 'Stopping modules module');

      if (this.moduleLoaderService) {
        await this.moduleLoaderService.stopModules();
      }

      this.started = false;
      this.status = ModulesStatus.STOPPED;
      this.logger.info(LogSource.MODULES, 'Modules module stopped successfully');
    } catch (error) {
      this.status = ModulesStatus.ERROR;
      this.logger.error(LogSource.MODULES, 'Failed to stop modules module:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    const issues: string[] = [];

    if (!this.initialized) {
      issues.push('Not initialized');
    }

    if (!this.moduleManagerService) {
      issues.push('Module manager service not available');
    }

    if (!this.moduleLoaderService) {
      issues.push('Module loader service not available');
    }

    if (!this.moduleRegistryService) {
      issues.push('Module registry service not available');
    }

    if (this.status === ModulesStatus.ERROR) {
      issues.push('Module in error state');
    }

    return {
      healthy: issues.length === 0,
      message: issues.length > 0 ? issues.join(', ') : 'All module services operational',
    };
  }

  /**
   * Initialize all services.
   * @param config
   */
  private async initializeServices(config: any): Promise<void> {
    this.moduleRegistryService = ModuleRegistryService.getInstance();

    this.moduleLoaderService = ModuleLoaderService.getInstance(config.modulesConfigPath);

    await this.initializeModuleManager(config);
  }

  /**
   * Initialize the module manager with database support.
   * @param config
   */
  private async initializeModuleManager(config: any): Promise<void> {
    try {
      const { DatabaseService } = await import('@/modules/core/database/index');
      const databaseService = DatabaseService.getInstance();
      const moduleRepository = ModuleManagerRepository.getInstance(databaseService);

      this.moduleManagerService = ModuleManagerService.getInstance(
        {
          modulesPath: config.modulesPath || './src/modules',
          injectablePath: config.injectablePath || './injectable',
          extensionsPath: config.extensionsPath || './extensions',
        },
        this.logger,
        moduleRepository,
      );

      this.moduleManagerService.initialize();
    } catch (error) {
      this.logger.warn(
        LogSource.MODULES,
        'Could not initialize module manager (database not available):',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  /**
   * Create scanner service adapter.
   */
  private createScannerService(): IModuleScannerService | undefined {
    if (!this.moduleManagerService) {
      return undefined;
    }

    const service = this.moduleManagerService;

    return {
      scan: async (_options: IModuleScanOptions) => {
        return await service.scanForModules();
      },

      getEnabledModules: async () => {
        return await service.getEnabledModules();
      },

      updateModuleStatus: async (name: string, status: ModulesStatus, error?: string) => {
        const module = this.moduleRegistryService?.get(name);
        if (module) {
          module.status = status;
          if (error && status === ModulesStatus.ERROR) {
            this.logger.error(LogSource.MODULES, `Module ${name} error: ${error}`);
          }
        }
      },

      setModuleEnabled: async (name: string, enabled: boolean) => {
        if (enabled) {
          await service.enableModule(name);
        } else {
          await service.disableModule(name);
        }
      },

      updateModuleHealth: async (name: string, healthy: boolean, message?: string) => {
        if (!healthy) {
          this.logger.warn(
            LogSource.MODULES,
            `Module ${name} health check failed: ${message || 'No message provided'}`,
          );
        }
      },

      getModule: async (name: string) => {
        return await service.getModule(name);
      },

      getRegisteredModules: async () => {
        return await service.getEnabledModules();
      },
    };
  }

  /**
   * Validate that module.yaml matches database configuration.
   * @param name - Module name.
   * @param dbModule - Module info from database.
   * @param warnings - Array to collect warnings.
   */
  private async validateModuleYamlMatch(
    name: string,
    dbModule: IModulesRow,
    warnings: string[],
  ): Promise<void> {
    try {
      const { CORE_MODULES } = await import('@/constants/bootstrap');
      const coreModule = CORE_MODULES.find((m) => {
        return m.name === name;
      });

      if (!coreModule) {
        return;
      }

      const modulePath = coreModule.path.replace(/\/index\.(ts|js)$/, '');
      const moduleYamlPath = join(process.cwd(), modulePath, 'module.yaml');

      if (!existsSync(moduleYamlPath)) {
        warnings.push(`Module '${name}' missing module.yaml at ${moduleYamlPath}`);
        return;
      }

      const yamlContent = readFileSync(moduleYamlPath, 'utf-8');
      const yamlConfig = parse(yamlContent);

      if (yamlConfig.version && yamlConfig.version !== dbModule.version) {
        warnings.push(
          `Module '${name}' version mismatch: `
            + `YAML=${yamlConfig.version}, DB=${dbModule.version}`,
        );
      }

      const yamlDeps = yamlConfig.dependencies || [];
      const dbDeps = dbModule.dependencies ? JSON.parse(dbModule.dependencies) : [];

      if (JSON.stringify(yamlDeps.sort()) !== JSON.stringify(dbDeps.sort())) {
        warnings.push(
          `Module '${name}' dependencies mismatch: `
            + `YAML=[${yamlDeps.join(', ')}], DB=[${dbDeps.join(', ')}]`,
        );
      }

      if (yamlConfig.enabled !== undefined && yamlConfig.enabled !== dbModule.enabled) {
        warnings.push(
          `Module '${name}' enabled state mismatch: `
            + `YAML=${yamlConfig.enabled}, DB=${dbModule.enabled}`,
        );
      }
    } catch (error) {
      this.logger.warn(LogSource.MODULES, `Failed to validate YAML for module '${name}'`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
