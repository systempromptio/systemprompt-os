/**
 * @fileoverview Module repository for managing module metadata
 * @module modules/core/modules/repositories/module.repository
 */

import type { ExtensionInfo, ExtensionType } from '../types/index.js';

/**
 * Repository for managing module metadata and persistence
 */
export class ModuleRepository {
  private readonly modules: Map<string, ExtensionInfo> = new Map();

  /**
   * Save module information
   * @param module - Module information to save
   */
  save(module: ExtensionInfo): void {
    this.modules.set(module.name, module);
  }

  /**
   * Find module by name
   * @param name - Module name
   * @returns Module information or undefined
   */
  findByName(name: string): ExtensionInfo | undefined {
    return this.modules.get(name);
  }

  /**
   * Find all modules
   * @returns Array of all modules
   */
  findAll(): ExtensionInfo[] {
    return Array.from(this.modules.values());
  }

  /**
   * Find modules by type
   * @param type - Module type to filter by
   * @returns Array of modules matching the type
   */
  findByType(type: ExtensionType): ExtensionInfo[] {
    return Array.from(this.modules.values()).filter((module) => module.type === type);
  }

  /**
   * Delete module by name
   * @param name - Module name to delete
   * @returns True if deleted, false if not found
   */
  delete(name: string): boolean {
    return this.modules.delete(name);
  }

  /**
   * Clear all modules
   */
  clear(): void {
    this.modules.clear();
  }

  /**
   * Check if module exists
   * @param name - Module name
   * @returns True if exists, false otherwise
   */
  exists(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * Get total count of modules
   * @returns Number of modules
   */
  count(): number {
    return this.modules.size;
  }

  /**
   * Find modules matching a pattern
   * @param pattern - Regular expression pattern
   * @returns Array of matching modules
   */
  findByPattern(pattern: RegExp): ExtensionInfo[] {
    return Array.from(this.modules.values()).filter((module) => pattern.test(module.name));
  }

  /**
   * Find modules by author
   * @param author - Author name
   * @returns Array of modules by the author
   */
  findByAuthor(author: string): ExtensionInfo[] {
    return Array.from(this.modules.values()).filter((module) => module.author === author);
  }

  /**
   * Find modules with specific dependency
   * @param dependency - Dependency name
   * @returns Array of modules that depend on the given dependency
   */
  findByDependency(dependency: string): ExtensionInfo[] {
    return Array.from(this.modules.values()).filter(
      (module) => module.dependencies?.includes(dependency) ?? false,
    );
  }

  /**
   * Export all modules as JSON
   * @returns JSON string of all modules
   */
  toJSON(): string {
    const modulesArray = Array.from(this.modules.entries()).map(([, info]) => ({
      ...info,
    }));
    return JSON.stringify(modulesArray, null, 2);
  }

  /**
   * Import modules from JSON
   * @param json - JSON string of modules
   */
  fromJSON(json: string): void {
    try {
      const modulesArray = JSON.parse(json) as ExtensionInfo[];
      this.clear();
      modulesArray.forEach((module) => this.save(module));
    } catch (error) {
      throw new Error(`Failed to import modules from JSON: ${error}`);
    }
  }
}
