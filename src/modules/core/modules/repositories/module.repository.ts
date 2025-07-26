/**
 * Module repository for managing module metadata.
 * Repository class for managing extension module metadata storage.
 * @file Module repository.
 * @module modules/core/modules/repositories/module.repository
 */

import type { ExtensionType, IExtensionInfo } from '@/modules/core/modules/types/index';

/**
 * Repository for managing module metadata and persistence.
 */
export class ModuleRepository {
  private readonly modules: Map<string, IExtensionInfo> = new Map();

  /**
   * Save module information.
   * @param moduleInfo - Module information to save.
   */
  save(moduleInfo: IExtensionInfo): void {
    this.modules.set(moduleInfo.name, moduleInfo);
  }

  /**
   * Find module by name.
   * @param name - Module name.
   * @returns Module information or undefined.
   */
  findByName(name: string): IExtensionInfo | undefined {
    return this.modules.get(name);
  }

  /**
   * Find all modules.
   * @returns Array of all modules.
   */
  findAll(): IExtensionInfo[] {
    return Array.from(this.modules.values());
  }

  /**
   * Find modules by type.
   * @param type - Module type to filter by.
   * @returns Array of modules matching the type.
   */
  findByType(type: ExtensionType): IExtensionInfo[] {
    return Array.from(this.modules.values()).filter(
      (moduleInfo): boolean => { return moduleInfo.type === type },
    );
  }

  /**
   * Delete module by name.
   * @param name - Module name to delete.
   * @returns True if deleted, false if not found.
   */
  delete(name: string): boolean {
    return this.modules.delete(name);
  }

  /**
   * Clear all modules.
   */
  clear(): void {
    this.modules.clear();
  }

  /**
   * Check if module exists.
   * @param name - Module name.
   * @returns True if exists, false otherwise.
   */
  exists(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * Get total count of modules.
   * @returns Number of modules.
   */
  count(): number {
    return this.modules.size;
  }

  /**
   * Find modules matching a pattern.
   * @param pattern - Regular expression pattern.
   * @returns Array of matching modules.
   */
  findByPattern(pattern: RegExp): IExtensionInfo[] {
    return Array.from(this.modules.values()).filter(
      (moduleInfo): boolean => { return pattern.test(moduleInfo.name) },
    );
  }

  /**
   * Find modules by author.
   * @param author - Author name.
   * @returns Array of modules by the author.
   */
  findByAuthor(author: string): IExtensionInfo[] {
    return Array.from(this.modules.values()).filter(
      (moduleInfo): boolean => { return moduleInfo.author === author },
    );
  }

  /**
   * Find modules with specific dependency.
   * @param dependency - Dependency name.
   * @returns Array of modules that depend on the given dependency.
   */
  findByDependency(dependency: string): IExtensionInfo[] {
    return Array.from(this.modules.values()).filter(
      (moduleInfo): boolean => { return moduleInfo.dependencies?.includes(dependency) ?? false },
    );
  }

  /**
   * Export all modules as JSON.
   * @returns JSON string of all modules.
   */
  toJsonString(): string {
    const modulesArray = Array.from(this.modules.entries()).map(
      ([, info]): IExtensionInfo => { return { ...info } },
    );
    const jsonIndent = 2;
    return JSON.stringify(modulesArray, null, jsonIndent);
  }

  /**
   * Import modules from JSON.
   * @param json - JSON string of modules.
   * @throws {Error} If JSON parsing fails.
   */
  fromJsonString(json: string): void {
    try {
      const parsedData = JSON.parse(json);
      if (!Array.isArray(parsedData)) {
        throw new Error('Expected an array of modules');
      }
      const modulesArray = parsedData as IExtensionInfo[];
      this.clear();
      modulesArray.forEach((moduleData): void => {
        this.save(moduleData);
      });
    } catch (error) {
      throw new Error(`Failed to import modules from JSON: ${String(error)}`);
    }
  }
}
