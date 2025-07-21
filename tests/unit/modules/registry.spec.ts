/**
 * @fileoverview Unit tests for the simplified module registry
 * @module tests/unit/modules/registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all module dependencies before importing registry
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn()
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn().mockReturnValue({
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    kill: vi.fn()
  })
}));

// Import after mocks are set up
import { ModuleRegistry } from '../../../src/modules/registry.js';

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
      expect(modules).toHaveLength(4);
      
      const moduleNames = modules.map(m => m.name);
      expect(moduleNames).toContain('auth');
      expect(moduleNames).toContain('config');
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
  
  describe('initializeAll', () => {
    it('should initialize all modules', async () => {
      const context = { 
        config: {}, 
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        }
      };
      await expect(registry.initializeAll(context)).resolves.not.toThrow();
    });
  });
  
  describe('shutdownAll', () => {
    it('should stop all modules', async () => {
      await expect(registry.shutdownAll()).resolves.not.toThrow();
    });
  });

  describe('register', () => {
    it('should register a new module', () => {
      const testModule = {
        name: 'test-module',
        version: '1.0.0',
        type: 'service' as const,
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        healthCheck: vi.fn().mockResolvedValue({ healthy: true })
      };
      
      registry.register(testModule);
      expect(registry.has('test-module')).toBe(true);
      expect(registry.get('test-module')).toBe(testModule);
    });
  });
});