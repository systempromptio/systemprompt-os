/**
 * Unit tests for CoreModuleScanner
 */

import { describe, it, expect } from 'vitest';
import { CoreModuleScanner } from '@/bootstrap/helpers/module-scanner';

describe('CoreModuleScanner', () => {
  it('should scan core modules directory', async () => {
    const scanner = new CoreModuleScanner();
    const modules = await scanner.scan();
    
    // Should find at least the critical modules
    expect(modules.length).toBeGreaterThan(0);
    
    // Check for critical modules
    const moduleNames = modules.map(m => m.name);
    expect(moduleNames).toContain('logger');
    expect(moduleNames).toContain('database');
    expect(moduleNames).toContain('modules');
    expect(moduleNames).toContain('auth');
    expect(moduleNames).toContain('cli');
    expect(moduleNames).toContain('events');
    
    // Logger should be first (no dependencies)
    expect(modules[0].name).toBe('logger');
    
    // All modules should have required properties
    for (const module of modules) {
      expect(module).toHaveProperty('name');
      expect(module).toHaveProperty('path');
      expect(module).toHaveProperty('dependencies');
      expect(module).toHaveProperty('critical');
      expect(module).toHaveProperty('description');
      expect(module).toHaveProperty('type');
    }
  });
  
  it('should sort modules by dependencies', async () => {
    const scanner = new CoreModuleScanner();
    const modules = await scanner.scan();
    
    // Create a map for easy lookup
    const moduleMap = new Map(modules.map((m, i) => [m.name, i]));
    
    // Check that dependencies come before dependents
    for (const module of modules) {
      const moduleIndex = moduleMap.get(module.name)!;
      
      for (const dep of module.dependencies) {
        const depIndex = moduleMap.get(dep);
        if (depIndex !== undefined) {
          expect(depIndex).toBeLessThan(moduleIndex);
        }
      }
    }
  });
});