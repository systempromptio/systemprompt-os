/**
 * @fileoverview Extension repository for managing extension metadata
 * @module modules/core/extension/repositories/extension.repository
 */

import { ExtensionInfo, ExtensionType } from '@/modules/core/extension/types';

/**
 * Repository for managing extension metadata and persistence
 */
export class ExtensionRepository {
  private extensions: Map<string, ExtensionInfo> = new Map();

  /**
   * Save extension information
   * @param extension - Extension information to save
   */
  save(extension: ExtensionInfo): void {
    this.extensions.set(extension.name, extension);
  }

  /**
   * Find extension by name
   * @param name - Extension name
   * @returns Extension information or undefined
   */
  findByName(name: string): ExtensionInfo | undefined {
    return this.extensions.get(name);
  }

  /**
   * Find all extensions
   * @returns Array of all extensions
   */
  findAll(): ExtensionInfo[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Find extensions by type
   * @param type - Extension type to filter by
   * @returns Array of extensions matching the type
   */
  findByType(type: ExtensionType): ExtensionInfo[] {
    return Array.from(this.extensions.values()).filter(ext => ext.type === type);
  }

  /**
   * Delete extension by name
   * @param name - Extension name to delete
   * @returns True if deleted, false if not found
   */
  delete(name: string): boolean {
    return this.extensions.delete(name);
  }

  /**
   * Clear all extensions
   */
  clear(): void {
    this.extensions.clear();
  }

  /**
   * Check if extension exists
   * @param name - Extension name
   * @returns True if exists, false otherwise
   */
  exists(name: string): boolean {
    return this.extensions.has(name);
  }

  /**
   * Get total count of extensions
   * @returns Number of extensions
   */
  count(): number {
    return this.extensions.size;
  }

  /**
   * Find extensions matching a pattern
   * @param pattern - Regular expression pattern
   * @returns Array of matching extensions
   */
  findByPattern(pattern: RegExp): ExtensionInfo[] {
    return Array.from(this.extensions.values()).filter(ext => pattern.test(ext.name));
  }

  /**
   * Find extensions by author
   * @param author - Author name
   * @returns Array of extensions by the author
   */
  findByAuthor(author: string): ExtensionInfo[] {
    return Array.from(this.extensions.values()).filter(ext => ext.author === author);
  }

  /**
   * Find extensions with specific dependency
   * @param dependency - Dependency name
   * @returns Array of extensions that depend on the given dependency
   */
  findByDependency(dependency: string): ExtensionInfo[] {
    return Array.from(this.extensions.values()).filter(
      ext => ext.dependencies?.includes(dependency) ?? false
    );
  }

  /**
   * Export all extensions as JSON
   * @returns JSON string of all extensions
   */
  toJSON(): string {
    const extensionsArray = Array.from(this.extensions.entries()).map(([name, info]) => ({
      name,
      ...info
    }));
    return JSON.stringify(extensionsArray, null, 2);
  }

  /**
   * Import extensions from JSON
   * @param json - JSON string of extensions
   */
  fromJSON(json: string): void {
    try {
      const extensionsArray = JSON.parse(json) as ExtensionInfo[];
      this.clear();
      extensionsArray.forEach(ext => this.save(ext));
    } catch (error) {
      throw new Error(`Failed to import extensions from JSON: ${error}`);
    }
  }
}