/**
 * Unit tests for MigrationService
 */

import { MigrationService } from '@/modules/core/database/services/migration.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { MigrationError, DatabaseError } from '@/modules/core/database/utils/errors';
import * as fs from 'node:fs/promises';
import * as crypto from 'crypto';
import * as glob from 'glob';

// Mock dependencies
jest.mock('node:fs/promises');
jest.mock('glob');
jest.mock('@/modules/core/database/services/database.service');

describe('MigrationService', () => {
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockLogger: any;

  beforeEach(() => {
    // Reset singleton
    (MigrationService as any).instance = null;

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
      const service = MigrationService.initialize(mockDatabaseService, mockLogger);
      expect(service).toBeInstanceOf(MigrationService);
    });

    it('should return the same instance on subsequent calls', () => {
      const service1 = MigrationService.initialize(mockDatabaseService, mockLogger);
      const service2 = MigrationService.initialize(mockDatabaseService, mockLogger);
      expect(service1).toBe(service2);
    });
  });

  describe('getInstance', () => {
    it('should throw error if not initialized', () => {
      expect(() => MigrationService.getInstance()).toThrow(DatabaseError);
      expect(() => MigrationService.getInstance()).toThrow('MigrationService not initialized');
    });

    it('should return instance if initialized', () => {
      const initialized = MigrationService.initialize(mockDatabaseService, mockLogger);
      const instance = MigrationService.getInstance();
      expect(instance).toBe(initialized);
    });
  });

  describe('discoverMigrations', () => {
    let service: MigrationService;

    beforeEach(() => {
      service = MigrationService.initialize(mockDatabaseService, mockLogger);
    });

    it('should discover migration files from modules', async () => {
      const mockMigrationFiles = [
        '/app/src/modules/auth/database/migrations/2024-01-01-add-sessions.sql',
        '/app/src/modules/users/database/migrations/2024-01-02-add-profiles.sql'
      ];

      (glob.glob as jest.Mock).mockResolvedValue(mockMigrationFiles);
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce('ALTER TABLE auth ADD COLUMN session_id...')
        .mockResolvedValueOnce('CREATE TABLE user_profiles...');

      await service.discoverMigrations('/app/src/modules');

      expect(glob.glob).toHaveBeenCalledWith(
        '/app/src/modules/*/database/migrations/*.sql',
        { nodir: true }
      );
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Migration discovery complete',
        expect.objectContaining({ count: 2 })
      );
    });

    it('should handle discovery errors gracefully', async () => {
      (glob.glob as jest.Mock).mockRejectedValue(new Error('Glob failed'));

      await expect(service.discoverMigrations('/app/src/modules')).rejects.toThrow('Glob failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Migration discovery failed',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should extract migration metadata correctly', async () => {
      const mockFiles = [
        '/modules/auth/database/migrations/2024-01-01-initial.sql'
      ];

      (glob.glob as jest.Mock).mockResolvedValue(mockFiles);
      (fs.readFile as jest.Mock).mockResolvedValue('CREATE TABLE test...');

      await service.discoverMigrations('/modules');

      const migrations = (service as any).migrations;
      expect(migrations).toHaveLength(1);
      expect(migrations[0]).toMatchObject({
        module: 'auth',
        version: '2024-01-01-initial',
        filename: '2024-01-01-initial.sql',
        sql: 'CREATE TABLE test...'
      });
    });
  });

  describe('runMigrations', () => {
    let service: MigrationService;

    beforeEach(() => {
      service = MigrationService.initialize(mockDatabaseService, mockLogger);
    });

    it('should create migrations table if not exists', async () => {
      await service.runMigrations();

      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS _migrations')
      );
    });

    it('should run pending migrations', async () => {
      // Setup discovered migrations
      (service as any).migrations = [
        {
          module: 'auth',
          version: '2024-01-01-initial',
          filename: '2024-01-01-initial.sql',
          sql: 'CREATE TABLE auth_sessions...',
          checksum: 'checksum1'
        },
        {
          module: 'users',
          version: '2024-01-02-profiles',
          filename: '2024-01-02-profiles.sql',
          sql: 'CREATE TABLE user_profiles...',
          checksum: 'checksum2'
        }
      ];

      // Mock executed migrations (only auth is executed)
      mockDatabaseService.query.mockResolvedValue([
        {
          module: 'auth',
          version: '2024-01-01-initial',
          checksum: 'checksum1'
        }
      ]);

      mockDatabaseService.transaction.mockImplementation(async (callback) => {
        return callback(mockDatabaseService);
      });

      await service.runMigrations();

      // Should only run users migration
      expect(mockDatabaseService.transaction).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        'CREATE TABLE user_profiles...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Running migration',
        expect.objectContaining({
          module: 'users',
          version: '2024-01-02-profiles'
        })
      );
    });

    it('should handle migration errors', async () => {
      (service as any).migrations = [{
        module: 'test',
        version: '2024-01-01-bad',
        filename: '2024-01-01-bad.sql',
        sql: 'INVALID SQL',
        checksum: 'checksum'
      }];

      mockDatabaseService.query.mockResolvedValue([]);
      mockDatabaseService.transaction.mockRejectedValue(new Error('SQL Error'));

      await service.runMigrations();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to run migration',
        expect.objectContaining({
          module: 'test',
          version: '2024-01-01-bad',
          error: expect.any(Error)
        })
      );
    });

    it('should detect checksum mismatches', async () => {
      (service as any).migrations = [{
        module: 'auth',
        version: '2024-01-01-initial',
        filename: '2024-01-01-initial.sql',
        sql: 'CREATE TABLE modified...',
        checksum: 'new_checksum'
      }];

      mockDatabaseService.query.mockResolvedValue([{
        module: 'auth',
        version: '2024-01-01-initial',
        checksum: 'old_checksum'
      }]);

      await service.runMigrations();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Migration checksum mismatch',
        expect.objectContaining({
          module: 'auth',
          version: '2024-01-01-initial'
        })
      );
    });
  });

  describe('getPendingMigrations', () => {
    let service: MigrationService;

    beforeEach(() => {
      service = MigrationService.initialize(mockDatabaseService, mockLogger);
    });

    it('should return migrations not yet executed', async () => {
      (service as any).migrations = [
        { module: 'auth', version: '1', checksum: 'c1' },
        { module: 'users', version: '1', checksum: 'c2' },
        { module: 'users', version: '2', checksum: 'c3' }
      ];

      mockDatabaseService.query.mockResolvedValue([
        { module: 'auth', version: '1', checksum: 'c1' }
      ]);

      const pending = await service.getPendingMigrations();
      
      expect(pending).toHaveLength(2);
      expect(pending[0]).toMatchObject({ module: 'users', version: '1' });
      expect(pending[1]).toMatchObject({ module: 'users', version: '2' });
    });

    it('should handle when no migrations table exists', async () => {
      (service as any).migrations = [
        { module: 'auth', version: '1', checksum: 'c1' }
      ];

      mockDatabaseService.query.mockRejectedValue(new Error('Table not found'));

      const pending = await service.getPendingMigrations();
      
      expect(pending).toHaveLength(1);
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('getExecutedMigrations', () => {
    let service: MigrationService;

    beforeEach(() => {
      service = MigrationService.initialize(mockDatabaseService, mockLogger);
    });

    it('should return list of executed migrations', async () => {
      const mockExecuted = [
        { module: 'auth', version: '1', executed_at: '2024-01-01' },
        { module: 'users', version: '1', executed_at: '2024-01-02' }
      ];

      mockDatabaseService.query.mockResolvedValue(mockExecuted);

      const executed = await service.getExecutedMigrations();
      
      expect(executed).toEqual(mockExecuted);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM _migrations')
      );
    });

    it('should return empty array if table does not exist', async () => {
      mockDatabaseService.query.mockRejectedValue(new Error('Table not found'));

      const executed = await service.getExecutedMigrations();
      
      expect(executed).toEqual([]);
    });
  });

  describe('rollbackMigration', () => {
    let service: MigrationService;

    beforeEach(() => {
      service = MigrationService.initialize(mockDatabaseService, mockLogger);
    });

    it('should throw error for rollback (not implemented)', async () => {
      await expect(service.rollbackMigration('test', '1'))
        .rejects.toThrow('Migration rollback not implemented');
    });
  });

  describe('private methods', () => {
    let service: MigrationService;

    beforeEach(() => {
      service = MigrationService.initialize(mockDatabaseService, mockLogger);
    });

    it('should calculate checksum correctly', () => {
      const calculateChecksum = (service as any).calculateChecksum.bind(service);
      const sql = 'CREATE TABLE test (id INTEGER PRIMARY KEY);';
      
      const checksum = calculateChecksum(sql);
      const expectedChecksum = crypto.createHash('sha256').update(sql).digest('hex');
      
      expect(checksum).toBe(expectedChecksum);
    });

    it('should extract module name from migration path', () => {
      const extractModuleName = (service as any).extractModuleName.bind(service);
      
      expect(extractModuleName('/app/modules/auth/database/migrations/test.sql'))
        .toBe('auth');
      expect(extractModuleName('\\windows\\modules\\users\\database\\migrations\\test.sql'))
        .toBe('users');
    });

    it('should extract version from filename', () => {
      const extractVersion = (service as any).extractVersion.bind(service);
      
      expect(extractVersion('2024-01-01-initial-setup.sql'))
        .toBe('2024-01-01-initial-setup');
      expect(extractVersion('v1.0.0-add-indexes.sql'))
        .toBe('v1.0.0-add-indexes');
    });
  });
});