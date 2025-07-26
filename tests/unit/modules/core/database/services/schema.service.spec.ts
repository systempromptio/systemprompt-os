/**
 * Unit tests for SchemaService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchemaService } from '../../../../../../src/modules/core/database/services/schema.service.js';
import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { LogSource } from '../../../../../../src/modules/core/logger/types/index.js';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('glob');

describe('SchemaService', () => {
  let mockImportService: any;
  let mockLogger: any;
  let mockMcpContentScanner: any;
  let schemaService: SchemaService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton
    (SchemaService as any).instance = undefined;

    // Mock import service
    mockImportService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      importSchemas: vi.fn().mockResolvedValue({
        success: true,
        imported: ['core/auth'],
        skipped: [],
        errors: []
      }),
      getImportedSchemas: vi.fn().mockResolvedValue([])
    };

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    // Mock MCP content scanner
    mockMcpContentScanner = {
      scanModule: vi.fn().mockResolvedValue(undefined),
      removeModuleContent: vi.fn().mockResolvedValue(undefined)
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialize', () => {
    it('should create singleton instance', () => {
      const instance1 = SchemaService.initialize(null, mockImportService);
      const instance2 = SchemaService.initialize(null, mockImportService);
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(SchemaService);
    });

    it('should set logger when provided', () => {
      const instance = SchemaService.initialize(null, mockImportService, mockLogger);
      
      expect(instance).toBeInstanceOf(SchemaService);
      expect((instance as any).logger).toBe(mockLogger);
    });

    it('should not override logger when undefined is passed', () => {
      const instance1 = SchemaService.initialize(null, mockImportService, mockLogger);
      const instance2 = SchemaService.initialize(null, mockImportService, undefined);
      
      expect((instance1 as any).logger).toBe(mockLogger);
      expect((instance2 as any).logger).toBe(mockLogger);
    });

    it('should set import service', () => {
      const instance = SchemaService.initialize(null, mockImportService);
      
      expect((instance as any).importService).toBe(mockImportService);
    });

    it('should mark instance as initialized', () => {
      const instance = SchemaService.initialize(null, mockImportService);
      
      expect((instance as any).initialized).toBe(true);
    });
  });

  describe('getInstance', () => {
    it('should return instance if initialized', () => {
      SchemaService.initialize(null, mockImportService);
      const instance = SchemaService.getInstance();
      
      expect(instance).toBeInstanceOf(SchemaService);
    });

    it('should throw if not initialized', () => {
      expect(() => SchemaService.getInstance()).toThrow('SchemaService not initialized. Call initialize() first.');
    });

    it('should throw if instance exists but not marked as initialized', () => {
      (SchemaService as any).instance = new (SchemaService as any)();
      
      expect(() => SchemaService.getInstance()).toThrow('SchemaService not initialized. Call initialize() first.');
    });
  });

  describe('setMcpContentScanner', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should set MCP content scanner', () => {
      schemaService.setMcpContentScanner(mockMcpContentScanner);
      
      expect((schemaService as any).mcpContentScanner).toBe(mockMcpContentScanner);
    });
  });

  describe('discoverSchemas', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should discover schema files from filesystem', async () => {
      const mockSchemaFiles = [
        '/app/src/modules/core/auth/database/schema.sql',
        '/app/src/modules/core/config/database/schema.sql',
        '/app/src/modules/extension/database/schema.sql'
      ];

      const mockInitFiles = [
        '/app/src/modules/core/auth/database/init.sql',
        '/app/src/modules/extension/database/init.sql'
      ];

      vi.mocked(glob).mockImplementation(async (pattern: any) => {
        if (pattern.includes('schema.sql')) return mockSchemaFiles;
        if (pattern.includes('init.sql')) return mockInitFiles;
        return [];
      });

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('schema.sql')) return 'CREATE TABLE test (id INTEGER);';
        if (path.includes('init.sql')) return 'INSERT INTO test VALUES (1);';
        return '';
      });

      await schemaService.discoverSchemas('/app/src/modules');

      expect(glob).toHaveBeenCalledWith('**/database/schema.sql', {
        cwd: '/app/src/modules',
        absolute: true
      });
      expect(glob).toHaveBeenCalledWith('**/database/init.sql', {
        cwd: '/app/src/modules',
        absolute: true
      });
      expect(readFile).toHaveBeenCalledTimes(5); // 3 schemas + 2 inits
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.DATABASE, 'Discovering module schemas', { 
        baseDir: '/app/src/modules' 
      });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.DATABASE, 'Schema discovery complete', { 
        modulesFound: 3 
      });
      expect(mockLogger.debug).toHaveBeenCalledTimes(3); // One debug call per discovered schema
    });

    it('should match init files with schema files', async () => {
      const mockSchemaFiles = [
        '/app/src/modules/core/auth/database/schema.sql'
      ];
      const mockInitFiles = [
        '/app/src/modules/core/auth/database/init.sql'
      ];

      vi.mocked(glob).mockImplementation(async (pattern: any) => {
        if (pattern.includes('schema.sql')) return mockSchemaFiles;
        if (pattern.includes('init.sql')) return mockInitFiles;
        return [];
      });

      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('schema.sql')) return 'CREATE TABLE users;';
        if (path.includes('init.sql')) return 'INSERT INTO users;';
        return '';
      });

      await schemaService.discoverSchemas();

      const schema = schemaService.getSchema('core/auth');
      expect(schema).toBeDefined();
      expect(schema?.initPath).toBe('/app/src/modules/core/auth/database/init.sql');
      expect(schema?.initSql).toBe('INSERT INTO users;');
    });

    it('should handle schemas without init files', async () => {
      const mockSchemaFiles = [
        '/app/src/modules/core/auth/database/schema.sql'
      ];

      vi.mocked(glob).mockImplementation(async (pattern: any) => {
        if (pattern.includes('schema.sql')) return mockSchemaFiles;
        return [];
      });

      vi.mocked(readFile).mockResolvedValue('CREATE TABLE test;');

      await schemaService.discoverSchemas();

      const schema = schemaService.getSchema('core/auth');
      expect(schema).toBeDefined();
      expect(schema?.initPath).toBeUndefined();
      expect(schema?.initSql).toBeUndefined();
    });

    it('should use default base directory when none provided', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      await schemaService.discoverSchemas();

      expect(glob).toHaveBeenCalledWith('**/database/schema.sql', {
        cwd: '/app/src/modules',
        absolute: true
      });
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.DATABASE, 'Discovering module schemas', { 
        baseDir: '/app/src/modules' 
      });
    });

    it('should handle discovery errors', async () => {
      const error = new Error('Glob failed');
      vi.mocked(glob).mockRejectedValue(error);

      await expect(schemaService.discoverSchemas()).rejects.toThrow('Glob failed');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Schema discovery failed', { error });
    });

    it('should handle non-Error type errors', async () => {
      const errorMessage = 'String error';
      vi.mocked(glob).mockRejectedValue(errorMessage);

      await expect(schemaService.discoverSchemas()).rejects.toThrow('String error');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Schema discovery failed', { 
        error: expect.any(Error)
      });
    });

    it('should extract module names correctly', async () => {
      const mockSchemaFiles = [
        '/app/src/modules/core/auth/database/schema.sql',
        '/app/src/modules/extension/database/schema.sql',
        '/app/src/modules/core/config/database/schema.sql' // Regular path
      ];

      vi.mocked(glob).mockImplementation(async (pattern: any) => {
        if (pattern.includes('schema.sql')) return mockSchemaFiles;
        return [];
      });

      vi.mocked(readFile).mockResolvedValue('SQL');

      await schemaService.discoverSchemas('/app/src/modules');

      const schemas = schemaService.getAllSchemas();
      expect(schemas.has('core/auth')).toBe(true);
      expect(schemas.has('extension')).toBe(true);
      expect(schemas.has('core/config')).toBe(true);
    });
  });

  describe('extractModuleName', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should extract core module names correctly', () => {
      const extractModuleName = (schemaService as any).extractModuleName.bind(schemaService);
      
      expect(extractModuleName('/app/src/modules/core/auth/database/schema.sql', '/app/src/modules')).toBe('core/auth');
      expect(extractModuleName('/app/src/modules/core/config/database/schema.sql', '/app/src/modules')).toBe('core/config');
    });

    it('should extract non-core module names correctly', () => {
      const extractModuleName = (schemaService as any).extractModuleName.bind(schemaService);
      
      expect(extractModuleName('/app/src/modules/extension/database/schema.sql', '/app/src/modules')).toBe('extension');
      expect(extractModuleName('/app/src/modules/plugin/database/schema.sql', '/app/src/modules')).toBe('plugin');
    });

    it('should handle Windows-style path separators', () => {
      const extractModuleName = (schemaService as any).extractModuleName.bind(schemaService);
      
      expect(extractModuleName('C:\\app\\src\\modules\\core\\auth\\database\\schema.sql', 'C:\\app\\src\\modules')).toBe('core/auth');
      expect(extractModuleName('C:\\app\\src\\modules\\extension\\database\\schema.sql', 'C:\\app\\src\\modules')).toBe('extension');
    });

    it('should handle base directory with trailing slash', () => {
      const extractModuleName = (schemaService as any).extractModuleName.bind(schemaService);
      
      expect(extractModuleName('/app/src/modules/core/auth/database/schema.sql', '/app/src/modules/')).toBe('core/auth');
    });

    it('should return empty string for empty paths', () => {
      const extractModuleName = (schemaService as any).extractModuleName.bind(schemaService);
      
      expect(extractModuleName('', '/app/src/modules')).toBe('');
    });

    it('should return empty string for base directory only', () => {
      const extractModuleName = (schemaService as any).extractModuleName.bind(schemaService);
      
      // When the path is just the base directory, relative path is empty
      expect(extractModuleName('/app/src/modules/', '/app/src/modules')).toBe('');
    });

    it('should handle single-level paths', () => {
      const extractModuleName = (schemaService as any).extractModuleName.bind(schemaService);
      
      expect(extractModuleName('/app/src/modules/standalone/database/schema.sql', '/app/src/modules')).toBe('standalone');
    });
  });

  describe('initializeSchemas', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should throw error if import service not initialized', async () => {
      const schemaServiceWithoutImport = SchemaService.initialize(null, null as any, mockLogger);
      
      await expect(schemaServiceWithoutImport.initializeSchemas()).rejects.toThrow('Import service not initialized');
    });

    it('should initialize import service and import schemas', async () => {
      // Set up discovered schemas
      const schemas = new Map([
        ['core/auth', {
          module: 'core/auth',
          moduleName: 'core/auth',
          schemaPath: '/path/to/auth/schema.sql',
          sql: 'CREATE TABLE users (id INTEGER);'
        }],
        ['core/config', {
          module: 'core/config',
          moduleName: 'core/config',
          schemaPath: '/path/to/config/schema.sql',
          sql: 'CREATE TABLE settings (id INTEGER);',
          initPath: '/path/to/config/init.sql',
          initSql: 'INSERT INTO settings VALUES (1);'
        }]
      ]);
      (schemaService as any).schemas = schemas;

      await schemaService.initializeSchemas();

      expect(mockImportService.initialize).toHaveBeenCalledTimes(1);
      expect(mockImportService.importSchemas).toHaveBeenCalledWith([
        {
          module: 'core/auth',
          filepath: '/path/to/auth/schema.sql',
          checksum: '',
          content: 'CREATE TABLE users (id INTEGER);'
        },
        {
          module: 'core/config',
          filepath: '/path/to/config/schema.sql',
          checksum: '',
          content: 'CREATE TABLE settings (id INTEGER);'
        },
        {
          module: 'core/config',
          filepath: '/path/to/config/init.sql',
          checksum: '',
          content: 'INSERT INTO settings VALUES (1);'
        }
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.DATABASE, 'Schema import complete', {
        imported: 1,
        skipped: 0
      });
    });

    it('should handle import service failure', async () => {
      const schemas = new Map([
        ['core/auth', {
          module: 'core/auth',
          moduleName: 'core/auth',
          schemaPath: '/path/to/auth/schema.sql',
          sql: 'CREATE TABLE users (id INTEGER);'
        }]
      ]);
      (schemaService as any).schemas = schemas;

      // Mock import service failure
      mockImportService.importSchemas.mockResolvedValue({
        success: false,
        imported: [],
        skipped: [],
        errors: [
          { file: '/path/to/auth/schema.sql', error: 'SQL syntax error' }
        ]
      });

      await expect(schemaService.initializeSchemas()).rejects.toThrow('Schema import failed: SQL syntax error');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Schema import failed', {
        errors: [{ file: '/path/to/auth/schema.sql', error: 'SQL syntax error' }]
      });
    });

    it('should handle multiple import errors', async () => {
      const schemas = new Map([
        ['core/auth', {
          module: 'core/auth',
          moduleName: 'core/auth',
          schemaPath: '/path/to/auth/schema.sql',
          sql: 'CREATE TABLE users (id INTEGER);'
        }]
      ]);
      (schemaService as any).schemas = schemas;

      mockImportService.importSchemas.mockResolvedValue({
        success: false,
        imported: [],
        skipped: [],
        errors: [
          { file: '/path/to/auth/schema.sql', error: 'SQL syntax error' },
          { file: '/path/to/auth/init.sql', error: 'Constraint violation' }
        ]
      });

      await expect(schemaService.initializeSchemas()).rejects.toThrow('Schema import failed: SQL syntax error; Constraint violation');
    });

    it('should call MCP content scanner after successful import', async () => {
      const schemas = new Map([
        ['core/auth', {
          module: 'core/auth',
          moduleName: 'core/auth',
          schemaPath: '/path/to/modules/core/auth/database/schema.sql',
          sql: 'CREATE TABLE users (id INTEGER);'
        }]
      ]);
      (schemaService as any).schemas = schemas;
      schemaService.setMcpContentScanner(mockMcpContentScanner);

      await schemaService.initializeSchemas();

      expect(mockMcpContentScanner.scanModule).toHaveBeenCalledWith('auth', '/path/to/modules/core/auth');
    });

    it('should handle MCP scanner errors gracefully', async () => {
      const schemas = new Map([
        ['core/auth', {
          module: 'core/auth',
          moduleName: 'core/auth',
          schemaPath: '/path/to/modules/core/auth/database/schema.sql',
          sql: 'CREATE TABLE users (id INTEGER);'
        }]
      ]);
      (schemaService as any).schemas = schemas;
      schemaService.setMcpContentScanner(mockMcpContentScanner);
      mockMcpContentScanner.scanModule.mockRejectedValue(new Error('MCP scan failed'));

      await schemaService.initializeSchemas();

      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.DATABASE, 'Failed to scan MCP content for module', {
        module: 'core/auth',
        error: expect.any(Error)
      });
    });

    it('should not call MCP scanner if not set', async () => {
      const schemas = new Map([
        ['core/auth', {
          module: 'core/auth',
          moduleName: 'core/auth',
          schemaPath: '/path/to/modules/core/auth/database/schema.sql',
          sql: 'CREATE TABLE users (id INTEGER);'
        }]
      ]);
      (schemaService as any).schemas = schemas;

      await schemaService.initializeSchemas();

      expect(mockMcpContentScanner.scanModule).not.toHaveBeenCalled();
    });
  });

  describe('getInstalledSchemas', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should throw error if import service not initialized', async () => {
      const schemaServiceWithoutImport = SchemaService.initialize(null, null as any, mockLogger);
      
      await expect(schemaServiceWithoutImport.getInstalledSchemas()).rejects.toThrow('Import service not initialized');
    });

    it('should return installed schemas', async () => {
      const importedSchemas = [
        {
          module: 'core/auth',
          filepath: '/path/to/auth/schema.sql',
          checksum: 'abc123',
          imported_at: '2024-01-01 10:00:00'
        },
        {
          module: 'core/config',
          filepath: '/path/to/config/schema.sql',
          checksum: 'def456',
          imported_at: '2024-01-02 10:00:00'
        }
      ];

      mockImportService.getImportedSchemas.mockResolvedValue(importedSchemas);

      const installed = await schemaService.getInstalledSchemas();

      expect(installed).toHaveLength(2);
      expect(installed[0]).toMatchObject({
        moduleName: 'core/auth',
        version: '1.0.0',
        installedAt: '2024-01-01 10:00:00'
      });
      expect(installed[1]).toMatchObject({
        moduleName: 'core/config',
        version: '1.0.0',
        installedAt: '2024-01-02 10:00:00'
      });
    });

    it('should handle missing imported schemas', async () => {
      mockImportService.getImportedSchemas.mockRejectedValue(new Error('no such table'));

      const installed = await schemaService.getInstalledSchemas();

      expect(installed).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.DATABASE, 'No imported schemas found', { 
        error: expect.any(Error) 
      });
    });

    it('should handle non-Error type exceptions', async () => {
      mockImportService.getImportedSchemas.mockRejectedValue('string error');

      const installed = await schemaService.getInstalledSchemas();

      expect(installed).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.DATABASE, 'No imported schemas found', { 
        error: expect.any(Error) 
      });
    });
  });

  describe('discoverSchemasArray', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should return schemas as array', async () => {
      const mockSchemaFiles = [
        '/app/src/modules/core/auth/database/schema.sql',
        '/app/src/modules/core/config/database/schema.sql'
      ];

      vi.mocked(glob).mockImplementation(async (pattern: any) => {
        if (pattern.includes('schema.sql')) return mockSchemaFiles;
        return [];
      });

      vi.mocked(readFile).mockResolvedValue('CREATE TABLE test;');

      const schemas = await schemaService.discoverSchemasArray();

      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas).toHaveLength(2);
      expect(schemas[0]).toHaveProperty('module');
      expect(schemas[0]).toHaveProperty('sql');
    });

    it('should use custom base directory when provided', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      await schemaService.discoverSchemasArray('/custom/path');

      expect(glob).toHaveBeenCalledWith('**/database/schema.sql', {
        cwd: '/custom/path',
        absolute: true
      });
    });
  });

  describe('initializeBaseSchema', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should throw error if import service not initialized', async () => {
      const schemaServiceWithoutImport = SchemaService.initialize(null, null as any, mockLogger);
      
      await expect(schemaServiceWithoutImport.initializeBaseSchema()).rejects.toThrow('Import service not initialized');
    });

    it('should initialize import service', async () => {
      await schemaService.initializeBaseSchema();

      expect(mockImportService.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('installModuleSchema', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should throw error if import service not initialized', async () => {
      const schemaServiceWithoutImport = SchemaService.initialize(null, null as any, mockLogger);
      const schema = {
        module: 'core/auth',
        moduleName: 'core/auth',
        schemaPath: '/path/to/schema.sql',
        sql: 'CREATE TABLE users;'
      };
      
      await expect(schemaServiceWithoutImport.installModuleSchema(schema)).rejects.toThrow('Import service not initialized');
    });

    it('should install specific module schema', async () => {
      const schema = {
        module: 'core/auth',
        moduleName: 'core/auth',
        schemaPath: '/path/to/schema.sql',
        sql: 'CREATE TABLE users;',
        initPath: '/path/to/init.sql',
        initSql: 'INSERT INTO users VALUES (1);'
      };

      await schemaService.installModuleSchema(schema);

      expect(mockImportService.importSchemas).toHaveBeenCalledWith([
        {
          module: 'core/auth',
          filepath: '/path/to/schema.sql',
          checksum: '',
          content: 'CREATE TABLE users;'
        },
        {
          module: 'core/auth',
          filepath: '/path/to/init.sql',
          checksum: '',
          content: 'INSERT INTO users VALUES (1);'
        }
      ]);
    });

    it('should install schema without init file', async () => {
      const schema = {
        module: 'core/auth',
        moduleName: 'core/auth',
        schemaPath: '/path/to/schema.sql',
        sql: 'CREATE TABLE users;'
      };

      await schemaService.installModuleSchema(schema);

      expect(mockImportService.importSchemas).toHaveBeenCalledWith([
        {
          module: 'core/auth',
          filepath: '/path/to/schema.sql',
          checksum: '',
          content: 'CREATE TABLE users;'
        }
      ]);
    });

    it('should handle import service failure', async () => {
      const schema = {
        module: 'core/auth',
        moduleName: 'core/auth',
        schemaPath: '/path/to/schema.sql',
        sql: 'CREATE TABLE users;'
      };

      mockImportService.importSchemas.mockResolvedValue({
        success: false,
        imported: [],
        skipped: [],
        errors: [
          { file: '/path/to/schema.sql', error: 'SQL syntax error' }
        ]
      });

      await expect(schemaService.installModuleSchema(schema)).rejects.toThrow('Failed to install module schema: SQL syntax error');
    });

    it('should call MCP scanner after successful installation', async () => {
      const schema = {
        module: 'core/auth',
        moduleName: 'core/auth',
        schemaPath: '/path/to/modules/core/auth/database/schema.sql',
        sql: 'CREATE TABLE users;'
      };

      schemaService.setMcpContentScanner(mockMcpContentScanner);
      await schemaService.installModuleSchema(schema);

      expect(mockMcpContentScanner.scanModule).toHaveBeenCalledWith('auth', '/path/to/modules/core/auth');
    });

    it('should not call MCP scanner if not set', async () => {
      const schema = {
        module: 'core/auth',
        moduleName: 'core/auth',
        schemaPath: '/path/to/modules/core/auth/database/schema.sql',
        sql: 'CREATE TABLE users;'
      };

      await schemaService.installModuleSchema(schema);

      expect(mockMcpContentScanner.scanModule).not.toHaveBeenCalled();
    });
  });

  describe('getSchema', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should return schema for module', () => {
      const testSchema = {
        module: 'core/auth',
        moduleName: 'core/auth',
        schemaPath: '/path/to/schema.sql',
        sql: 'CREATE TABLE users;'
      };
      (schemaService as any).schemas.set('core/auth', testSchema);

      const schema = schemaService.getSchema('core/auth');
      expect(schema).toBe(testSchema);
    });

    it('should return undefined for unknown module', () => {
      const schema = schemaService.getSchema('unknown');
      expect(schema).toBeUndefined();
    });
  });

  describe('getAllSchemas', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should return copy of all schemas', () => {
      const testSchemas = new Map([
        ['core/auth', { module: 'core/auth', moduleName: 'core/auth', schemaPath: '/auth', sql: 'SQL1' }],
        ['core/config', { module: 'core/config', moduleName: 'core/config', schemaPath: '/config', sql: 'SQL2' }]
      ]);
      (schemaService as any).schemas = testSchemas;

      const allSchemas = schemaService.getAllSchemas();
      expect(allSchemas.size).toBe(2);
      expect(allSchemas).not.toBe(testSchemas); // Should be a copy
      expect(allSchemas.get('core/auth')).toEqual(testSchemas.get('core/auth'));
    });
  });

  describe('scanModuleMcpContent', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should warn and return if MCP scanner not available', async () => {
      await schemaService.scanModuleMcpContent('auth', '/path/to/module');

      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.DATABASE, 'MCP content scanner not available');
      expect(mockMcpContentScanner.scanModule).not.toHaveBeenCalled();
    });

    it('should scan module content successfully', async () => {
      schemaService.setMcpContentScanner(mockMcpContentScanner);
      
      await schemaService.scanModuleMcpContent('auth', '/path/to/module');

      expect(mockMcpContentScanner.scanModule).toHaveBeenCalledWith('auth', '/path/to/module');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.DATABASE, 'MCP content scan completed', { module: 'auth' });
    });

    it('should handle scan errors', async () => {
      schemaService.setMcpContentScanner(mockMcpContentScanner);
      mockMcpContentScanner.scanModule.mockRejectedValue(new Error('Scan failed'));

      await expect(schemaService.scanModuleMcpContent('auth', '/path/to/module')).rejects.toThrow('Scan failed');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Failed to scan MCP content', {
        module: 'auth',
        error: expect.any(Error)
      });
    });

    it('should handle non-Error type exceptions', async () => {
      schemaService.setMcpContentScanner(mockMcpContentScanner);
      mockMcpContentScanner.scanModule.mockRejectedValue('string error');

      await expect(schemaService.scanModuleMcpContent('auth', '/path/to/module')).rejects.toThrow('string error');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Failed to scan MCP content', {
        module: 'auth',
        error: expect.any(Error)
      });
    });
  });

  describe('removeModuleMcpContent', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(null, mockImportService, mockLogger);
    });

    it('should warn and return if MCP scanner not available', async () => {
      await schemaService.removeModuleMcpContent('auth');

      expect(mockLogger.warn).toHaveBeenCalledWith(LogSource.DATABASE, 'MCP content scanner not available');
      expect(mockMcpContentScanner.removeModuleContent).not.toHaveBeenCalled();
    });

    it('should remove module content successfully', async () => {
      schemaService.setMcpContentScanner(mockMcpContentScanner);
      
      await schemaService.removeModuleMcpContent('auth');

      expect(mockMcpContentScanner.removeModuleContent).toHaveBeenCalledWith('auth');
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.DATABASE, 'MCP content removed', { module: 'auth' });
    });

    it('should handle removal errors', async () => {
      schemaService.setMcpContentScanner(mockMcpContentScanner);
      mockMcpContentScanner.removeModuleContent.mockRejectedValue(new Error('Removal failed'));

      await expect(schemaService.removeModuleMcpContent('auth')).rejects.toThrow('Removal failed');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Failed to remove MCP content', {
        module: 'auth',
        error: expect.any(Error)
      });
    });

    it('should handle non-Error type exceptions', async () => {
      schemaService.setMcpContentScanner(mockMcpContentScanner);
      mockMcpContentScanner.removeModuleContent.mockRejectedValue('string error');

      await expect(schemaService.removeModuleMcpContent('auth')).rejects.toThrow('string error');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Failed to remove MCP content', {
        module: 'auth',
        error: expect.any(Error)
      });
    });
  });
});