/**
 * Module Setup Service.
 * Handles database seeding and maintenance for the module system.
 * This service manages the initial setup and cleanup of module data.
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ICoreModuleDefinition } from '@/types/bootstrap';
import type { IScannedModule } from '@/modules/core/modules/types/scanner.types';
import { ModulesType } from '@/modules/core/modules/types/database.generated';
import { ModuleManagerRepository } from '@/modules/core/modules/repositories/module-manager.repository';
import { CORE_MODULES } from '@/constants/bootstrap';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

export class ModuleSetupService {
  private static instance: ModuleSetupService;
  private readonly logger: ILogger;
  private readonly repository: ModuleManagerRepository;

  private constructor(
    private readonly database: DatabaseService
  ) {
    this.logger = LoggerService.getInstance();
    this.repository = ModuleManagerRepository.getInstance(database);
  }

  /**
   * Get singleton instance.
   * @param database
   */
  public static getInstance(database?: DatabaseService): ModuleSetupService {
    if (!ModuleSetupService.instance) {
      if (!database) {
        throw new Error('Database service required for initialization');
      }
      ModuleSetupService.instance = new ModuleSetupService(database);
    }
    return ModuleSetupService.instance;
  }

  /**
   * Install core modules - seeds the database with core module definitions.
   * This should only be run once during initial system setup.
   */
  async install(): Promise<void> {
    this.logger.info(LogSource.MODULES, 'Installing core modules in database');

    try {
      const existingModules = await this.repository.getAllModules();
      const coreModules = existingModules.filter(m => { return m.type === ModulesType.CORE });

      if (coreModules.length > 0) {
        this.logger.warn(
          LogSource.MODULES,
          `Found ${coreModules.length} existing core modules. Use clean() to rebuild.`
        );
        return;
      }

      for (const coreModule of CORE_MODULES) {
        await this.seedCoreModule(coreModule);
      }

      this.logger.info(
        LogSource.MODULES,
        `Successfully installed ${CORE_MODULES.length} core modules`
      );
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to install core modules:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clean and rebuild module database.
   * WARNING: This will remove all module data and reseed core modules.
   */
  async clean(): Promise<void> {
    this.logger.warn(LogSource.MODULES, 'Cleaning module database - all module data will be lost');

    try {
      await this.database.execute('DELETE FROM modules');
      await this.database.execute('DELETE FROM module_events');
      await this.database.execute('DELETE FROM module_dependencies');

      this.logger.info(LogSource.MODULES, 'Module database cleaned');

      await this.install();
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to clean module database:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update core module definitions.
   * This updates existing core modules without deleting extension modules.
   */
  async update(): Promise<void> {
    this.logger.info(LogSource.MODULES, 'Updating core module definitions');

    try {
      for (const coreModule of CORE_MODULES) {
        const existing = await this.repository.getModule(coreModule.name);

        if (existing && existing.type === ModulesType.CORE) {
          await this.updateCoreModule(coreModule, existing);
        } else if (!existing) {
          await this.seedCoreModule(coreModule);
        }
      }

      this.logger.info(LogSource.MODULES, 'Core modules updated successfully');
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to update core modules:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate database state matches expected core modules.
   * @throws Error if validation fails.
   */
  async validate(): Promise<void> {
    const errors: string[] = [];

    try {
      for (const coreModule of CORE_MODULES) {
        const dbModule = await this.repository.getModule(coreModule.name);

        if (!dbModule) {
          errors.push(`Core module '${coreModule.name}' not found in database`);
        } else if (dbModule.type !== ModulesType.CORE) {
          errors.push(`Module '${coreModule.name}' has wrong type: ${dbModule.type}`);
        } else if (!dbModule.enabled && coreModule.critical) {
          errors.push(`Critical module '${coreModule.name}' is disabled`);
        }
      }

      if (errors.length > 0) {
        const errorMessage = `Module database validation failed:\n${errors.join('\n')}`;
        throw new Error(errorMessage);
      }

      this.logger.info(
        LogSource.MODULES,
        `Validated ${CORE_MODULES.length} core modules in database`
      );
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Module validation failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Seed a core module into the database.
   * Reads module configuration from module.yaml file.
   * @param definition
   */
  private async seedCoreModule(definition: ICoreModuleDefinition): Promise<void> {
    const modulePath = definition.path.replace(/\/index\.(ts|js)$/, '');
    const moduleYamlPath = join(process.cwd(), modulePath, 'module.yaml');

    let moduleConfig: any = {};
    let moduleVersion = '1.0.0';
    let moduleDescription = definition.description || '';

    if (existsSync(moduleYamlPath)) {
      try {
        const yamlContent = readFileSync(moduleYamlPath, 'utf-8');
        const parsedYaml = parse(yamlContent);

        moduleConfig = parsedYaml.config || {};
        moduleVersion = parsedYaml.version || '1.0.0';
        moduleDescription = parsedYaml.description || moduleDescription;

        this.logger.debug(
          LogSource.MODULES,
          `Read module.yaml for ${definition.name}`,
          { path: moduleYamlPath }
        );
      } catch (error) {
        this.logger.warn(
          LogSource.MODULES,
          `Failed to read module.yaml for ${definition.name}`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    const moduleInfo: IScannedModule = {
      name: definition.name,
      path: definition.path,
      version: moduleVersion,
      type: ModulesType.CORE,
      dependencies: definition.dependencies || [],
      config: moduleConfig,
      metadata: {
        critical: definition.critical || false,
        description: moduleDescription,
        seededAt: new Date().toISOString()
      }
    };

    await this.repository.upsertModule(moduleInfo);

    this.logger.debug(
      LogSource.MODULES,
      `Seeded core module: ${definition.name}`,
      {
 critical: definition.critical,
version: moduleVersion
}
    );
  }

  /**
   * Update an existing core module.
   * @param definition
   * @param existing
   */
  private async updateCoreModule(
    definition: ICoreModuleDefinition,
    existing: any
  ): Promise<void> {
    const moduleInfo: IScannedModule = {
      name: definition.name,
      path: definition.path,
      version: existing.version || '1.0.0',
      type: ModulesType.CORE,
      dependencies: definition.dependencies || [],
      config: existing.config || {},
      metadata: {
        ...existing.metadata,
        critical: definition.critical || false,
        description: definition.description || '',
        updatedAt: new Date().toISOString()
      }
    };

    await this.repository.upsertModule(moduleInfo);

    this.logger.debug(
      LogSource.MODULES,
      `Updated core module: ${definition.name}`
    );
  }
}
