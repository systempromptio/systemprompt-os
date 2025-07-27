import type {
  IModuleContext,
  IModuleInterface,
  IModuleWithConfig,
} from '@/types/modules';

// Re-export types for backward compatibility
export type {
  IModuleInterface as ModuleInterface,
  IModuleConfig as ModuleConfig,
  ServiceModule,
  DaemonModule,
  PluginModule,
  ExtendedModule,
} from '@/types/modules';

/**
 * Registry of core modules.
 */
export class ModuleRegistry {
  private readonly modules: Map<string, IModuleInterface> = new Map();

  /**
   * Registers a module in the registry.
   * @param module - The module to register.
   */
  public register(module: IModuleInterface): void {
    this.modules.set(module.name, module);
  }

  /**
   * Initializes all registered modules.
   * @param context - The initialization context.
   */
  public async initializeAll(context: IModuleContext): Promise<void> {
    const modulePromises = Array.from(this.modules.values()).map(async (module) => {
      const hasConfig = (mod: IModuleInterface): mod is IModuleWithConfig => {
        return '_config' in mod && mod._config !== undefined;
      };

      const moduleContext: IModuleContext = hasConfig(module) && module._config !== undefined
        ? {
            ...context,
            config: module._config,
          }
        : context;
      await module.initialize(moduleContext);
    });

    await Promise.all(modulePromises);
  }

  /**
   * Shuts down all registered modules.
   */
  public async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.modules.values()).map(async (moduleInstance) => {
      await moduleInstance.stop();
    });

    await Promise.all(shutdownPromises);
  }

  /**
   * Gets a module by name.
   * @param name - The name of the module.
   * @returns The module if found, undefined otherwise.
   */
  public get(name: string): IModuleInterface | undefined {
    return this.modules.get(name);
  }

  /**
   * Gets all registered modules.
   * @returns Array of all registered modules.
   */
  public getAll(): IModuleInterface[] {
    return Array.from(this.modules.values());
  }

  /**
   * Checks if a module is registered.
   * @param name - The name of the module.
   * @returns True if the module is registered, false otherwise.
   */
  public has(name: string): boolean {
    return this.modules.has(name);
  }
}
