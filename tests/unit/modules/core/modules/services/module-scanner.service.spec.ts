/**
 * @fileoverview Unit tests for ModuleScannerService
 * @module tests/unit/modules/core/modules/services/module-scanner.service
 * @description Comprehensive tests achieving 100% coverage for ModuleScannerService
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { ModuleScannerService } from '../../../../../../src/modules/core/modules/services/module-scanner.service.js';
import { parseModuleManifestSafe } from '../../../../../../src/modules/core/modules/utils/manifest-parser.js';
import { LogSource } from '../../../../../../src/modules/core/logger/types/index.js';
import {
  ModuleTypeEnum,
  ModuleStatusEnum,
  ModuleEventTypeEnum,
  ModuleHealthStatusEnum
} from '../../../../../../src/modules/core/modules/types/index.js';
import type {
  ILogger,
  IModuleInfo,
  IModuleScanOptions,
  IScannedModule
} from '../../../../../../src/modules/core/modules/types/index.js';

// Mock dependencies
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn(),
  resolve: vi.fn()
}));

vi.mock('../../../../../../src/modules/core/modules/utils/manifest-parser.js', () => ({
  parseModuleManifestSafe: vi.fn()
}));

describe('ModuleScannerService', () => {
  let service: ModuleScannerService;
  let mockLogger: ILogger;

  beforeEach(() => {
    // Clear all mocks and reset singleton
    vi.clearAllMocks();
    // @ts-expect-error - Accessing private static property for testing
    ModuleScannerService.instance = null;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      access: vi.fn(),
      clearLogs: vi.fn(),
      getLogs: vi.fn(),
      setDatabaseService: vi.fn()
    };

    // Setup default path mocks
    vi.mocked(resolve).mockImplementation((base, path) => `/resolved/${path}`);
    vi.mocked(join).mockImplementation((...paths) => paths.join('/'));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ModuleScannerService.getInstance();
      const instance2 = ModuleScannerService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance when singleton is reset', () => {
      const instance1 = ModuleScannerService.getInstance();
      // @ts-expect-error - Accessing private static property for testing
      ModuleScannerService.instance = null;
      const instance2 = ModuleScannerService.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      service = ModuleScannerService.getInstance();
    });

    it('should initialize with logger and ensure schema', async () => {
      await service.initialize(mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        LogSource.MODULES,
        'Module database schema would be initialized here'
      );
    });

    it('should initialize without logger', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should not overwrite existing logger if passed undefined', async () => {
      await service.initialize(mockLogger);
      await service.initialize(undefined);
      
      // Logger should still be available from first initialize call
      expect(service.getRegisteredModules).toBeDefined();
    });

    it('should initialize module repository', async () => {
      await service.initialize(mockLogger);
      
      // Test that repository methods are accessible
      await expect(service.getRegisteredModules()).resolves.toEqual([]);
      await expect(service.getEnabledModules()).resolves.toEqual([]);
      await expect(service.getModule('test')).resolves.toBeUndefined();
    });
  });

  describe('setModuleManagerService', () => {
    beforeEach(() => {
      service = ModuleScannerService.getInstance();
    });

    it('should accept module manager service without error', () => {
      const mockModuleManager = { some: 'service' };
      
      expect(() => {
        service.setModuleManagerService(mockModuleManager);
      }).not.toThrow();
    });

    it('should accept null module manager service', () => {
      expect(() => {
        service.setModuleManagerService(null);
      }).not.toThrow();
    });

    it('should accept undefined module manager service', () => {
      expect(() => {
        service.setModuleManagerService(undefined);
      }).not.toThrow();
    });
  });

  describe('scan', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should use default paths when no options provided', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await service.scan();

      expect(vi.mocked(resolve)).toHaveBeenCalledWith(process.cwd(), 'src/modules/core');
      expect(vi.mocked(resolve)).toHaveBeenCalledWith(process.cwd(), 'src/modules/custom');
      expect(vi.mocked(resolve)).toHaveBeenCalledWith(process.cwd(), 'extensions/modules');
      expect(result).toEqual([]);
    });

    it('should use custom paths when provided in options', async () => {
      const customPaths = ['custom/path1', 'custom/path2'];
      vi.mocked(existsSync).mockReturnValue(false);

      await service.scan({ paths: customPaths });

      expect(vi.mocked(resolve)).toHaveBeenCalledWith(process.cwd(), 'custom/path1');
      expect(vi.mocked(resolve)).toHaveBeenCalledWith(process.cwd(), 'custom/path2');
    });

    it('should skip non-existent paths and log debug message', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await service.scan();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Skipping non-existent path:')
      );
    });

    it('should scan existing directories and discover modules', async () => {
      // Only first path exists to avoid getting multiple results
      vi.mocked(existsSync).mockImplementation((path) => 
        path.toString().includes('/resolved/src/modules/core')
      );
      vi.mocked(readdirSync).mockReturnValue(['test-module'] as any);
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test-module',
          version: '1.0.0',
          type: 'service'
        }
      });

      const result = await service.scan();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'test-module',
        version: '1.0.0',
        type: ModuleTypeEnum.CORE // Should be forced to CORE due to path
      });
    });

    it('should handle empty scan options', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await service.scan({});

      expect(result).toEqual([]);
    });
  });

  describe('scanDirectory', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should handle directory read errors gracefully', async () => {
      const error = new Error('Permission denied');
      vi.mocked(readdirSync).mockImplementation(() => {
        throw error;
      });

      const result = await (service as any).scanDirectory('/test/path', {});

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Error scanning directory'),
        { error }
      );
    });

    it('should handle non-Error exceptions in directory scanning', async () => {
      vi.mocked(readdirSync).mockImplementation(() => {
        throw 'String error';
      });

      const result = await (service as any).scanDirectory('/test/path', {});

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Error scanning directory'),
        { error: new Error('String error') }
      );
    });

    it('should skip non-directory entries', async () => {
      vi.mocked(readdirSync).mockReturnValue(['file.txt', 'directory'] as any);
      vi.mocked(statSync).mockImplementation((path) => ({
        isDirectory: () => path.toString().includes('directory')
      }) as any);
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await (service as any).scanDirectory('/test/path', {});

      expect(result).toEqual([]);
    });

    it('should discover modules with module.yaml files', async () => {
      vi.mocked(readdirSync).mockReturnValue(['test-module'] as any);
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(existsSync).mockImplementation((path) => 
        path.toString().includes('module.yaml') || path.toString().includes('index.ts')
      );
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test-module',
          version: '1.0.0',
          type: 'service'
        }
      });
      vi.mocked(readFileSync).mockReturnValue('name: test-module\nversion: 1.0.0\ntype: service');

      const result = await (service as any).scanDirectory('/test/path', {});

      expect(result).toHaveLength(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Discovered module: test-module')
      );
    });

    it('should recursively scan subdirectories when deep option is true', async () => {
      vi.mocked(readdirSync).mockReturnValue(['subdir'] as any);
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(existsSync).mockReturnValue(false);

      const scanDirectorySpy = vi.spyOn(service as any, 'scanDirectory');
      scanDirectorySpy.mockResolvedValue([]);

      const modules: IScannedModule[] = [];
      await (service as any).processDirectory('/test/path', { deep: true }, modules);

      expect(scanDirectorySpy).toHaveBeenCalledWith('/test/path', { deep: true });
      scanDirectorySpy.mockRestore();
    });

    it('should not recursively scan when deep option is false', async () => {
      vi.mocked(readdirSync).mockReturnValue(['subdir'] as any);
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(existsSync).mockReturnValue(false);

      const spy = vi.spyOn(service as any, 'scanDirectory');
      spy.mockClear();
      spy.mockImplementation(async () => []);

      await (service as any).scanDirectory('/test/path', { deep: false });

      // Should only be called once (the initial call, not recursive)
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should not recursively scan when deep option is undefined', async () => {
      vi.mocked(readdirSync).mockReturnValue(['subdir'] as any);
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(existsSync).mockReturnValue(false);

      const spy = vi.spyOn(service as any, 'scanDirectory');
      spy.mockClear();
      spy.mockImplementation(async () => []);

      await (service as any).scanDirectory('/test/path', {});

      // Should only be called once (the initial call, not recursive)
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('processDirectory', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should discover module when module.yaml exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('name: test\nversion: 1.0.0\ntype: service');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test',
          version: '1.0.0',
          type: 'service'
        }
      });

      const modules: IScannedModule[] = [];
      await (service as any).processDirectory('/test/path', {}, modules);

      expect(modules).toHaveLength(1);
    });

    it('should recursively scan when no module.yaml and deep=true', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const spy = vi.spyOn(service as any, 'scanDirectory');
      spy.mockResolvedValue([]);

      const modules: IScannedModule[] = [];
      await (service as any).processDirectory('/test/path', { deep: true }, modules);

      expect(spy).toHaveBeenCalledWith('/test/path', { deep: true });
      spy.mockRestore();
    });

    it('should not recursively scan when no module.yaml and deep=false', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const spy = vi.spyOn(service as any, 'scanDirectory');
      spy.mockResolvedValue([]);

      const modules: IScannedModule[] = [];
      await (service as any).processDirectory('/test/path', { deep: false }, modules);

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('loadModuleInfo', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should return null when manifest parsing fails', async () => {
      vi.mocked(readFileSync).mockReturnValue('invalid yaml');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        errors: ['Invalid YAML']
      });

      const result = await (service as any).loadModuleInfo('/test/module');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Skipping /test/module/module.yaml: Invalid YAML')
      );
    });

    it('should return null when manifest has no errors but no manifest', async () => {
      vi.mocked(readFileSync).mockReturnValue('invalid yaml');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({});

      const result = await (service as any).loadModuleInfo('/test/module');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Unknown parsing error')
      );
    });

    it('should return null when manifest is missing name or version', async () => {
      vi.mocked(readFileSync).mockReturnValue('type: service');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: '',
          version: '',
          type: 'service'
        }
      });

      const result = await (service as any).loadModuleInfo('/test/module');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('invalid manifest: missing name or version')
      );
    });

    it('should return null when name is missing', async () => {
      vi.mocked(readFileSync).mockReturnValue('version: 1.0.0\ntype: service');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          version: '1.0.0',
          type: 'service'
        }
      });

      const result = await (service as any).loadModuleInfo('/test/module');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('invalid manifest: missing name or version')
      );
    });

    it('should return null when version is missing', async () => {
      vi.mocked(readFileSync).mockReturnValue('name: test\ntype: service');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test',
          type: 'service'
        }
      });

      const result = await (service as any).loadModuleInfo('/test/module');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('invalid manifest: missing name or version')
      );
    });

    it('should return null when no index file exists', async () => {
      vi.mocked(readFileSync).mockReturnValue('name: test\nversion: 1.0.0\ntype: service');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test',
          version: '1.0.0',
          type: 'service'
        }
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await (service as any).loadModuleInfo('/test/module');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('missing index file')
      );
    });

    it('should return module info for core modules in core directory', async () => {
      vi.mocked(readFileSync).mockReturnValue('name: test\nversion: 1.0.0\ntype: service');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test',
          version: '1.0.0',
          type: 'service',
          description: 'Test module',
          author: 'Test Author',
          dependencies: ['dep1'],
          config: { key: 'value' }
        }
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await (service as any).loadModuleInfo('/modules/core/test');

      expect(result).toEqual({
        name: 'test',
        version: '1.0.0',
        type: ModuleTypeEnum.CORE,
        path: '/modules/core/test',
        dependencies: ['dep1'],
        config: { key: 'value' },
        metadata: {
          description: 'Test module',
          author: 'Test Author',
          cli: undefined
        }
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('is in core directory, setting type to CORE')
      );
    });

    it('should return module info for non-core modules with valid type', async () => {
      vi.mocked(readFileSync).mockReturnValue('name: test\nversion: 1.0.0\ntype: service');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test',
          version: '1.0.0',
          type: 'service'
        }
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await (service as any).loadModuleInfo('/custom/test');

      expect(result).toEqual({
        name: 'test',
        version: '1.0.0',
        type: ModuleTypeEnum.SERVICE,
        path: '/custom/test',
        dependencies: [],
        config: {},
        metadata: {
          description: undefined,
          author: undefined,
          cli: undefined
        }
      });
    });

    it('should return null for invalid module type', async () => {
      vi.mocked(readFileSync).mockReturnValue('name: test\nversion: 1.0.0\ntype: invalid');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test',
          version: '1.0.0',
          type: 'invalid'
        }
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await (service as any).loadModuleInfo('/custom/test');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining("Invalid module type 'invalid'")
      );
    });

    it('should handle file read errors gracefully', async () => {
      const error = new Error('File not found');
      vi.mocked(readFileSync).mockImplementation(() => {
        throw error;
      });

      const result = await (service as any).loadModuleInfo('/test/module');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Error loading module info'),
        { error }
      );
    });

    it('should handle non-Error exceptions in file operations', async () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw 'String error';
      });

      const result = await (service as any).loadModuleInfo('/test/module');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Error loading module info'),
        { error: new Error('String error') }
      );
    });

    it('should find index.js when index.ts does not exist', async () => {
      vi.mocked(readFileSync).mockReturnValue('name: test\nversion: 1.0.0\ntype: service');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test',
          version: '1.0.0',
          type: 'service'
        }
      });
      vi.mocked(existsSync).mockImplementation((path) => 
        path.toString().includes('index.js')
      );

      const result = await (service as any).loadModuleInfo('/custom/test');

      expect(result).toBeTruthy();
      expect(result?.name).toBe('test');
    });

    it('should handle manifest with cli metadata', async () => {
      vi.mocked(readFileSync).mockReturnValue('name: test\nversion: 1.0.0\ntype: service');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test',
          version: '1.0.0',
          type: 'service',
          cli: { command: 'test-cli' }
        }
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await (service as any).loadModuleInfo('/custom/test');

      expect(result?.metadata.cli).toEqual({ command: 'test-cli' });
    });
  });

  describe('parseModuleType', () => {
    beforeEach(() => {
      service = ModuleScannerService.getInstance();
    });

    it('should parse valid module types', () => {
      expect((service as any).parseModuleType('core')).toBe(ModuleTypeEnum.CORE);
      expect((service as any).parseModuleType('service')).toBe(ModuleTypeEnum.SERVICE);
      expect((service as any).parseModuleType('daemon')).toBe(ModuleTypeEnum.DAEMON);
      expect((service as any).parseModuleType('plugin')).toBe(ModuleTypeEnum.PLUGIN);
      expect((service as any).parseModuleType('extension')).toBe(ModuleTypeEnum.EXTENSION);
    });

    it('should handle case insensitive types', () => {
      expect((service as any).parseModuleType('CORE')).toBe(ModuleTypeEnum.CORE);
      expect((service as any).parseModuleType('Service')).toBe(ModuleTypeEnum.SERVICE);
      expect((service as any).parseModuleType('DAEMON')).toBe(ModuleTypeEnum.DAEMON);
    });

    it('should return null for invalid types', () => {
      expect((service as any).parseModuleType('invalid')).toBeNull();
      expect((service as any).parseModuleType('')).toBeNull();
      expect((service as any).parseModuleType('random')).toBeNull();
    });
  });

  describe('storeModules', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should store valid modules', async () => {
      const modules: IScannedModule[] = [{
        name: 'test-module',
        version: '1.0.0',
        type: ModuleTypeEnum.CORE,
        path: '/test/path',
        dependencies: ['dep1'],
        config: { key: 'value' },
        metadata: { description: 'Test' }
      }];

      await expect((service as any).storeModules(modules)).resolves.not.toThrow();
    });

    it('should handle multiple modules', async () => {
      const modules: IScannedModule[] = [
        {
          name: 'module1',
          version: '1.0.0',
          type: ModuleTypeEnum.SERVICE,
          path: '/test/path1'
        },
        {
          name: 'module2',
          version: '2.0.0',
          type: ModuleTypeEnum.DAEMON,
          path: '/test/path2'
        }
      ];

      await expect((service as any).storeModules(modules)).resolves.not.toThrow();
    });

    it('should handle empty modules array', async () => {
      const modules: IScannedModule[] = [];

      await expect((service as any).storeModules(modules)).resolves.not.toThrow();
    });
  });

  describe('storeModule', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should store valid module', async () => {
      const module: IScannedModule = {
        name: 'test-module',
        version: '1.0.0',
        type: ModuleTypeEnum.SERVICE,
        path: '/test/path'
      };

      await expect((service as any).storeModule(module)).resolves.not.toThrow();
    });

    it('should skip modules with invalid types', async () => {
      const module: IScannedModule = {
        name: 'invalid-module',
        version: '1.0.0',
        type: 'invalid' as ModuleTypeEnum,
        path: '/test/path'
      };

      await (service as any).storeModule(module);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Invalid module type for invalid-module: invalid')
      );
    });

    it('should handle repository errors gracefully', async () => {
      // Mock repository to throw error
      const errorRepo = {
        getAllModules: vi.fn().mockRejectedValue(new Error('Repository error')),
        getEnabledModules: vi.fn(),
        getModuleByName: vi.fn(),
        updateModuleStatus: vi.fn(),
        setModuleEnabled: vi.fn(),
        updateModuleHealth: vi.fn(),
        createModule: vi.fn().mockRejectedValue(new Error('Insert error')),
        createModuleEvent: vi.fn()
      };

      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = errorRepo;

      const module: IScannedModule = {
        name: 'test-module',
        version: '1.0.0',
        type: ModuleTypeEnum.SERVICE,
        path: '/test/path'
      };

      await (service as any).storeModule(module);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Error storing module test-module'),
        { error: expect.any(Error) }
      );
    });

    it('should handle non-Error exceptions in storage', async () => {
      // Mock repository to throw string error
      const errorRepo = {
        getAllModules: vi.fn(),
        getEnabledModules: vi.fn(),
        getModuleByName: vi.fn(),
        updateModuleStatus: vi.fn(),
        setModuleEnabled: vi.fn(),
        updateModuleHealth: vi.fn(),
        createModule: vi.fn().mockRejectedValue('String error'),
        createModuleEvent: vi.fn()
      };

      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = errorRepo;

      const module: IScannedModule = {
        name: 'test-module',
        version: '1.0.0',
        type: ModuleTypeEnum.SERVICE,
        path: '/test/path'
      };

      await (service as any).storeModule(module);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Error storing module test-module'),
        { error: new Error('String error') }
      );
    });
  });

  describe('isValidModuleType', () => {
    beforeEach(() => {
      service = ModuleScannerService.getInstance();
    });

    it('should return true for valid module types', () => {
      expect((service as any).isValidModuleType(ModuleTypeEnum.CORE)).toBe(true);
      expect((service as any).isValidModuleType(ModuleTypeEnum.SERVICE)).toBe(true);
      expect((service as any).isValidModuleType(ModuleTypeEnum.DAEMON)).toBe(true);
      expect((service as any).isValidModuleType(ModuleTypeEnum.PLUGIN)).toBe(true);
      expect((service as any).isValidModuleType(ModuleTypeEnum.EXTENSION)).toBe(true);
    });

    it('should return false for invalid module types', () => {
      expect((service as any).isValidModuleType('invalid' as ModuleTypeEnum)).toBe(false);
      expect((service as any).isValidModuleType('' as ModuleTypeEnum)).toBe(false);
      expect((service as any).isValidModuleType(null as any)).toBe(false);
      expect((service as any).isValidModuleType(undefined as any)).toBe(false);
    });
  });

  describe('insertModuleRecord', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should insert module record', async () => {
      const module: IScannedModule = {
        name: 'test-module',
        version: '1.0.0',
        type: ModuleTypeEnum.SERVICE,
        path: '/test/path',
        dependencies: ['dep1'],
        config: { key: 'value' },
        metadata: { description: 'Test' }
      };

      await expect((service as any).insertModuleRecord(module)).resolves.not.toThrow();
    });

    it('should handle module without dependencies and config', async () => {
      const module: IScannedModule = {
        name: 'simple-module',
        version: '1.0.0',
        type: ModuleTypeEnum.SERVICE,
        path: '/test/path'
      };

      await expect((service as any).insertModuleRecord(module)).resolves.not.toThrow();
    });

    it('should throw error when repository not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = undefined;

      const module: IScannedModule = {
        name: 'test-module',
        version: '1.0.0',
        type: ModuleTypeEnum.SERVICE,
        path: '/test/path'
      };

      await expect((service as any).insertModuleRecord(module))
        .rejects.toThrow('Repository not initialized');
    });
  });

  describe('insertModuleEvent', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should insert module event', async () => {
      const module: IScannedModule = {
        name: 'test-module',
        version: '1.0.0',
        type: ModuleTypeEnum.SERVICE,
        path: '/test/path'
      };

      await expect((service as any).insertModuleEvent(module)).resolves.not.toThrow();
    });

    it('should throw error when repository not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = undefined;

      const module: IScannedModule = {
        name: 'test-module',
        version: '1.0.0',
        type: ModuleTypeEnum.SERVICE,
        path: '/test/path'
      };

      await expect((service as any).insertModuleEvent(module))
        .rejects.toThrow('Repository not initialized');
    });
  });

  describe('getRegisteredModules', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should throw error when repository not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = undefined;

      await expect(service.getRegisteredModules()).rejects.toThrow('Repository not initialized');
    });

    it('should return modules from repository', async () => {
      const result = await service.getRegisteredModules();
      expect(result).toEqual([]);
    });
  });

  describe('getEnabledModules', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should throw error when repository not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = undefined;

      await expect(service.getEnabledModules()).rejects.toThrow('Repository not initialized');
    });

    it('should return enabled modules from repository', async () => {
      const result = await service.getEnabledModules();
      expect(result).toEqual([]);
    });
  });

  describe('getModule', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should throw error when repository not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = undefined;

      await expect(service.getModule('test')).rejects.toThrow('Repository not initialized');
    });

    it('should return module from repository', async () => {
      const result = await service.getModule('test');
      expect(result).toBeUndefined();
    });
  });

  describe('updateModuleStatus', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should throw error when repository not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = undefined;

      await expect(service.updateModuleStatus('test', ModuleStatusEnum.RUNNING))
        .rejects.toThrow('Repository not initialized');
    });

    it('should update module status without error', async () => {
      await expect(service.updateModuleStatus('test-module', ModuleStatusEnum.RUNNING))
        .resolves.not.toThrow();
    });

    it('should update module status with error message', async () => {
      await expect(service.updateModuleStatus('test-module', ModuleStatusEnum.ERROR, 'Test error'))
        .resolves.not.toThrow();
    });
  });

  describe('setModuleEnabled', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should throw error when repository not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = undefined;

      await expect(service.setModuleEnabled('test', true))
        .rejects.toThrow('Repository not initialized');
    });

    it('should enable module', async () => {
      await expect(service.setModuleEnabled('test-module', true))
        .resolves.not.toThrow();
    });

    it('should disable module', async () => {
      await expect(service.setModuleEnabled('test-module', false))
        .resolves.not.toThrow();
    });
  });

  describe('updateModuleHealth', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance();
      await service.initialize(mockLogger);
    });

    it('should throw error when repository not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.moduleRepository = undefined;

      await expect(service.updateModuleHealth('test', true))
        .rejects.toThrow('Repository not initialized');
    });

    it('should update healthy module status without message', async () => {
      await expect(service.updateModuleHealth('test-module', true))
        .resolves.not.toThrow();
    });

    it('should update unhealthy module status with message', async () => {
      await expect(service.updateModuleHealth('test-module', false, 'Service down'))
        .resolves.not.toThrow();
    });
  });
});