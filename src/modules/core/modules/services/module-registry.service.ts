/**
 * ENCAPSULATED MODULE REGISTRY SERVICE.
 * This service handles registration and management of loaded modules.
 * It replaces the scattered /src/modules/registry.ts functionality.
 * ARCHITECTURAL PRINCIPLE: All module system logic is encapsulated
 * within the modules module (/src/modules/core/modules/).
 * @file Module registry service for managing loaded modules.
 * @module modules/core/modules/services/module-registry
 */

import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import type { IModule } from '@/modules/core/modules/types/manual';
import { ModulesStatus } from '@/modules/core/modules/types/manual';

/**
 * Module Registry Service.
 * Responsible for:
 * - Registering loaded modules
 * - Managing module lifecycle across the system
 * - Providing module lookup and introspection
 * - Coordinating module dependencies.
 */
export class ModuleRegistryService {
  private static instance: ModuleRegistryService | null = null;
  private readonly logger = LoggerService.getInstance();
  private readonly modules = new Map<string, IModule>();
  private readonly dependencies = new Map<string, string[]>();

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.logger.debug(LogSource.MODULES, 'Module registry initialized');
  }

  /**
   * Get singleton instance.
   */
  static getInstance(): ModuleRegistryService {
    if (ModuleRegistryService.instance === null) {
      ModuleRegistryService.instance = new ModuleRegistryService();
    }
    return ModuleRegistryService.instance;
  }

  /**
   * Register a module in the registry.
   * @param module
   */
  register(module: IModule): void {
    if (this.modules.has(module.name)) {
      this.logger.warn(LogSource.MODULES, `Module '${module.name}' is already registered, replacing`);
    }

    this.modules.set(module.name, module);
    this.logger.debug(LogSource.MODULES, `Registered module: ${module.name} (${module.type})`);
  }

  /**
   * Unregister a module from the registry.
   * @param moduleName
   */
  async unregister(moduleName: string): Promise<boolean> {
    const module = this.modules.get(moduleName);
    if (!module) {
      this.logger.warn(LogSource.MODULES, `Cannot unregister non-existent module: ${moduleName}`);
      return false;
    }

    if (module.status === ModulesStatus.RUNNING) {
      this.logger.info(LogSource.MODULES, `Stopping module before unregistering: ${moduleName}`);
      try {
        if (typeof (module as any).stop === 'function') {
          await (module as any).stop();
          this.logger.debug(LogSource.MODULES, `Successfully stopped module during unregistration: ${moduleName}`);
        } else {
          this.logger.debug(LogSource.MODULES, `Module ${moduleName} has no stop method, skipping graceful shutdown`);
        }
      } catch (error: any) {
        this.logger.warn(LogSource.MODULES, `Non-critical error stopping module '${moduleName}' during unregistration:`, { error });
      }
    }

    this.modules.delete(moduleName);
    this.dependencies.delete(moduleName);

    this.logger.info(LogSource.MODULES, `Unregistered module: ${moduleName}`);
    return true;
  }

  /**
   * Get a registered module by name.
   * @param moduleName
   */
  get(moduleName: string): IModule | undefined {
    return this.modules.get(moduleName);
  }

  /**
   * Get all registered modules.
   */
  getAll(): Map<string, IModule> {
    return new Map(this.modules);
  }

  /**
   * Get modules by type  .
   * @param type
   */
  getByType(type: string): IModule[] {
    return Array.from(this.modules.values()).filter(module => { return module.type === type });
  }

  /**
   * Get modules by status.
   * @param status
   */
  getByStatus(status: ModulesStatus): IModule[] {
    return Array.from(this.modules.values()).filter(module => { return module.status === status });
  }

  /**
   * Check if a module is registered.
   * @param moduleName
   */
  has(moduleName: string): boolean {
    return this.modules.has(moduleName);
  }

  /**
   * Get the count of registered modules.
   */
  count(): number {
    return this.modules.size;
  }

  /**
   * Set module dependencies.
   * @param moduleName
   * @param dependencies
   */
  setDependencies(moduleName: string, dependencies: string[]): void {
    if (!this.modules.has(moduleName)) {
      throw new Error(`Cannot set dependencies for non-existent module: ${moduleName}`);
    }

    this.dependencies.set(moduleName, [...dependencies]);
    this.logger.debug(LogSource.MODULES, `Set dependencies for ${moduleName}:`, { dependencies });
  }

  /**
   * Get module dependencies.
   * @param moduleName
   */
  getDependencies(moduleName: string): string[] {
    return this.dependencies.get(moduleName) ?? [];
  }

  /**
   * Resolve module dependency order for starting.
   */
  private resolveDependencyOrder(): string[] {
    const resolved: string[] = [];
    const resolving = new Set<string>();

    const resolve = (moduleName: string): void => {
      if (resolved.includes(moduleName)) {
        return;
      }

      if (resolving.has(moduleName)) {
        throw new Error(`Circular dependency detected involving module: ${moduleName}`);
      }

      resolving.add(moduleName);

      const dependencies = this.getDependencies(moduleName);
      for (const dependency of dependencies) {
        if (!this.modules.has(dependency)) {
          throw new Error(`Module '${moduleName}' depends on non-existent module: ${dependency}`);
        }
        resolve(dependency);
      }

      resolving.delete(moduleName);
      resolved.push(moduleName);
    };

    for (const moduleName of this.modules.keys()) {
      resolve(moduleName);
    }

    return resolved;
  }

  /**
   * Start all registered modules in dependency order.
   */
  async startAllModules(): Promise<void> {
    this.logger.info(LogSource.MODULES, 'Starting all registered modules');

    try {
      const startOrder = this.resolveDependencyOrder();

      for (const moduleName of startOrder) {
        const module = this.modules.get(moduleName);
        if (!module) { continue; }

        if (module.status === ModulesStatus.RUNNING) {
          this.logger.debug(LogSource.MODULES, `Module '${moduleName}' is already running`);
          continue;
        }

        try {
          this.logger.debug(LogSource.MODULES, `Starting module: ${moduleName}`);
          module.status = ModulesStatus.INITIALIZING;

          if (module.start && typeof module.start === 'function') {
            await module.start();
          } else {
            this.logger.debug(LogSource.MODULES, `Module '${moduleName}' does not have a start() method`);
          }

          module.status = ModulesStatus.RUNNING;

          this.logger.info(LogSource.MODULES, `Successfully started module: ${moduleName}`);
        } catch (error) {
          module.status = ModulesStatus.ERROR;
          this.logger.error(LogSource.MODULES, `Failed to start module '${moduleName}':`, { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      }

      this.logger.info(LogSource.MODULES, 'All modules started successfully');
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to start all modules:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Stop all registered modules in reverse dependency order.
   */
  async stopAllModules(): Promise<void> {
    this.logger.info(LogSource.MODULES, 'Stopping all registered modules');

    try {
      const stopOrder = this.resolveDependencyOrder().reverse();

      for (const moduleName of stopOrder) {
        const module = this.modules.get(moduleName);
        if (!module) { continue; }

        if (module.status !== ModulesStatus.RUNNING) {
          this.logger.debug(LogSource.MODULES, `Module '${moduleName}' is not running`);
          continue;
        }

        try {
          this.logger.debug(LogSource.MODULES, `Stopping module: ${moduleName}`);
          module.status = ModulesStatus.STOPPING;

          await (module as any).stop();
          module.status = ModulesStatus.STOPPED;

          this.logger.info(LogSource.MODULES, `Successfully stopped module: ${moduleName}`);
        } catch (error) {
          module.status = ModulesStatus.ERROR;
          this.logger.warn(LogSource.MODULES, `Non-critical error stopping module '${moduleName}':`, { error: error instanceof Error ? error.message : String(error) });
        }
      }

      this.logger.info(LogSource.MODULES, 'All modules stopped');
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to stop all modules:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Perform health check on all registered modules.
   */
  async healthCheckAll(): Promise<Map<string, { healthy: boolean; message?: string }>> {
    const results = new Map<string, { healthy: boolean; message?: string }>();

    for (const [moduleName, module] of this.modules) {
      try {
        const result = (module as any).healthCheck
          ? await (module as any).healthCheck()
          : {
 healthy: true,
message: 'No health check implemented'
};
        results.set(moduleName, result);
      } catch (error) {
        results.set(moduleName, {
          healthy: false,
          message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return results;
  }

  /**
   * Get registry statistics.
   */
  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  } {
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const module of this.modules.values()) {
      byStatus[module.status] = (byStatus[module.status] ?? 0) + 1;
      byType[module.type] = (byType[module.type] ?? 0) + 1;
    }

    return {
      total: this.modules.size,
      byStatus,
      byType,
    };
  }

  /**
   * Clear all registered modules (for testing).
   */
  clear(): void {
    this.modules.clear();
    this.dependencies.clear();
    this.logger.debug(LogSource.MODULES, 'Module registry cleared');
  }
}
