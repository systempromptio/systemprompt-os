/**
 * Unit tests for SchemaService
 */

import { SchemaService } from '@/modules/core/database/services/schema.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { SchemaError, DatabaseError } from '@/modules/core/database/utils/errors';
import * as fs from 'node:fs/promises';
import * as glob from 'glob';

// Mock dependencies
jest.mock('node:fs/promises');
jest.mock('glob');
jest.mock('@/modules/core/database/services/database.service');

describe('SchemaService', () => {
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockLogger: any;

  beforeEach(() => {
    // Reset singleton
    (SchemaService as any).instance = null;

    // Setup mock database service
    mockDatabaseService = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn(),
      getConnection: jest.fn(),
      getDatabaseType: jest.fn().mockReturnValue('sqlite'),
      isConnected: jest.fn().mockResolvedValue(true),
      isInitialized: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn()
    } as any;

    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock glob.glob
    (glob.glob as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should create a new instance on first call', () => {
      const service = SchemaService.initialize(mockDatabaseService, mockLogger);
      expect(service).toBeInstanceOf(SchemaService);
    });

    it('should return the same instance on subsequent calls', () => {
      const service1 = SchemaService.initialize(mockDatabaseService, mockLogger);
      const service2 = SchemaService.initialize(mockDatabaseService, mockLogger);
      expect(service1).toBe(service2);
    });
  });

  describe('getInstance', () => {
    it('should throw error if not initialized', () => {
      expect(() => SchemaService.getInstance()).toThrow(DatabaseError);
      expect(() => SchemaService.getInstance()).toThrow('SchemaService not initialized');
    });

    it('should return instance if initialized', () => {
      const initialized = SchemaService.initialize(mockDatabaseService, mockLogger);
      const instance = SchemaService.getInstance();
      expect(instance).toBe(initialized);
    });
  });

  describe('discoverSchemas', () => {
    let service: SchemaService;

    beforeEach(() => {
      service = SchemaService.initialize(mockDatabaseService, mockLogger);
    });

    it('should discover schema files from modules', async () => {
      const mockSchemaFiles = [
        '/app/src/modules/auth/database/schema.sql',
        '/app/src/modules/users/database/schema.sql'
      ];

      const mockInitFiles = [
        '/app/src/modules/auth/database/init.sql'
      ];

      (glob.glob as jest.Mock)
        .mockResolvedValueOnce(mockSchemaFiles)
        .mockResolvedValueOnce(mockInitFiles);

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce('CREATE TABLE auth_sessions...')
        .mockResolvedValueOnce('CREATE TABLE users...')
        .mockResolvedValueOnce('INSERT INTO auth_config...');

      await service.discoverSchemas('/app/src/modules');

      expect(glob.glob).toHaveBeenCalledWith(
        '/app/src/modules/*/database/schema.sql',
        { nodir: true }
      );
      expect(glob.glob).toHaveBeenCalledWith(
        '/app/src/modules/*/database/init.sql',
        { nodir: true }
      );
      expect(fs.readFile).toHaveBeenCalledTimes(3);
    });

    it('should handle discovery errors gracefully', async () => {
      (glob.glob as jest.Mock).mockRejectedValue(new Error('Glob failed'));

      await expect(service.discoverSchemas('/app/src/modules')).rejects.toThrow('Glob failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Schema discovery failed',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should skip files that cannot be read', async () => {
      (glob.glob as jest.Mock).mockResolvedValue(['/app/src/modules/test/database/schema.sql']);
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await service.discoverSchemas('/app/src/modules');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to read schema file',
        expect.objectContaining({ 
          schemaPath: '/app/src/modules/test/database/schema.sql',
          error: expect.any(Error)
        })
      );
    });
  });

  describe('initializeSchemas', () => {
    let service: SchemaService;

    beforeEach(() => {
      service = SchemaService.initialize(mockDatabaseService, mockLogger);
    });

    it('should create schema versions table if not exists', async () => {
      mockDatabaseService.query.mockResolvedValue([]);
      
      await service.initializeSchemas();

      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS _schema_versions')
      );
    });

    it('should initialize discovered schemas', async () => {
      // Setup discovered schemas
      (service as any).schemas = new Map([
        ['auth', {
          module: 'auth',
          schemaPath: '/modules/auth/database/schema.sql',
          sql: 'CREATE TABLE auth_sessions...'
        }],
        ['users', {
          module: 'users',
          schemaPath: '/modules/users/database/schema.sql',
          sql: 'CREATE TABLE users...'
        }]
      ]);

      // Mock already initialized modules
      mockDatabaseService.query.mockResolvedValue([
        { module_name: 'auth', version: '1.0.0' }
      ]);

      await service.initializeSchemas();

      // Should only initialize users module
      expect(mockDatabaseService.transaction).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initializing schema',
        { module: 'users' }
      );
    });

    it('should handle initialization errors', async () => {
      (service as any).schemas = new Map([
        ['test', {
          module: 'test',
          schemaPath: '/modules/test/database/schema.sql',
          sql: 'INVALID SQL'
        }]
      ]);

      mockDatabaseService.query.mockResolvedValue([]);
      mockDatabaseService.transaction.mockRejectedValue(new Error('SQL Error'));

      await service.initializeSchemas();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize schema',
        expect.objectContaining({
          module: 'test',
          error: expect.any(Error)
        })
      );
    });
  });

  describe('getInstalledSchemas', () => {
    let service: SchemaService;

    beforeEach(() => {
      service = SchemaService.initialize(mockDatabaseService, mockLogger);
    });

    it('should return list of installed schemas', async () => {
      const mockSchemas = [
        { module_name: 'auth', version: '1.0.0', installed_at: '2024-01-01' },
        { module_name: 'users', version: '1.0.0', installed_at: '2024-01-02' }
      ];

      mockDatabaseService.query.mockResolvedValue(mockSchemas);

      const schemas = await service.getInstalledSchemas();
      
      expect(schemas).toEqual(mockSchemas);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM _schema_versions')
      );
    });

    it('should return empty array if table does not exist', async () => {
      mockDatabaseService.query.mockRejectedValue(new Error('Table not found'));

      const schemas = await service.getInstalledSchemas();
      
      expect(schemas).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No schema versions table found',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('initializeModuleSchema', () => {
    let service: SchemaService;

    beforeEach(() => {
      service = SchemaService.initialize(mockDatabaseService, mockLogger);
    });

    it('should initialize a specific module schema', async () => {
      (service as any).schemas = new Map([
        ['test', {
          module: 'test',
          schemaPath: '/modules/test/database/schema.sql',
          sql: 'CREATE TABLE test_table...',
          initSql: 'INSERT INTO test_config...'
        }]
      ]);

      mockDatabaseService.transaction.mockImplementation(async (callback) => {
        return callback(mockDatabaseService);
      });

      await service.initializeModuleSchema('test', true);

      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        'CREATE TABLE test_table...'
      );
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        'INSERT INTO test_config...'
      );
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO _schema_versions'),
        expect.arrayContaining(['test', '1.0.0'])
      );
    });

    it('should throw error if module schema not found', async () => {
      await expect(service.initializeModuleSchema('nonexistent'))
        .rejects.toThrow('Schema not found for module: nonexistent');
    });

    it('should skip if already initialized without force', async () => {
      mockDatabaseService.query.mockResolvedValue([
        { module_name: 'test', version: '1.0.0' }
      ]);

      const result = await service.initializeModuleSchema('test', false);
      
      expect(result).toBe(false);
      expect(mockDatabaseService.transaction).not.toHaveBeenCalled();
    });
  });

  describe('private methods', () => {
    let service: SchemaService;

    beforeEach(() => {
      service = SchemaService.initialize(mockDatabaseService, mockLogger);
    });

    it('should extract module name from path correctly', () => {
      const extractModuleName = (service as any).extractModuleName.bind(service);
      
      expect(extractModuleName('/app/src/modules/auth/database/schema.sql'))
        .toBe('auth');
      expect(extractModuleName('/modules/test-module/database/schema.sql'))
        .toBe('test-module');
      expect(extractModuleName('\\windows\\modules\\test\\database\\schema.sql'))
        .toBe('test');
    });
  });
});