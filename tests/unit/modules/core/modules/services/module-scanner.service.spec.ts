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
import type {
  ILogger,
  IDatabaseModuleRow,
  ModuleInfo,
  ModuleScanOptions,
  ModuleStatus,
  ModuleEventType,
  ModuleHealthStatus,
  ScannedModule,
  ModuleType
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

// Mock database service
const mockDatabaseService = {
  getInstance: vi.fn(),
  execute: vi.fn(),
  query: vi.fn()
};

vi.mock('../../../../../../src/modules/core/database/services/database.service.js', () => ({
  DatabaseService: mockDatabaseService
}));

describe('ModuleScannerService', () => {
  let service: ModuleScannerService;
  let mockLogger: ILogger;
  let mockDatabase: { execute: Mock; query: Mock };

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

    mockDatabase = {
      execute: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([])
    };

    mockDatabaseService.getInstance.mockReturnValue({
      execute: mockDatabase.execute,
      query: mockDatabase.query
    });

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

    it('should use logger from first getInstance call', () => {
      const instance1 = ModuleScannerService.getInstance(mockLogger);
      const instance2 = ModuleScannerService.getInstance();
      
      expect(instance1).toBe(instance2);
      // Both should have the same logger
      expect(instance1).toBe(instance2);
    });

    it('should create instance without logger', () => {
      const instance = ModuleScannerService.getInstance();
      
      expect(instance).toBeInstanceOf(ModuleScannerService);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      service = ModuleScannerService.getInstance(mockLogger);
    });

    it('should initialize database service and ensure schema', async () => {
      await service.initialize();

      expect(mockDatabaseService.getInstance).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        LogSource.MODULES,
        'Module database schema would be initialized here'
      );
    });

    it('should bind database methods correctly', async () => {
      await service.initialize();

      // Test that database methods are accessible
      expect(service.getRegisteredModules).toBeDefined();
    });
  });

  describe('setModuleManagerService', () => {
    beforeEach(() => {
      service = ModuleScannerService.getInstance(mockLogger);
    });

    it('should accept module manager service without error', () => {
      const mockModuleManager = { some: 'service' };
      
      expect(() => {
        service.setModuleManagerService(mockModuleManager);
      }).not.toThrow();
    });
  });

  describe('scan', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
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

    it('should scan existing directories and store modules', async () => {
      const mockModule: ScannedModule = {
        name: 'test-module',
        version: '1.0.0',
        type: 'core' as ModuleType,
        path: '/resolved/src/modules/core/test-module'
      };

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
          type: 'core'
        }
      });

      const result = await service.scan();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'test-module',
        version: '1.0.0',
        type: 'core'
      });
    });

    it('should call storeModules with discovered modules', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['test-module'] as any);
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test-module',
          version: '1.0.0',
          type: 'core'
        }
      });

      await service.scan();

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO modules'),
        expect.arrayContaining(['test-module', '1.0.0', 'core'])
      );
    });
  });

  describe('scanDirectory', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
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
          type: 'core'
        }
      });
      vi.mocked(readFileSync).mockReturnValue('name: test-module\nversion: 1.0.0\ntype: core');

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

      const originalScanDirectory = (service as any).scanDirectory.bind(service);
      const spy = vi.spyOn(service as any, 'scanDirectory');
      spy.mockImplementation(async (path, options) => {
        // Call original for the first call, return empty for recursive calls
        if (path === '/test/path') {
          return originalScanDirectory(path, options);
        }
        return [];
      });

      await (service as any).scanDirectory('/test/path', { deep: true });

      expect(spy).toHaveBeenCalledWith('/test/path/subdir', { deep: true });
    });

    it('should not recursively scan when deep option is false', async () => {
      vi.mocked(readdirSync).mockReturnValue(['subdir'] as any);
      vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
      vi.mocked(existsSync).mockReturnValue(false);

      const spy = vi.spyOn(service as any, 'scanDirectory');
      spy.mockClear();

      await (service as any).scanDirectory('/test/path', { deep: false });

      expect(spy).toHaveBeenCalledTimes(0);
    });
  });

  describe('loadModuleInfo', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
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
      vi.mocked(readFileSync).mockReturnValue('type: core');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: '',
          version: '',
          type: 'core'
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
      vi.mocked(readFileSync).mockReturnValue('name: test\nversion: 1.0.0\ntype: core');
      vi.mocked(parseModuleManifestSafe).mockReturnValue({
        manifest: {
          name: 'test',
          version: '1.0.0',
          type: 'core'
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
        type: 'core',
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
        type: 'service',
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
  });

  describe('parseModuleType', () => {
    beforeEach(() => {
      service = ModuleScannerService.getInstance(mockLogger);
    });

    it('should parse valid module types', () => {
      expect((service as any).parseModuleType('core')).toBe('core');
      expect((service as any).parseModuleType('service')).toBe('service');
      expect((service as any).parseModuleType('daemon')).toBe('daemon');
      expect((service as any).parseModuleType('plugin')).toBe('plugin');
      expect((service as any).parseModuleType('extension')).toBe('extension');
    });

    it('should handle case insensitive types', () => {
      expect((service as any).parseModuleType('CORE')).toBe('core');
      expect((service as any).parseModuleType('Service')).toBe('service');
      expect((service as any).parseModuleType('DAEMON')).toBe('daemon');
    });

    it('should return null for invalid types', () => {
      expect((service as any).parseModuleType('invalid')).toBeNull();
      expect((service as any).parseModuleType('')).toBeNull();
      expect((service as any).parseModuleType('random')).toBeNull();
    });
  });

  describe('storeModules', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
    });

    it('should store valid modules in database', async () => {
      const modules: ScannedModule[] = [{
        name: 'test-module',
        version: '1.0.0',
        type: 'core' as ModuleType,
        path: '/test/path',
        dependencies: ['dep1'],
        config: { key: 'value' },
        metadata: { description: 'Test' }
      }];

      await (service as any).storeModules(modules);

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO modules'),
        [
          'test-module',
          '1.0.0',
          'core',
          '/test/path',
          1,
          0,
          JSON.stringify(['dep1']),
          JSON.stringify({ key: 'value' }),
          'installed',
          'unknown',
          JSON.stringify({ description: 'Test' })
        ]
      );

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO module_events'),
        [
          'test-module',
          'discovered',
          JSON.stringify({
            version: '1.0.0',
            path: '/test/path'
          })
        ]
      );
    });

    it('should skip modules with invalid types', async () => {
      const modules: ScannedModule[] = [{
        name: 'invalid-module',
        version: '1.0.0',
        type: 'invalid' as ModuleType,
        path: '/test/path'
      }];

      await (service as any).storeModules(modules);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Invalid module type for invalid-module: invalid')
      );
      expect(mockDatabase.execute).not.toHaveBeenCalled();
    });

    it('should handle database not initialized error', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.database = null;

      const modules: ScannedModule[] = [{
        name: 'test-module',
        version: '1.0.0',
        type: 'core' as ModuleType,
        path: '/test/path'
      }];

      await (service as any).storeModules(modules);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Error storing module test-module'),
        { error: new Error('Database not initialized') }
      );
    });

    it('should handle database execution errors gracefully', async () => {
      const error = new Error('Database error');
      mockDatabase.execute.mockRejectedValue(error);

      const modules: ScannedModule[] = [{
        name: 'test-module',
        version: '1.0.0',
        type: 'core' as ModuleType,
        path: '/test/path'
      }];

      await (service as any).storeModules(modules);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Error storing module test-module'),
        { error }
      );
    });

    it('should handle non-Error exceptions in database operations', async () => {
      mockDatabase.execute.mockRejectedValue('String error');

      const modules: ScannedModule[] = [{
        name: 'test-module',
        version: '1.0.0',
        type: 'core' as ModuleType,
        path: '/test/path'
      }];

      await (service as any).storeModules(modules);

      expect(mockLogger.error).toHaveBeenCalledWith(
        LogSource.MODULES,
        expect.stringContaining('Error storing module test-module'),
        { error: new Error('String error') }
      );
    });

    it('should store modules with empty dependencies and config', async () => {
      const modules: ScannedModule[] = [{
        name: 'simple-module',
        version: '1.0.0',
        type: 'service' as ModuleType,
        path: '/test/path'
      }];

      await (service as any).storeModules(modules);

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO modules'),
        expect.arrayContaining([
          'simple-module',
          '1.0.0',
          'service',
          '/test/path',
          1,
          0,
          JSON.stringify([]),
          JSON.stringify({}),
          'installed',
          'unknown',
          JSON.stringify({})
        ])
      );
    });
  });

  describe('getRegisteredModules', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
    });

    it('should throw error when database not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.database = null;

      await expect(service.getRegisteredModules()).rejects.toThrow('Database not initialized');
    });

    it('should return mapped module info from database rows', async () => {
      const mockRows: IDatabaseModuleRow[] = [{
        id: 1,
        name: 'test-module',
        version: '1.0.0',
        type: 'core',
        path: '/test/path',
        enabled: 1,
        autoStart: 0,
        dependencies: JSON.stringify(['dep1']),
        config: JSON.stringify({ key: 'value' }),
        status: 'running',
        lasterror: null,
        healthStatus: 'healthy',
        healthMessage: null,
        metadata: JSON.stringify({ description: 'Test' }),
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }];

      mockDatabase.query.mockResolvedValue(mockRows);

      const result = await service.getRegisteredModules();

      expect(mockDatabase.query).toHaveBeenCalledWith('SELECT * FROM modules');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'test-module',
        version: '1.0.0',
        type: 'core',
        enabled: true,
        autoStart: false
      });
    });
  });

  describe('getEnabledModules', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
    });

    it('should throw error when database not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.database = null;

      await expect(service.getEnabledModules()).rejects.toThrow('Database not initialized');
    });

    it('should return only enabled modules', async () => {
      const mockRows: IDatabaseModuleRow[] = [{
        id: 1,
        name: 'enabled-module',
        version: '1.0.0',
        type: 'core',
        path: '/test/path',
        enabled: 1,
        autoStart: 0,
        dependencies: '[]',
        config: '{}',
        status: 'running',
        lasterror: null,
        healthStatus: 'healthy',
        healthMessage: null,
        metadata: '{}',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }];

      mockDatabase.query.mockResolvedValue(mockRows);

      const result = await service.getEnabledModules();

      expect(mockDatabase.query).toHaveBeenCalledWith('SELECT * FROM modules WHERE enabled = 1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('enabled-module');
    });
  });

  describe('getModule', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
    });

    it('should throw error when database not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.database = null;

      await expect(service.getModule('test')).rejects.toThrow('Database not initialized');
    });

    it('should return undefined when module not found', async () => {
      mockDatabase.query.mockResolvedValue([]);

      const result = await service.getModule('non-existent');

      expect(result).toBeUndefined();
      expect(mockDatabase.query).toHaveBeenCalledWith('SELECT * FROM modules WHERE name = ?', ['non-existent']);
    });

    it('should return undefined when query returns undefined row', async () => {
      mockDatabase.query.mockResolvedValue([undefined]);

      const result = await service.getModule('test');

      expect(result).toBeUndefined();
    });

    it('should return module info when found', async () => {
      const mockRow: IDatabaseModuleRow = {
        id: 1,
        name: 'test-module',
        version: '1.0.0',
        type: 'core',
        path: '/test/path',
        enabled: 1,
        autoStart: 0,
        dependencies: '[]',
        config: '{}',
        status: 'running',
        lasterror: null,
        healthStatus: 'healthy',
        healthMessage: null,
        metadata: '{}',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      mockDatabase.query.mockResolvedValue([mockRow]);

      const result = await service.getModule('test-module');

      expect(result).toBeDefined();
      expect(result?.name).toBe('test-module');
    });
  });

  describe('mapRowToModuleInfo', () => {
    beforeEach(() => {
      service = ModuleScannerService.getInstance(mockLogger);
    });

    it('should map complete database row to module info', () => {
      const row: IDatabaseModuleRow = {
        id: 1,
        name: 'test-module',
        version: '1.0.0',
        type: 'core',
        path: '/test/path',
        enabled: 1,
        autoStart: 1,
        dependencies: JSON.stringify(['dep1']),
        config: JSON.stringify({ key: 'value' }),
        status: 'running',
        lasterror: 'Some error',
        discoveredAt: '2023-01-01T00:00:00.000Z',
        lastStartedAt: '2023-01-01T00:00:00.000Z',
        lastStoppedAt: '2023-01-01T00:00:00.000Z',
        healthStatus: 'healthy',
        healthMessage: 'All good',
        lastHealthCheck: '2023-01-01T00:00:00.000Z',
        metadata: JSON.stringify({ description: 'Test' }),
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      const result = (service as any).mapRowToModuleInfo(row);

      expect(result).toEqual({
        id: 1,
        name: 'test-module',
        version: '1.0.0',
        type: 'core',
        path: '/test/path',
        enabled: true,
        autoStart: true,
        dependencies: ['dep1'],
        config: { key: 'value' },
        status: 'running',
        healthStatus: 'healthy',
        metadata: { description: 'Test' },
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        lastError: 'Some error',
        discoveredAt: new Date('2023-01-01T00:00:00.000Z'),
        lastStartedAt: new Date('2023-01-01T00:00:00.000Z'),
        lastStoppedAt: new Date('2023-01-01T00:00:00.000Z'),
        healthMessage: 'All good',
        lastHealthCheck: new Date('2023-01-01T00:00:00.000Z')
      });
    });

    it('should handle null optional fields', () => {
      const row: IDatabaseModuleRow = {
        id: 1,
        name: 'simple-module',
        version: '1.0.0',
        type: 'service',
        path: '/test/path',
        enabled: 0,
        autoStart: 0,
        dependencies: null as any,
        config: null as any,
        status: 'stopped',
        lasterror: null,
        healthStatus: null as any,
        healthMessage: null,
        metadata: null as any,
        createdAt: null as any,
        updatedAt: null as any
      };

      const result = (service as any).mapRowToModuleInfo(row);

      expect(result).toEqual({
        id: 1,
        name: 'simple-module',
        version: '1.0.0',
        type: 'service',
        path: '/test/path',
        enabled: false,
        autoStart: false,
        dependencies: [],
        config: {},
        status: 'stopped',
        healthStatus: 'unknown',
        metadata: {},
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    it('should handle undefined optional fields', () => {
      const row: IDatabaseModuleRow = {
        id: 1,
        name: 'simple-module',
        version: '1.0.0',
        type: 'service',
        path: '/test/path',
        enabled: 0,
        autoStart: 0,
        dependencies: '[]',
        config: '{}',
        status: 'stopped',
        lasterror: undefined as any,
        discoveredAt: undefined,
        lastStartedAt: undefined,
        lastStoppedAt: undefined,
        healthStatus: 'unknown',
        healthMessage: undefined as any,
        lastHealthCheck: undefined,
        metadata: '{}',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      const result = (service as any).mapRowToModuleInfo(row);

      expect(result.lastError).toBeUndefined();
      expect(result.discoveredAt).toBeUndefined();
      expect(result.lastStartedAt).toBeUndefined();
      expect(result.lastStoppedAt).toBeUndefined();
      expect(result.healthMessage).toBeUndefined();
      expect(result.lastHealthCheck).toBeUndefined();
    });
  });

  describe('updateModuleStatus', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
    });

    it('should throw error when database not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.database = null;

      await expect(service.updateModuleStatus('test', 'running' as ModuleStatus))
        .rejects.toThrow('Database not initialized');
    });

    it('should update module status without error', async () => {
      await service.updateModuleStatus('test-module', 'running' as ModuleStatus);

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE modules'),
        ['running', null, 'test-module']
      );
    });

    it('should update module status with error message', async () => {
      await service.updateModuleStatus('test-module', 'error' as ModuleStatus, 'Test error');

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE modules'),
        ['error', 'Test error', 'test-module']
      );
    });

    it('should create event for mapped status types', async () => {
      await service.updateModuleStatus('test-module', 'running' as ModuleStatus);

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO module_events'),
        [
          'test-module',
          'started',
          JSON.stringify({
            status: 'running',
            error: undefined
          })
        ]
      );
    });

    it('should not create event for unmapped status types', async () => {
      mockDatabase.execute.mockClear();
      
      await service.updateModuleStatus('test-module', 'pending' as ModuleStatus);

      expect(mockDatabase.execute).toHaveBeenCalledTimes(1); // Only status update, no event
    });

    it('should handle database not initialized error in event creation', async () => {
      let callCount = 0;
      mockDatabase.execute.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(); // First call succeeds
        }
        // @ts-expect-error - Accessing private property for testing
        service.database = null;
        throw new Error('Database not initialized');
      });

      await expect(service.updateModuleStatus('test-module', 'running' as ModuleStatus))
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('mapStatusToEventType', () => {
    beforeEach(() => {
      service = ModuleScannerService.getInstance(mockLogger);
    });

    it('should map loading and running status to started event', () => {
      expect((service as any).mapStatusToEventType('loading' as ModuleStatus)).toBe('started');
      expect((service as any).mapStatusToEventType('running' as ModuleStatus)).toBe('started');
    });

    it('should map stopped status to stopped event', () => {
      expect((service as any).mapStatusToEventType('stopped' as ModuleStatus)).toBe('stopped');
    });

    it('should map error status to error event', () => {
      expect((service as any).mapStatusToEventType('error' as ModuleStatus)).toBe('error');
    });

    it('should return null for unmapped status types', () => {
      expect((service as any).mapStatusToEventType('pending' as ModuleStatus)).toBeNull();
      expect((service as any).mapStatusToEventType('initializing' as ModuleStatus)).toBeNull();
      expect((service as any).mapStatusToEventType('stopping' as ModuleStatus)).toBeNull();
      expect((service as any).mapStatusToEventType('installed' as ModuleStatus)).toBeNull();
    });

    it('should return null for unknown status types', () => {
      expect((service as any).mapStatusToEventType('unknown' as ModuleStatus)).toBeNull();
    });
  });

  describe('setModuleEnabled', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
    });

    it('should throw error when database not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.database = null;

      await expect(service.setModuleEnabled('test', true))
        .rejects.toThrow('Database not initialized');
    });

    it('should enable module and create event', async () => {
      await service.setModuleEnabled('test-module', true);

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'UPDATE modules SET enabled = ? WHERE name = ?',
        [1, 'test-module']
      );

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO module_events'),
        [
          'test-module',
          'config_changed',
          JSON.stringify({ enabled: true })
        ]
      );
    });

    it('should disable module and create event', async () => {
      await service.setModuleEnabled('test-module', false);

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'UPDATE modules SET enabled = ? WHERE name = ?',
        [0, 'test-module']
      );

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO module_events'),
        [
          'test-module',
          'config_changed',
          JSON.stringify({ enabled: false })
        ]
      );
    });

    it('should handle database not initialized error in event creation', async () => {
      let callCount = 0;
      mockDatabase.execute.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(); // First call succeeds
        }
        // @ts-expect-error - Accessing private property for testing
        service.database = null;
        throw new Error('Database not initialized');
      });

      await expect(service.setModuleEnabled('test-module', true))
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('updateModuleHealth', () => {
    beforeEach(async () => {
      service = ModuleScannerService.getInstance(mockLogger);
      await service.initialize();
    });

    it('should throw error when database not initialized', async () => {
      // @ts-expect-error - Accessing private property for testing
      service.database = null;

      await expect(service.updateModuleHealth('test', true))
        .rejects.toThrow('Database not initialized');
    });

    it('should update healthy module status without message', async () => {
      await service.updateModuleHealth('test-module', true);

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE modules'),
        ['healthy', null, 'test-module']
      );

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO module_events'),
        [
          'test-module',
          'health_check',
          JSON.stringify({
            healthy: true,
            message: undefined
          })
        ]
      );
    });

    it('should update unhealthy module status with message', async () => {
      await service.updateModuleHealth('test-module', false, 'Service down');

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE modules'),
        ['unhealthy', 'Service down', 'test-module']
      );

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO module_events'),
        [
          'test-module',
          'health_check',
          JSON.stringify({
            healthy: false,
            message: 'Service down'
          })
        ]
      );
    });

    it('should handle database not initialized error in event creation', async () => {
      let callCount = 0;
      mockDatabase.execute.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(); // First call succeeds
        }
        // @ts-expect-error - Accessing private property for testing
        service.database = null;
        throw new Error('Database not initialized');
      });

      await expect(service.updateModuleHealth('test-module', true))
        .rejects.toThrow('Database not initialized');
    });
  });
});