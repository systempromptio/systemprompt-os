/**
 * @fileoverview Unit tests for the simplified module registry
 * @module tests/unit/modules/registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModuleRegistry } from '../../../src/modules/registry.js';

// Mock all the module imports
vi.mock('../../../src/modules/core/auth/index.js', () => ({
  AuthModule: vi.fn().mockImplementation(() => ({
    name: 'auth',
    version: '1.0.0',
    type: 'service',
    initialize: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    healthCheck: vi.fn()
  }))
}));

vi.mock('../../../src/modules/core/config/index.js', () => ({
  ConfigModule: vi.fn().mockImplementation(() => ({
    name: 'config',
    version: '1.0.0',
    type: 'service',
    initialize: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    healthCheck: vi.fn()
  }))
}));

vi.mock('../../../src/modules/core/test/index.js', () => ({
  TestModule: vi.fn().mockImplementation(() => ({
    name: 'test',
    version: '1.0.0',
    type: 'service',
    initialize: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    healthCheck: vi.fn()
  }))
}));

vi.mock('../../../src/modules/core/cli/index.js', () => ({
  CLIModule: vi.fn().mockImplementation(() => ({
    name: 'cli',
    version: '1.0.0',
    type: 'service',
    initialize: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    healthCheck: vi.fn()
  }))
}));

vi.mock('../../../src/modules/core/extension/index.js', () => ({
  ExtensionModule: vi.fn().mockImplementation(() => ({
    name: 'extension',
    version: '1.0.0',
    type: 'service',
    initialize: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    healthCheck: vi.fn()
  }))
}));

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ModuleRegistry();
  });

  describe('constructor', () => {
    it('should create a new registry instance and register core modules', () => {
      expect(registry).toBeDefined();
      expect(registry).toBeInstanceOf(ModuleRegistry);
      
      // Check that all core modules are registered
      expect(registry.has('auth')).toBe(true);
      expect(registry.has('config')).toBe(true);
      expect(registry.has('test')).toBe(true);
      expect(registry.has('cli')).toBe(true);
      expect(registry.has('extension')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return a registered module', () => {
      const authModule = registry.get('auth');
      expect(authModule).toBeDefined();
      expect(authModule?.name).toBe('auth');
    });

    it('should return undefined for non-existent module', () => {
      const module = registry.get('non-existent');
      expect(module).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered modules', () => {
      const modules = registry.getAll();
      expect(modules).toHaveLength(5);
      
      const moduleNames = modules.map(m => m.name);
      expect(moduleNames).toContain('auth');
      expect(moduleNames).toContain('config');
      expect(moduleNames).toContain('test');
      expect(moduleNames).toContain('cli');
      expect(moduleNames).toContain('extension');
    });
  });

  describe('has', () => {
    it('should return true for registered module', () => {
      expect(registry.has('auth')).toBe(true);
      expect(registry.has('config')).toBe(true);
    });

    it('should return false for non-existent module', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('module interface', () => {
    it('should ensure all modules implement ModuleInterface', () => {
      const modules = registry.getAll();
      
      modules.forEach(module => {
        expect(module).toHaveProperty('name');
        expect(module).toHaveProperty('version');
        expect(module).toHaveProperty('type');
        expect(module).toHaveProperty('initialize');
        expect(module).toHaveProperty('start');
        expect(module).toHaveProperty('stop');
        expect(module).toHaveProperty('healthCheck');
        
        expect(typeof module.initialize).toBe('function');
        expect(typeof module.start).toBe('function');
        expect(typeof module.stop).toBe('function');
        expect(typeof module.healthCheck).toBe('function');
      });
    });
  });
});