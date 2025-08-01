/**
 * Dependency resolver for module loading order.
 * @module bootstrap/helpers/dependency-resolver
 */

import type { ICoreModuleDefinition } from '@/types/bootstrap';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Error thrown when circular dependencies are detected.
 */
export class CircularDependencyError extends Error {
  constructor(public cycles: string[][]) {
    super(`Circular dependencies detected: ${cycles.map(c => { return c.join(' -> ') }).join(', ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Dependency resolver for determining module load order.
 */
export class DependencyResolver {
  private readonly logger = LoggerService.getInstance();

  /**
   * Resolve module dependencies and return sorted load order.
   * @param modules - Array of module definitions.
   * @returns Sorted array of module definitions.
   * @throws CircularDependencyError if circular dependencies are detected.
   */
  resolve(modules: ICoreModuleDefinition[]): ICoreModuleDefinition[] {
    this.logger.debug(LogSource.BOOTSTRAP, 'Resolving module dependencies', {
      moduleCount: modules.length
    });

    const graph = this.buildDependencyGraph(modules);
    const cycles = this.findCycles(graph);

    if (cycles.length > 0) {
      throw new CircularDependencyError(cycles);
    }

    const sorted = this.topologicalSort(graph);

    this.logger.debug(LogSource.BOOTSTRAP, 'Dependencies resolved', {
      loadOrder: sorted.map(m => { return m.name })
    });

    return sorted;
  }

  /**
   * Build a dependency graph from module definitions.
   * @param modules - Array of module definitions.
   * @returns Dependency graph.
   */
  private buildDependencyGraph(modules: ICoreModuleDefinition[]): Map<string, {
    module: ICoreModuleDefinition;
    dependencies: Set<string>;
    dependents: Set<string>;
  }> {
    const graph = new Map<string, {
      module: ICoreModuleDefinition;
      dependencies: Set<string>;
      dependents: Set<string>;
    }>();

    for (const module of modules) {
      graph.set(module.name, {
        module,
        dependencies: new Set(module.dependencies),
        dependents: new Set()
      });
    }

    for (const [name, node] of graph) {
      for (const dep of node.dependencies) {
        const depNode = graph.get(dep);
        if (depNode) {
          depNode.dependents.add(name);
        }
      }
    }

    return graph;
  }

  /**
   * Find circular dependencies in the graph.
   * @param graph - Dependency graph.
   * @returns Array of dependency cycles.
   */
  private findCycles(graph: Map<string, {
    module: ICoreModuleDefinition;
    dependencies: Set<string>;
    dependents: Set<string>;
  }>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const visit = (name: string, path: string[] = []): void => {
      if (stack.has(name)) {
        const cycleStart = path.indexOf(name);
        cycles.push(path.slice(cycleStart).concat(name));
        return;
      }

      if (visited.has(name)) { return; }

      visited.add(name);
      stack.add(name);
      path.push(name);

      const node = graph.get(name);
      if (node) {
        for (const dep of node.dependencies) {
          if (graph.has(dep)) {
            visit(dep, [...path]);
          }
        }
      }

      stack.delete(name);
    };

    for (const name of graph.keys()) {
      if (!visited.has(name)) {
        visit(name);
      }
    }

    return cycles;
  }

  /**
   * Perform topological sort on the dependency graph.
   * @param graph - Dependency graph.
   * @returns Sorted array of module definitions.
   */
  private topologicalSort(graph: Map<string, {
    module: ICoreModuleDefinition;
    dependencies: Set<string>;
    dependents: Set<string>;
  }>): ICoreModuleDefinition[] {
    const sorted: ICoreModuleDefinition[] = [];
    const visited = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) { return; }
      visited.add(name);

      const node = graph.get(name);
      if (!node) { return; }

      for (const dep of node.dependencies) {
        if (graph.has(dep)) {
          visit(dep);
        }
      }

      sorted.push(node.module);
    };

    const moduleNames = Array.from(graph.keys());

    moduleNames.sort();

    for (const name of moduleNames) {
      visit(name);
    }

    return sorted;
  }

  /**
   * Validate that all dependencies exist.
   * @param modules - Array of module definitions.
   * @throws Error if missing dependencies are found.
   */
  validateDependencies(modules: ICoreModuleDefinition[]): void {
    const moduleNames = new Set(modules.map(m => { return m.name }));
    const missingDeps = new Map<string, string[]>();

    for (const module of modules) {
      const missing = module.dependencies.filter(dep => { return !moduleNames.has(dep) });
      if (missing.length > 0) {
        missingDeps.set(module.name, missing);
      }
    }

    if (missingDeps.size > 0) {
      const errors = Array.from(missingDeps.entries())
        .map(([module, deps]) => { return `${module}: ${deps.join(', ')}` })
        .join('; ');
      throw new Error(`Missing dependencies: ${errors}`);
    }
  }
}
