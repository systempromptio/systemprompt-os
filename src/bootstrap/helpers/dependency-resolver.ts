/**
 * Simple dependency resolver for module loading order.
 * @module bootstrap/helpers/dependency-resolver
 */

import type { ICoreModuleDefinition } from '../../types/bootstrap';

/**
 * Simple dependency resolver that performs topological sort.
 */
export class DependencyResolver {
  /**
   * Resolve module dependencies and return sorted load order.
   * @param modules - Array of module definitions.
   * @returns Sorted array of module definitions.
   * @throws Error if circular dependencies are detected.
   */
  resolve(modules: ICoreModuleDefinition[]): ICoreModuleDefinition[] {
    const sorted: ICoreModuleDefinition[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (module: ICoreModuleDefinition): void => {
      if (visited.has(module.name)) { return; }

      if (visiting.has(module.name)) {
        throw new Error(`Circular dependency detected: ${module.name}`);
      }

      visiting.add(module.name);

      for (const depName of module.dependencies) {
        const dep = modules.find(m => { return m.name === depName });
        if (dep) {
          visit(dep);
        }
      }

      visiting.delete(module.name);
      visited.add(module.name);
      sorted.push(module);
    };

    for (const module of modules) {
      visit(module);
    }

    return sorted;
  }
}
