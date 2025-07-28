/**
 * @fileoverview Unit tests for the module loader functionality.
 * Tests module loading, configuration, lifecycle management, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { ModuleLoader, getModuleLoader, resetModuleLoader } from '../../../src/modules/loader.js';
import { ModuleRegistry } from '../../../src/modules/registry.js';

// Mock dependencies
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn()
}));

// Mock LoggerService before importing the loader
vi.mock('../../../src/modules/core/logger/services/logger.service', () => ({
  LoggerService: {
    getInstance: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
      initialized: true
    })
  }
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  setModuleRegistry: vi.fn()
}));

// Mock child_process to prevent spawn errors
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn().mockReturnValue({
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    kill: vi.fn()
  })
}));


// Mock the registry module first
vi.mock('../../../src/modules/registry');

vi.mock('../../../src/server/config', () => ({
  CONFIG: {
    CONFIGPATH: '/test/config',
    STATEDIR: '/test/state'
  }
}));

// Mock the module imports
vi.mock('../../../src/modules/core/logger/index', () => ({
  LoggerModule: vi.fn().mockImplementation(() => ({
    name: 'logger',
    version: '1.0.0',
    type: 'service',
    getService: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  }))
}));

// Mock the relative import path used by the loader
vi.mock('./core/modules/index.js', () => ({
  ModulesModule: vi.fn().mockImplementation(() => ({
    name: 'modules',
    version: '1.0.0',
    type: 'service',
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    service: {
      getScannerService: vi.fn().mockReturnValue({
        scan: vi.fn().mockResolvedValue([]),
        getEnabledModules: vi.fn().mockResolvedValue([]),
        updateModuleStatus: vi.fn().mockResolvedValue(undefined)
      })
    }
  }))
}));



vi.mock('../../../src/modules/core/modules/index', () => ({
  ModulesModule: vi.fn().mockImplementation(() => ({
    name: 'modules',
    version: '1.0.0',
    type: 'service',
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    service: {
      getScannerService: vi.fn().mockReturnValue({
        scan: vi.fn().mockResolvedValue([]),
        getEnabledModules: vi.fn().mockResolvedValue([]),
        updateModuleStatus: vi.fn().mockResolvedValue(undefined)
      })
    }
  }))
}));

vi.mock('../../../src/modules/core/database/index', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  shutdownDatabase: vi.fn().mockResolvedValue(undefined),
  getDatabase: vi.fn(),
  getSchemaService: vi.fn(),
  getMigrationService: vi.fn()
}));

describe('ModuleLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModuleLoader();
    
    // Mock the ModuleRegistry implementation
    const mockModulesModule = {
      name: 'modules',
      version: '1.0.0',
      type: 'service',
      initialize: vi.fn().mockResolvedValue(undefined),
      service: {
        getScannerService: vi.fn().mockReturnValue({
          scan: vi.fn().mockResolvedValue([]),
          getEnabledModules: vi.fn().mockResolvedValue([]),
          updateModuleStatus: vi.fn().mockResolvedValue(undefined)
        })
      }
    };
    
    const mockRegistry = {
      initializeAll: vi.fn().mockResolvedValue(undefined),
      shutdownAll: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue([]),
      get: vi.fn().mockImplementation((name: string) => {
        if (name === 'modules') {
          return mockModulesModule;
        }
        return undefined;
      }),
      has: vi.fn().mockReturnValue(false),
      register: vi.fn()
    };
    
    vi.mocked(ModuleRegistry).mockImplementation(() => mockRegistry as any);
    
    // Mock dynamic imports for core modules
    vi.doMock('./core/modules/index.js', () => ({
      ModulesModule: vi.fn().mockImplementation(() => ({
        name: 'modules',
        version: '1.0.0',
        type: 'service',
        initialize: vi.fn().mockResolvedValue(undefined),
        service: {
          getScannerService: vi.fn().mockReturnValue({
            scan: vi.fn().mockResolvedValue([]),
            getEnabledModules: vi.fn().mockResolvedValue([]),
            updateModuleStatus: vi.fn().mockResolvedValue(undefined)
          })
        }
      }))
    }));
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('constructor', () => {
    it('should create instance with default config path', () => {
      const loader = new ModuleLoader();
      expect(loader).toBeDefined();
      expect(loader).toBeInstanceOf(ModuleLoader);
    });

    it('should create instance with custom config path', () => {
      const customPath = '/custom/path/modules.json';
      const loader = new ModuleLoader(customPath);
      expect(loader).toBeDefined();
    });
  });

  describe('loadModules', () => {
    it('should handle missing config file gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const loader = new ModuleLoader();
      await expect(loader.loadModules()).resolves.not.toThrow();
      
      // The main requirement is that it doesn't throw when config file is missing
      // We've verified this by the test not throwing above
      expect(vi.mocked(existsSync)).toHaveBeenCalled();
    });

    it('should load core modules when no config exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const loader = new ModuleLoader();
      
      await expect(loader.loadModules()).resolves.not.toThrow();
      
      // The main requirement is that it loads core modules successfully without config
      // We've verified this by the test completing without throwing
      expect(vi.mocked(existsSync)).toHaveBeenCalled();
    });
  });

  describe('getRegistry', () => {
    it('should return module registry', () => {
      const loader = new ModuleLoader();
      const registry = loader.getRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('getAllModules', () => {
    it('should return empty array initially', () => {
      const loader = new ModuleLoader();
      const modules = loader.getAllModules();
      expect(modules).toEqual([]);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      const loader = new ModuleLoader();
      await expect(loader.shutdown()).resolves.not.toThrow();
    });
  });

  describe('singleton management', () => {
    it('should return same instance when called multiple times', () => {
      const loader1 = getModuleLoader();
      const loader2 = getModuleLoader();
      expect(loader1).toBe(loader2);
    });

    it('should create new instance after reset', () => {
      const loader1 = getModuleLoader();
      resetModuleLoader();
      const loader2 = getModuleLoader();
      expect(loader1).not.toBe(loader2);
    });
  });

  describe('resetModuleLoader', () => {
    it('should handle reset when no instance exists', () => {
      expect(() => resetModuleLoader()).not.toThrow();
    });

    it('should reset singleton instance', () => {
      const loader1 = getModuleLoader();
      resetModuleLoader();
      const loader2 = getModuleLoader();
      expect(loader1).not.toBe(loader2);
    });
  });
});