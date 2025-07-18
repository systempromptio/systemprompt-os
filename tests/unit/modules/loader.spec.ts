/**
 * @fileoverview Unit tests for the module loader functionality.
 * Tests module loading, configuration, lifecycle management, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'fs';
import { ModuleLoader, getModuleLoader, resetModuleLoader } from '../../../src/modules/loader';

// Mock dependencies
vi.mock('fs');
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  setModuleRegistry: vi.fn()
}));

vi.mock('../../../src/server/config', () => ({
  CONFIG: {
    CONFIGPATH: '/test/config',
    STATEDIR: '/test/state'
  }
}));

// Mock the module imports
vi.mock('../../../src/modules/core/logger/index', () => ({
  LoggerModule: vi.fn().mockImplementation((config: any) => ({
    name: 'logger',
    version: '1.0.0',
    type: 'service',
    config,
    getService: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  }))
}));

vi.mock('../../../src/modules/core/heartbeat/index', () => ({
  HeartbeatModule: vi.fn().mockImplementation((config: any) => ({
    name: 'heartbeat',
    version: '1.0.0',
    type: 'daemon',
    config,
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  }))
}));

describe('ModuleLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModuleLoader();
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
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      const loader = new ModuleLoader();
      await expect(loader.loadModules()).resolves.not.toThrow();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Module config not found')
      );
      
      consoleWarnSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });

    it('should load empty modules when no config exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      const loader = new ModuleLoader();
      await loader.loadModules();
      
      expect(loader.getAllModules()).toEqual([]);
      
      consoleWarnSpy.mockRestore();
      consoleInfoSpy.mockRestore();
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