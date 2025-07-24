/**
 * Unit tests for SchemaService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchemaService } from '../../../../../../src/modules/core/database/services/schema.service.js';
import { DatabaseService } from '../../../../../../src/modules/core/database/services/database.service.js';
import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { logger } from '../../../../../../src/utils/logger.js';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('glob');
vi.mock('../../../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('SchemaService', () => {
  let mockDatabaseService: any;
  let schemaService: SchemaService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton
    (SchemaService as any).instance = undefined;

    // Mock database service
    mockDatabaseService = {
      execute: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      transaction: vi.fn((callback: any) => {
        const conn = {
          execute: vi.fn().mockResolvedValue(undefined)
        };
        return callback(conn);
      })
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialize', () => {
    it('should create singleton instance', () => {
      const instance1 = SchemaService.initialize(mockDatabaseService);
      const instance2 = SchemaService.initialize(mockDatabaseService);
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(SchemaService);
    });
  });

  describe('getInstance', () => {
    it('should return instance if initialized', () => {
      SchemaService.initialize(mockDatabaseService);
      const instance = SchemaService.getInstance();
      
      expect(instance).toBeInstanceOf(SchemaService);
    });

    it('should throw if not initialized', () => {
      expect(() => SchemaService.getInstance()).toThrow('SchemaService not initialized');
    });
  });

  describe('discoverSchemas', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(mockDatabaseService, logger);
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
      expect(logger.info).toHaveBeenCalledWith('Schema discovery complete', { 
        modulesFound: 3 
      });
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

    it('should handle discovery errors', async () => {
      const error = new Error('Glob failed');
      vi.mocked(glob).mockRejectedValue(error);

      await expect(schemaService.discoverSchemas()).rejects.toThrow('Glob failed');
      expect(logger.error).toHaveBeenCalledWith('Schema discovery failed', { error });
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

  describe('initializeSchemas', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(mockDatabaseService, logger);
    });

    it('should initialize all discovered schemas', async () => {
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
          initSql: 'INSERT INTO settings VALUES (1);'
        }]
      ]);
      (schemaService as any).schemas = schemas;

      // Mock no schemas initialized yet
      mockDatabaseService.query.mockResolvedValue([]);

      await schemaService.initializeSchemas();

      // Should create schema table
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS _schema_versions')
      );

      // Should initialize both schemas
      expect(mockDatabaseService.transaction).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('Schema initialized successfully', { module: 'core/auth' });
      expect(logger.info).toHaveBeenCalledWith('Schema initialized successfully', { module: 'core/config' });
    });

    it('should skip already initialized schemas', async () => {
      const schemas = new Map([
        ['core/auth', {
          module: 'core/auth',
          moduleName: 'core/auth',
          schemaPath: '/path/to/auth/schema.sql',
          sql: 'CREATE TABLE users (id INTEGER);'
        }]
      ]);
      (schemaService as any).schemas = schemas;

      // Mock schema already initialized
      mockDatabaseService.query.mockResolvedValue([
        { module: 'core/auth' }
      ]);

      await schemaService.initializeSchemas();

      expect(mockDatabaseService.transaction).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Schema already initialized', { module: 'core/auth' });
    });

    it('should handle initialization failures', async () => {
      const schemas = new Map([
        ['core/auth', {
          module: 'core/auth',
          moduleName: 'core/auth',
          schemaPath: '/path/to/auth/schema.sql',
          sql: 'INVALID SQL;'
        }]
      ]);
      (schemaService as any).schemas = schemas;

      mockDatabaseService.query.mockResolvedValue([]);
      mockDatabaseService.transaction.mockRejectedValue(new Error('SQL Error'));

      await expect(schemaService.initializeSchemas()).rejects.toThrow('SQL Error');
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize schema', expect.any(Object));
    });
  });

  describe('getInstalledSchemas', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(mockDatabaseService, logger);
    });

    it('should return installed schemas', async () => {
      const installedRows = [
        {
          module_name: 'core/auth',
          version: '1.0.0',
          installed_at: '2024-01-01 10:00:00'
        },
        {
          module_name: 'core/config',
          version: '1.0.0',
          installed_at: '2024-01-02 10:00:00'
        }
      ];

      mockDatabaseService.query.mockResolvedValue(installedRows);

      const installed = await schemaService.getInstalledSchemas();

      expect(installed).toHaveLength(2);
      expect(installed[0]).toMatchObject({
        module_name: 'core/auth',
        version: '1.0.0',
        installed_at: '2024-01-01 10:00:00'
      });
    });

    it('should handle missing schema table', async () => {
      mockDatabaseService.query.mockRejectedValue(new Error('no such table'));

      const installed = await schemaService.getInstalledSchemas();

      expect(installed).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith('No schema versions table found', expect.any(Object));
    });
  });

  describe('discoverSchemasArray', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(mockDatabaseService, logger);
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
  });

  describe('initializeBaseSchema', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(mockDatabaseService, logger);
    });

    it('should create base schema tables', async () => {
      await schemaService.initializeBaseSchema();

      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS _schema_versions')
      );
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS _migrations')
      );
    });
  });

  describe('installModuleSchema', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(mockDatabaseService, logger);
    });

    it('should install specific module schema', async () => {
      const schema = {
        module: 'core/auth',
        moduleName: 'core/auth',
        schemaPath: '/path/to/schema.sql',
        sql: 'CREATE TABLE users;',
        initSql: 'INSERT INTO users VALUES (1);'
      };

      await schemaService.installModuleSchema(schema);

      expect(mockDatabaseService.transaction).toHaveBeenCalled();
      const transactionCallback = mockDatabaseService.transaction.mock.calls[0][0];
      const mockConn = { execute: vi.fn() };
      await transactionCallback(mockConn);

      expect(mockConn.execute).toHaveBeenCalledWith('CREATE TABLE users;');
      expect(mockConn.execute).toHaveBeenCalledWith('INSERT INTO users VALUES (1);');
      expect(mockConn.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO _schema_versions'),
        ['core/auth', '1.0.0']
      );
    });
  });

  describe('getSchema', () => {
    beforeEach(() => {
      schemaService = SchemaService.initialize(mockDatabaseService, logger);
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
      schemaService = SchemaService.initialize(mockDatabaseService, logger);
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
});