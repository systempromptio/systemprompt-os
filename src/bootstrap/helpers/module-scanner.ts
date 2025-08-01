/**
 * Module scanner for dynamic discovery of core modules.
 * @module bootstrap/helpers/module-scanner
 */

import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import type { ICoreModuleDefinition } from '../../types/bootstrap';
import { LoggerService } from '../../modules/core/logger/services/logger.service';
import { LogSource } from '../../modules/core/logger/types/manual';

/**
 * Scanner for discovering core modules from the filesystem.
 */
export class CoreModuleScanner {
  private readonly logger = LoggerService.getInstance();
  private readonly corePath: string;

  constructor(basePath: string = process.cwd()) {
    this.corePath = resolve(basePath, 'src/modules/core');
  }

  /**
   * Scan the core modules directory and build module definitions.
   * @returns Array of core module definitions.
   */
  async scan(): Promise<ICoreModuleDefinition[]> {
    this.logger.debug(LogSource.BOOTSTRAP, 'Scanning for core modules', {
      path: this.corePath
    });

    try {
      const modules = await this.scanDirectory();
      const definitions = await Promise.all(
        modules.map(async moduleName => { return await this.buildModuleDefinition(moduleName) })
      );

      const validDefinitions = definitions.filter(def => { return def !== null });

      this.logger.info(LogSource.BOOTSTRAP, `Found ${validDefinitions.length} core modules`, {
        modules: validDefinitions.map(d => { return d.name })
      });

      return this.sortByDependencies(validDefinitions);
    } catch (error) {
      this.logger.error(LogSource.BOOTSTRAP, 'Failed to scan core modules', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Scan the core directory for module folders.
   * @returns Array of module names.
   */
  private async scanDirectory(): Promise<string[]> {
    const entries = await fs.readdir(this.corePath, { withFileTypes: true });

    const modules = [];
    for (const entry of entries) {
      if (entry.isDirectory() && await this.isValidModule(entry.name)) {
        modules.push(entry.name);
      }
    }

    return modules;
  }

  /**
   * Check if a directory is a valid module.
   * @param moduleName - Name of the module directory.
   * @returns True if valid module.
   */
  private async isValidModule(moduleName: string): Promise<boolean> {
    const indexPath = join(this.corePath, moduleName, 'index.ts');

    try {
      await fs.access(indexPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build a module definition from a module directory.
   * @param moduleName - Name of the module.
   * @returns Module definition or null if invalid.
   */
  private async buildModuleDefinition(moduleName: string): Promise<ICoreModuleDefinition | null> {
    try {
      const modulePath = join(this.corePath, moduleName);
      const moduleYamlPath = join(modulePath, 'module.yaml');

      let metadata = await this.readModuleMetadata(moduleYamlPath);

      metadata ||= this.getDefaultMetadata(moduleName);

      return {
        name: moduleName,
        path: join(modulePath, 'index.ts'),
        dependencies: metadata.dependencies || [],
        critical: metadata.critical ?? this.isCriticalModule(moduleName),
        description: metadata.description || `${moduleName} module`,
        type: 'self-contained'
      };
    } catch (error) {
      this.logger.warn(LogSource.BOOTSTRAP, `Failed to build definition for module ${moduleName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Read module metadata from module.yaml if it exists.
   * @param yamlPath - Path to module.yaml.
   * @param _yamlPath
   * @returns Module metadata or null.
   */
  private async readModuleMetadata(_yamlPath: string): Promise<any> {
    try {
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get default metadata for known modules.
   * @param moduleName - Name of the module.
   * @returns Default metadata.
   */
  private getDefaultMetadata(moduleName: string): any {
    const knownModules: Record<string, any> = {
      logger: {
        dependencies: [],
        critical: true,
        description: 'System-wide logging service - must be first for debugging'
      },
      database: {
        dependencies: ['logger'],
        critical: true,
        description: 'Persistent storage layer for all modules'
      },
      events: {
        dependencies: ['logger'],
        critical: true,
        description: 'Event bus for inter-module communication'
      },
      auth: {
        dependencies: ['logger', 'database', 'events'],
        critical: true,
        description: 'Authentication, authorization, and JWT management'
      },
      cli: {
        dependencies: ['logger', 'database'],
        critical: true,
        description: 'Command-line interface for system control'
      },
      modules: {
        dependencies: ['logger', 'database'],
        critical: true,
        description: 'Module registry and discovery service'
      },
      config: {
        dependencies: ['logger', 'database'],
        critical: false,
        description: 'Configuration management system'
      },
      permissions: {
        dependencies: ['logger', 'database', 'auth'],
        critical: false,
        description: 'Permission and access control system'
      },
      users: {
        dependencies: ['logger', 'database', 'auth'],
        critical: false,
        description: 'User management system'
      },
      agents: {
        dependencies: ['logger', 'database', 'auth', 'events'],
        critical: false,
        description: 'Agent management and task execution system'
      },
      system: {
        dependencies: ['logger', 'database'],
        critical: false,
        description: 'System monitoring and management'
      },
      tasks: {
        dependencies: ['logger', 'database'],
        critical: false,
        description: 'Task queue and execution system'
      },
      mcp: {
        dependencies: ['logger', 'database', 'modules'],
        critical: false,
        description: 'Model Context Protocol integration'
      },
      webhooks: {
        dependencies: ['logger', 'database', 'auth'],
        critical: false,
        description: 'Webhook management system'
      },
      dev: {
        dependencies: ['logger', 'database'],
        critical: false,
        description: 'Development tools and utilities'
      },
      monitor: {
        dependencies: ['logger', 'database'],
        critical: false,
        description: 'System monitoring and observability'
      }
    };

    return knownModules[moduleName] || {
      dependencies: ['logger'],
      critical: false,
      description: `${moduleName} module`
    };
  }

  /**
   * Determine if a module is critical based on its name.
   * @param moduleName - Name of the module.
   * @returns True if critical.
   */
  private isCriticalModule(moduleName: string): boolean {
    const criticalModules = ['logger', 'database', 'events', 'auth', 'cli', 'modules'];
    return criticalModules.includes(moduleName);
  }

  /**
   * Sort modules by their dependencies using topological sort.
   * @param modules - Array of module definitions.
   * @returns Sorted array of module definitions.
   */
  private sortByDependencies(modules: ICoreModuleDefinition[]): ICoreModuleDefinition[] {
    const moduleMap = new Map(modules.map(m => { return [m.name, m] }));
    const visited = new Set<string>();
    const sorted: ICoreModuleDefinition[] = [];

    const visit = (moduleName: string) => {
      if (visited.has(moduleName)) { return; }
      visited.add(moduleName);

      const module = moduleMap.get(moduleName);
      if (!module) { return; }

      for (const dep of module.dependencies) {
        visit(dep);
      }

      sorted.push(module);
    };

    for (const module of modules) {
      visit(module.name);
    }

    return sorted;
  }
}
