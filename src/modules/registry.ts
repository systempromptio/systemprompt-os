/**
 * Module configuration interface.
 */
export interface ModuleConfig {
  enabled?: boolean;
  options?: Record<string, any>;
}

/**
 * Module interface for core modules.
 */
export interface ModuleInterface {
  name: string;
  version: string;
  type: 'service' | 'daemon' | 'plugin';
  initialize(context: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Service module type.
 */
export type ServiceModule = ModuleInterface & {
  type: 'service';
};

/**
 * Daemon module type.
 */
export type DaemonModule = ModuleInterface & {
  type: 'daemon';
};

/**
 * Plugin module type.
 */
export type PluginModule = ModuleInterface & {
  type: 'plugin';
};

/**
 * Extended module type for loader.
 */
export type ExtendedModule = ModuleInterface & {
  config?: ModuleConfig;
  exports?: any;
};

/**
 * Registry of core modules.
 */
export class ModuleRegistry {
  private readonly modules: Map<string, ModuleInterface> = new Map();

  constructor() {
    /*
     * Core modules are now handled by bootstrap
     * this.registerCoreModules();
     */
  }

  register(module: ModuleInterface): void {
    this.modules.set(module.name, module);
  }

  async initializeAll(context: any): Promise<void> {
    for (const module of this.modules.values()) {
      // Check if module has stored config
      const moduleWithConfig = module as any;
      const moduleContext = moduleWithConfig._config
        ? {
            ...context,
            config: moduleWithConfig._config,
          }
        : context;
      await module.initialize(moduleContext);
    }
  }

  async shutdownAll(): Promise<void> {
    for (const module of this.modules.values()) {
      await module.stop();
    }
  }

  get(name: string): ModuleInterface | undefined {
    return this.modules.get(name);
  }

  getAll(): ModuleInterface[] {
    return Array.from(this.modules.values());
  }

  has(name: string): boolean {
    return this.modules.has(name);
  }
}
