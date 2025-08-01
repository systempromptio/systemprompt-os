/**
 * Parallel module loader for performance optimization.
 * Loads independent modules concurrently while respecting dependencies.
 * @module bootstrap/helpers/parallel-loader
 */

import type { ICoreModuleDefinition, CoreModuleType } from '@/types/bootstrap';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

interface LoadGroup {
  definitions: ICoreModuleDefinition[];
  dependencies: Set<string>;
}

/**
 * Groups modules by their dependency levels for parallel loading.
 * Modules in the same group have no dependencies on each other.
 * @param modules - Array of module definitions.
 * @returns Array of load groups ordered by dependency level.
 */
export function groupModulesByDependencyLevel(
  modules: ICoreModuleDefinition[]
): LoadGroup[] {
  const logger = LoggerService.getInstance();
  const groups: LoadGroup[] = [];
  const loaded = new Set<string>();
  
  // Create a map for quick lookup
  const moduleMap = new Map(modules.map(m => [m.name, m]));
  
  // Keep processing until all modules are grouped
  while (loaded.size < modules.length) {
    const currentGroup: ICoreModuleDefinition[] = [];
    const groupDeps = new Set<string>();
    
    // Find modules whose dependencies are all loaded
    for (const module of modules) {
      if (!loaded.has(module.name)) {
        const depsLoaded = module.dependencies.every(dep => 
          loaded.has(dep) || !moduleMap.has(dep)
        );
        
        if (depsLoaded) {
          currentGroup.push(module);
          module.dependencies.forEach(dep => groupDeps.add(dep));
        }
      }
    }
    
    // If no modules can be loaded, we have a circular dependency
    if (currentGroup.length === 0) {
      const unloaded = modules.filter(m => !loaded.has(m.name));
      logger.error(LogSource.BOOTSTRAP, 'Circular dependency detected', {
        unloadedModules: unloaded.map(m => m.name)
      });
      throw new Error('Circular dependency detected in module definitions');
    }
    
    // Add the current group
    groups.push({
      definitions: currentGroup,
      dependencies: groupDeps
    });
    
    // Mark these modules as loaded
    currentGroup.forEach(m => loaded.add(m.name));
  }
  
  logger.debug(LogSource.BOOTSTRAP, 'Module dependency groups created', {
    groupCount: groups.length,
    groups: groups.map(g => ({
      modules: g.definitions.map(d => d.name),
      dependencies: Array.from(g.dependencies)
    }))
  });
  
  return groups;
}

/**
 * Load modules in a group in parallel.
 * @param group - Load group containing modules to load.
 * @param loadFn - Function to load a single module.
 * @returns Map of loaded modules.
 */
export async function loadGroupInParallel(
  group: LoadGroup,
  loadFn: (definition: ICoreModuleDefinition) => Promise<CoreModuleType>
): Promise<Map<string, CoreModuleType>> {
  const logger = LoggerService.getInstance();
  const results = new Map<string, CoreModuleType>();
  
  logger.debug(LogSource.BOOTSTRAP, 'Loading module group in parallel', {
    modules: group.definitions.map(d => d.name),
    count: group.definitions.length
  });
  
  const startTime = Date.now();
  
  // Load all modules in the group concurrently
  const loadPromises = group.definitions.map(async (definition) => {
    try {
      const module = await loadFn(definition);
      return { name: definition.name, module, error: null };
    } catch (error) {
      return { 
        name: definition.name, 
        module: null, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  });
  
  const loadResults = await Promise.all(loadPromises);
  
  // Process results and handle errors
  const errors: Array<{ name: string; error: Error }> = [];
  
  for (const result of loadResults) {
    if (result.error) {
      errors.push({ name: result.name, error: result.error });
      logger.error(LogSource.BOOTSTRAP, `Failed to load module ${result.name}`, {
        error: result.error
      });
    } else if (result.module) {
      results.set(result.name, result.module);
    }
  }
  
  const duration = Date.now() - startTime;
  logger.info(LogSource.BOOTSTRAP, 'Module group loaded', {
    successful: results.size,
    failed: errors.length,
    duration: duration,
    modules: Array.from(results.keys())
  });
  
  // If any critical modules failed, throw
  if (errors.length > 0) {
    const criticalErrors = errors.filter(e => {
      const def = group.definitions.find(d => d.name === e.name);
      return def?.critical;
    });
    
    if (criticalErrors.length > 0) {
      throw new Error(
        `Critical modules failed to load: ${criticalErrors.map(e => e.name).join(', ')}`
      );
    }
  }
  
  return results;
}

/**
 * Calculate estimated time savings from parallel loading.
 * @param groups - Load groups.
 * @param avgLoadTime - Average time to load a single module in ms.
 * @returns Estimated time savings in ms.
 */
export function calculateTimeSavings(
  groups: LoadGroup[],
  avgLoadTime: number = 50
): number {
  const totalModules = groups.reduce((sum, g) => sum + g.definitions.length, 0);
  const sequentialTime = totalModules * avgLoadTime;
  
  // Parallel time is the sum of the largest module count in each group
  const parallelTime = groups.reduce((sum, _g) => {
    // Time for a group is the time of the slowest module
    return sum + avgLoadTime;
  }, 0);
  
  return sequentialTime - parallelTime;
}

/**
 * Enable caching for module discovery results.
 * @param cacheDir - Directory to store cache files.
 */
export class ModuleDiscoveryCache {
  private cache: Map<string, ICoreModuleDefinition[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Get cached module definitions.
   * @param key - Cache key.
   * @returns Cached definitions or null if not found/expired.
   */
  get(key: string): ICoreModuleDefinition[] | null {
    const expiry = this.cacheExpiry.get(key);
    
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    
    return this.cache.get(key) || null;
  }
  
  /**
   * Set cached module definitions.
   * @param key - Cache key.
   * @param definitions - Module definitions to cache.
   */
  set(key: string, definitions: ICoreModuleDefinition[]): void {
    this.cache.set(key, definitions);
    this.cacheExpiry.set(key, Date.now() + this.TTL);
  }
  
  /**
   * Clear the cache.
   */
  clear(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}