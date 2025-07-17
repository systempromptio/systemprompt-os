/**
 * Module registry for managing all system modules
 */

import { Module } from '../src/interfaces/module.js';
import { ModuleRegistry as IModuleRegistry } from '../src/interfaces/registry.js';

export class ModuleRegistry implements IModuleRegistry {
  private modules: Map<string, Module> = new Map();
  
  /**
   * Register a module
   */
  register(module: Module): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Module ${module.name} is already registered`);
    }
    
    this.modules.set(module.name, module);
  }
  
  /**
   * Initialize all registered modules
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.modules.values()).map(module => 
      module.initialize().catch(err => {
        console.error(`Error initializing module ${module.name}:`, err);
        throw err;
      })
    );
    
    await Promise.all(initPromises);
  }
  
  /**
   * Get a module by name
   */
  get(name: string): Module | undefined {
    return this.modules.get(name);
  }
  
  /**
   * Get all modules of a specific type
   */
  getByType(type: 'daemon' | 'service' | 'plugin'): Module[] {
    return Array.from(this.modules.values()).filter(m => m.type === type);
  }
  
  /**
   * Get all modules
   */
  getAll(): Module[] {
    return Array.from(this.modules.values());
  }
  
  /**
   * Check if a module is registered
   */
  has(name: string): boolean {
    return this.modules.has(name);
  }
  
  /**
   * Unregister a module
   */
  unregister(name: string): boolean {
    const module = this.modules.get(name);
    if (module) {
      module.shutdown().catch(err => 
        console.error(`Error shutting down module ${name}:`, err)
      );
      this.modules.delete(name);
      return true;
    }
    return false;
  }
  
  /**
   * Shutdown all modules
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.modules.values()).map(module => 
      module.shutdown().catch(err => 
        console.error(`Error shutting down module ${module.name}:`, err)
      )
    );
    
    await Promise.all(shutdownPromises);
    this.modules.clear();
  }
}