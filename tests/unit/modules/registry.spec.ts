/**
 * @fileoverview Unit tests for the simplified module registry
 * @module tests/unit/modules/registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModuleRegistry } from '../../../src/modules/registry.js';
import type { IModuleInterface, IModuleContext } from '../../../src/types/modules.js';

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;
  let mockModule: IModuleInterface;
  let mockModuleWithConfig: IModuleInterface & { _config?: any };

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ModuleRegistry();
    
    // Create a standard mock module
    mockModule = {
      name: 'test-module',
      version: '1.0.0',
      type: 'service',
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true })
    };

    // Create a mock module with config
    mockModuleWithConfig = {
      name: 'test-module-with-config',
      version: '1.0.0',
      type: 'daemon',
      _config: { enabled: true, options: { debug: true } },
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true })
    };
  });

  describe('constructor', () => {
    it('should create a new registry instance with empty modules map', () => {
      expect(registry).toBeDefined();
      expect(registry).toBeInstanceOf(ModuleRegistry);
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('register', () => {
    it('should register a service module', () => {
      registry.register(mockModule);
      expect(registry.has('test-module')).toBe(true);
      expect(registry.get('test-module')).toBe(mockModule);
    });

    it('should register a daemon module', () => {
      const daemonModule: IModuleInterface = {
        ...mockModule,
        name: 'daemon-module',
        type: 'daemon'
      };
      
      registry.register(daemonModule);
      expect(registry.has('daemon-module')).toBe(true);
      expect(registry.get('daemon-module')?.type).toBe('daemon');
    });

    it('should register a plugin module', () => {
      const pluginModule: IModuleInterface = {
        ...mockModule,
        name: 'plugin-module',
        type: 'plugin'
      };
      
      registry.register(pluginModule);
      expect(registry.has('plugin-module')).toBe(true);
      expect(registry.get('plugin-module')?.type).toBe('plugin');
    });

    it('should overwrite existing module with same name', () => {
      const firstModule = { ...mockModule, version: '1.0.0' };
      const secondModule = { ...mockModule, version: '2.0.0' };
      
      registry.register(firstModule);
      registry.register(secondModule);
      
      expect(registry.get('test-module')?.version).toBe('2.0.0');
    });
  });

  describe('get', () => {
    it('should return a registered module', () => {
      registry.register(mockModule);
      const retrieved = registry.get('test-module');
      expect(retrieved).toBe(mockModule);
    });

    it('should return undefined for non-existent module', () => {
      const module = registry.get('non-existent');
      expect(module).toBeUndefined();
    });

    it('should return undefined for empty string module name', () => {
      const module = registry.get('');
      expect(module).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no modules registered', () => {
      const modules = registry.getAll();
      expect(modules).toHaveLength(0);
      expect(Array.isArray(modules)).toBe(true);
    });

    it('should return all registered modules', () => {
      const module1 = { ...mockModule, name: 'module1' };
      const module2 = { ...mockModule, name: 'module2' };
      const module3 = { ...mockModule, name: 'module3' };
      
      registry.register(module1);
      registry.register(module2);
      registry.register(module3);
      
      const modules = registry.getAll();
      expect(modules).toHaveLength(3);
      expect(modules).toContain(module1);
      expect(modules).toContain(module2);
      expect(modules).toContain(module3);
    });

    it('should return a new array each time (not reference to internal array)', () => {
      registry.register(mockModule);
      const modules1 = registry.getAll();
      const modules2 = registry.getAll();
      
      expect(modules1).not.toBe(modules2);
      expect(modules1).toEqual(modules2);
    });
  });

  describe('has', () => {
    it('should return true for registered module', () => {
      registry.register(mockModule);
      expect(registry.has('test-module')).toBe(true);
    });

    it('should return false for non-existent module', () => {
      expect(registry.has('non-existent')).toBe(false);
    });

    it('should return false for empty string module name', () => {
      expect(registry.has('')).toBe(false);
    });

    it('should return false after module registration and then getting all modules', () => {
      registry.register(mockModule);
      registry.getAll(); // This shouldn't affect the registry state
      expect(registry.has('test-module')).toBe(true);
      expect(registry.has('different-module')).toBe(false);
    });
  });

  describe('initializeAll', () => {
    it('should initialize all modules with basic context', async () => {
      const context: IModuleContext = { 
        config: { enabled: true }
      };
      
      registry.register(mockModule);
      await registry.initializeAll(context);
      
      expect(mockModule.initialize).toHaveBeenCalledWith(context);
    });

    it('should initialize module with its _config when present', async () => {
      const baseContext: IModuleContext = { 
        config: { enabled: true }
      };
      
      registry.register(mockModuleWithConfig);
      await registry.initializeAll(baseContext);
      
      const expectedContext = {
        ...baseContext,
        config: mockModuleWithConfig._config
      };
      
      expect(mockModuleWithConfig.initialize).toHaveBeenCalledWith(expectedContext);
    });

    it('should use base context when module has undefined _config', async () => {
      const moduleWithUndefinedConfig = {
        ...mockModuleWithConfig,
        _config: undefined
      };
      
      const baseContext: IModuleContext = { 
        config: { enabled: true }
      };
      
      registry.register(moduleWithUndefinedConfig);
      await registry.initializeAll(baseContext);
      
      expect(moduleWithUndefinedConfig.initialize).toHaveBeenCalledWith(baseContext);
    });

    it('should initialize multiple modules with different configs', async () => {
      const baseContext: IModuleContext = { 
        config: { enabled: true }
      };
      
      const moduleWithoutConfig = { ...mockModule, name: 'no-config' };
      const moduleWithConfig = { ...mockModuleWithConfig, name: 'with-config' };
      
      registry.register(moduleWithoutConfig);
      registry.register(moduleWithConfig);
      
      await registry.initializeAll(baseContext);
      
      expect(moduleWithoutConfig.initialize).toHaveBeenCalledWith(baseContext);
      expect(moduleWithConfig.initialize).toHaveBeenCalledWith({
        ...baseContext,
        config: moduleWithConfig._config
      });
    });

    it('should handle empty module registry', async () => {
      const context: IModuleContext = { config: {} };
      await expect(registry.initializeAll(context)).resolves.not.toThrow();
    });

    it('should handle module initialization errors and continue with others', async () => {
      const failingModule = {
        ...mockModule,
        name: 'failing-module',
        initialize: vi.fn().mockRejectedValue(new Error('Init failed'))
      };
      
      const successModule = {
        ...mockModule,
        name: 'success-module'
      };
      
      registry.register(failingModule);
      registry.register(successModule);
      
      const context: IModuleContext = { config: {} };
      
      // Should reject because one module failed
      await expect(registry.initializeAll(context)).rejects.toThrow('Init failed');
      
      // But the successful module should still have been called
      expect(successModule.initialize).toHaveBeenCalled();
    });

    it('should pass through additional context properties', async () => {
      const context: IModuleContext = { 
        config: { enabled: true },
        logger: { info: vi.fn() },
        customProperty: 'test-value'
      };
      
      registry.register(mockModule);
      await registry.initializeAll(context);
      
      expect(mockModule.initialize).toHaveBeenCalledWith(context);
    });
  });

  describe('shutdownAll', () => {
    it('should call stop on all registered modules', async () => {
      const module1 = { ...mockModule, name: 'module1' };
      const module2 = { ...mockModule, name: 'module2' };
      
      registry.register(module1);
      registry.register(module2);
      
      await registry.shutdownAll();
      
      expect(module1.stop).toHaveBeenCalled();
      expect(module2.stop).toHaveBeenCalled();
    });

    it('should handle empty module registry', async () => {
      await expect(registry.shutdownAll()).resolves.not.toThrow();
    });

    it('should handle module stop errors and continue with others', async () => {
      const failingModule = {
        ...mockModule,
        name: 'failing-module',
        stop: vi.fn().mockRejectedValue(new Error('Stop failed'))
      };
      
      const successModule = {
        ...mockModule,
        name: 'success-module'
      };
      
      registry.register(failingModule);
      registry.register(successModule);
      
      // Should reject because one module failed to stop
      await expect(registry.shutdownAll()).rejects.toThrow('Stop failed');
      
      // But the successful module should still have been called
      expect(successModule.stop).toHaveBeenCalled();
    });

    it('should call stop method exactly once per module', async () => {
      registry.register(mockModule);
      
      await registry.shutdownAll();
      
      expect(mockModule.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete module lifecycle', async () => {
      const context: IModuleContext = { config: { enabled: true } };
      
      registry.register(mockModule);
      
      // Initialize
      await registry.initializeAll(context);
      expect(mockModule.initialize).toHaveBeenCalledWith(context);
      
      // Verify registration
      expect(registry.has('test-module')).toBe(true);
      expect(registry.getAll()).toHaveLength(1);
      
      // Shutdown
      await registry.shutdownAll();
      expect(mockModule.stop).toHaveBeenCalled();
    });

    it('should maintain module references after operations', async () => {
      registry.register(mockModule);
      
      const beforeInit = registry.get('test-module');
      await registry.initializeAll({ config: {} });
      const afterInit = registry.get('test-module');
      
      expect(beforeInit).toBe(afterInit);
      expect(beforeInit).toBe(mockModule);
    });
  });
});