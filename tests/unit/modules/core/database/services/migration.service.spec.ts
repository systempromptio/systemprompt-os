/**
 * Unit tests for MigrationService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MigrationService } from '../../../../../../src/modules/core/database/services/migration.service';
import { DatabaseService } from '../../../../../../src/modules/core/database/services/database.service';
import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { logger } from '../../../../../../src/utils/logger';

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

describe('MigrationService', () => {
  let mockDatabaseService: any;
  let migrationService: MigrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton
    (MigrationService as any).instance = undefined;

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
      const instance1 = MigrationService.initialize(mockDatabaseService);
      const instance2 = MigrationService.initialize(mockDatabaseService);
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(MigrationService);
    });
  });

  describe('getInstance', () => {
    it('should return instance if initialized', () => {
      MigrationService.initialize(mockDatabaseService);
      const instance = MigrationService.getInstance();
      
      expect(instance).toBeInstanceOf(MigrationService);
    });

    it('should throw if not initialized', () => {
      expect(() => MigrationService.getInstance()).toThrow('MigrationService not initialized');
    });
  });

  describe('discoverMigrations', () => {
    beforeEach(() => {
      migrationService = MigrationService.initialize(mockDatabaseService);
    });

    it('should discover migrations from filesystem', async () => {
      const mockFiles = [
        '/app/src/modules/core/auth/database/migrations/001_create_users.sql',
        '/app/src/modules/core/auth/database/migrations/002_add_roles.sql',
        '/app/src/modules/extension/database/migrations/001_init.sql'
      ];

      vi.mocked(glob).mockResolvedValue(mockFiles);
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('001_create_users')) return 'CREATE TABLE users (id INTEGER PRIMARY KEY);';
        if (path.includes('002_add_roles')) return 'ALTER TABLE users ADD COLUMN role TEXT;';
        if (path.includes('001_init')) return 'CREATE TABLE extensions (id INTEGER PRIMARY KEY);';
        return '';
      });

      await migrationService.discoverMigrations('/app/src/modules');

      expect(glob).toHaveBeenCalledWith('**/database/migrations/*.sql', {
        cwd: '/app/src/modules',
        absolute: true
      });
      expect(readFile).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith('Migrations discovered', { count: 3 });
    });

    it('should sort migrations by version', async () => {
      const mockFiles = [
        '/app/src/modules/core/auth/database/migrations/003_update.sql',
        '/app/src/modules/core/auth/database/migrations/001_init.sql',
        '/app/src/modules/core/auth/database/migrations/002_add_field.sql'
      ];

      vi.mocked(glob).mockResolvedValue(mockFiles);
      vi.mocked(readFile).mockResolvedValue('SQL');

      await migrationService.discoverMigrations('/app/src/modules');

      const migrations = (migrationService as any).migrations;
      expect(migrations[0].version).toBe('001');
      expect(migrations[1].version).toBe('002');
      expect(migrations[2].version).toBe('003');
    });

    it('should handle discovery errors', async () => {
      const error = new Error('Glob failed');
      vi.mocked(glob).mockRejectedValue(error);

      await expect(migrationService.discoverMigrations()).rejects.toThrow('Glob failed');
      expect(logger.error).toHaveBeenCalledWith('Migration discovery failed', { error });
    });

    it('should extract module names correctly', async () => {
      const mockFiles = [
        '/app/src/modules/core/auth/database/migrations/001_init.sql',
        '/app/src/modules/extension/database/migrations/001_init.sql'
      ];

      vi.mocked(glob).mockResolvedValue(mockFiles);
      vi.mocked(readFile).mockResolvedValue('SQL');

      await migrationService.discoverMigrations('/app/src/modules');

      const migrations = (migrationService as any).migrations;
      expect(migrations[0].module).toBe('core/auth');
      expect(migrations[1].module).toBe('extension');
    });

    it('should handle invalid migration filenames', async () => {
      const mockFiles = [
        '/app/src/modules/core/auth/database/migrations/invalid_filename.sql'
      ];

      vi.mocked(glob).mockResolvedValue(mockFiles);
      vi.mocked(readFile).mockResolvedValue('SQL');

      await expect(migrationService.discoverMigrations()).rejects.toThrow('Invalid migration filename');
    });
  });

  describe('runMigrations', () => {
    beforeEach(() => {
      migrationService = MigrationService.initialize(mockDatabaseService);
    });

    it('should run pending migrations', async () => {
      // Mock discovered migrations
      (migrationService as any).migrations = [
        {
          module: 'core/auth',
          version: '001',
          filename: '001_init.sql',
          sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY);',
          checksum: 'abc123'
        },
        {
          module: 'core/auth',
          version: '002',
          filename: '002_add_role.sql',
          sql: 'ALTER TABLE users ADD COLUMN role TEXT;',
          checksum: 'def456'
        }
      ];

      // Mock no applied migrations
      mockDatabaseService.query.mockResolvedValue([]);

      await migrationService.runMigrations();

      // Should create migration table
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS _migrations')
      );

      // Should run both migrations
      expect(mockDatabaseService.transaction).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('All migrations completed');
    });

    it('should skip already applied migrations', async () => {
      (migrationService as any).migrations = [
        {
          module: 'core/auth',
          version: '001',
          filename: '001_init.sql',
          sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY);',
          checksum: 'abc123'
        }
      ];

      // Mock migration already applied
      mockDatabaseService.query.mockResolvedValue([
        { module: 'core/auth', version: '001' }
      ]);

      await migrationService.runMigrations();

      expect(mockDatabaseService.transaction).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('No pending migrations');
    });

    it('should handle migration failures', async () => {
      (migrationService as any).migrations = [
        {
          module: 'core/auth',
          version: '001',
          filename: '001_init.sql',
          sql: 'INVALID SQL;',
          checksum: 'abc123'
        }
      ];

      mockDatabaseService.query.mockResolvedValue([]);
      mockDatabaseService.transaction.mockRejectedValue(new Error('SQL Error'));

      await expect(migrationService.runMigrations()).rejects.toThrow('SQL Error');
      expect(logger.error).toHaveBeenCalledWith('Migration failed', expect.any(Object));
    });
  });

  describe('getPendingMigrations', () => {
    beforeEach(() => {
      migrationService = MigrationService.initialize(mockDatabaseService);
    });

    it('should return pending migrations', async () => {
      const allMigrations = [
        {
          module: 'core/auth',
          version: '001',
          filename: '001_init.sql',
          sql: 'SQL1',
          checksum: 'abc'
        },
        {
          module: 'core/auth',
          version: '002',
          filename: '002_update.sql',
          sql: 'SQL2',
          checksum: 'def'
        }
      ];

      (migrationService as any).migrations = allMigrations;

      // Mock first migration applied
      mockDatabaseService.query.mockResolvedValue([
        { module: 'core/auth', version: '001' }
      ]);

      const pending = await migrationService.getPendingMigrations();

      expect(pending).toHaveLength(1);
      expect(pending[0].version).toBe('002');
      expect(pending[0]).toHaveProperty('name', '002_update.sql');
    });

    it('should discover migrations if none loaded', async () => {
      vi.mocked(glob).mockResolvedValue([]);
      mockDatabaseService.query.mockResolvedValue([]);

      const pending = await migrationService.getPendingMigrations();

      expect(glob).toHaveBeenCalled();
      expect(pending).toEqual([]);
    });
  });

  describe('getExecutedMigrations', () => {
    beforeEach(() => {
      migrationService = MigrationService.initialize(mockDatabaseService);
    });

    it('should return executed migrations', async () => {
      const executedRows = [
        {
          module: 'core/auth',
          version: '001',
          filename: '001_init.sql',
          checksum: 'abc123',
          applied_at: '2024-01-01 10:00:00'
        },
        {
          module: 'core/auth',
          version: '002',
          filename: '002_update.sql',
          checksum: 'def456',
          applied_at: '2024-01-02 10:00:00'
        }
      ];

      mockDatabaseService.query.mockResolvedValue(executedRows);

      const executed = await migrationService.getExecutedMigrations();

      expect(executed).toHaveLength(2);
      expect(executed[0]).toMatchObject({
        module: 'core/auth',
        version: '001',
        executed_at: '2024-01-01 10:00:00',
        name: '001_init.sql'
      });
    });

    it('should handle missing migrations table', async () => {
      mockDatabaseService.query.mockRejectedValue(new Error('no such table'));

      const executed = await migrationService.getExecutedMigrations();

      expect(executed).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith('No migrations table found', expect.any(Object));
    });
  });

  describe('executeMigration', () => {
    beforeEach(() => {
      migrationService = MigrationService.initialize(mockDatabaseService);
    });

    it('should execute single migration', async () => {
      const migration = {
        module: 'core/auth',
        version: '001',
        filename: '001_init.sql',
        sql: 'CREATE TABLE test (id INTEGER);',
        checksum: 'abc123'
      };

      await migrationService.executeMigration(migration);

      expect(mockDatabaseService.transaction).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Migration completed', {
        module: 'core/auth',
        version: '001'
      });
    });
  });

  describe('rollbackMigration', () => {
    beforeEach(() => {
      migrationService = MigrationService.initialize(mockDatabaseService);
    });

    it('should rollback migration with rollback file', async () => {
      const migration = {
        module: 'core/auth',
        version: '001',
        filename: '001_init.sql',
        sql: '',
        checksum: 'abc123',
        executed_at: '2024-01-01 10:00:00'
      };

      vi.mocked(readFile).mockResolvedValue('DROP TABLE test;');

      await migrationService.rollbackMigration(migration);

      expect(readFile).toHaveBeenCalledWith('001_init.rollback.sql', 'utf-8');
      expect(mockDatabaseService.transaction).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Migration rolled back', {
        module: 'core/auth',
        version: '001'
      });
    });

    it('should handle missing rollback file', async () => {
      const migration = {
        module: 'core/auth',
        version: '001',
        filename: '001_init.sql',
        sql: '',
        checksum: 'abc123',
        executed_at: '2024-01-01 10:00:00'
      };

      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      await migrationService.rollbackMigration(migration);

      expect(logger.warn).toHaveBeenCalledWith(
        'No rollback file found, removing record only',
        expect.any(Object)
      );
      expect(mockDatabaseService.transaction).toHaveBeenCalled();
    });

    it('should handle rollback failures', async () => {
      const migration = {
        module: 'core/auth',
        version: '001',
        filename: '001_init.sql',
        sql: '',
        checksum: 'abc123',
        executed_at: '2024-01-01 10:00:00'
      };

      mockDatabaseService.transaction.mockRejectedValue(new Error('Rollback failed'));

      await expect(migrationService.rollbackMigration(migration)).rejects.toThrow('Rollback failed');
      expect(logger.error).toHaveBeenCalledWith('Rollback failed', expect.any(Object));
    });
  });

  describe('version comparison', () => {
    beforeEach(() => {
      migrationService = MigrationService.initialize(mockDatabaseService);
    });

    it('should compare numeric versions correctly', async () => {
      const mockFiles = [
        '/app/src/modules/test/database/migrations/002_second.sql',
        '/app/src/modules/test/database/migrations/001_first.sql',
        '/app/src/modules/test/database/migrations/010_tenth.sql'
      ];

      vi.mocked(glob).mockResolvedValue(mockFiles);
      vi.mocked(readFile).mockResolvedValue('SQL');

      await migrationService.discoverMigrations();

      const migrations = (migrationService as any).migrations;
      expect(migrations[0].version).toBe('001');
      expect(migrations[1].version).toBe('002');
      expect(migrations[2].version).toBe('010');
    });

    it('should compare semantic versions correctly', async () => {
      const mockFiles = [
        '/app/src/modules/test/database/migrations/v1.2.0_update.sql',
        '/app/src/modules/test/database/migrations/v1.0.0_init.sql',
        '/app/src/modules/test/database/migrations/v1.10.0_major.sql'
      ];

      vi.mocked(glob).mockResolvedValue(mockFiles);
      vi.mocked(readFile).mockResolvedValue('SQL');

      await migrationService.discoverMigrations();

      const migrations = (migrationService as any).migrations;
      expect(migrations[0].version).toBe('v1.0.0');
      expect(migrations[1].version).toBe('v1.10.0');
      expect(migrations[2].version).toBe('v1.2.0');
    });
  });

  describe('checksum calculation', () => {
    beforeEach(() => {
      migrationService = MigrationService.initialize(mockDatabaseService);
    });

    it('should calculate consistent checksums', async () => {
      const sql1 = 'CREATE TABLE test (id INTEGER);';
      const sql2 = 'CREATE TABLE test (id INTEGER);';
      const sql3 = 'ALTER TABLE test ADD COLUMN name TEXT;'; // Different SQL

      const checksum1 = (migrationService as any).calculateChecksum(sql1);
      const checksum2 = (migrationService as any).calculateChecksum(sql2);
      const checksum3 = (migrationService as any).calculateChecksum(sql3);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).not.toBe(checksum3);
      expect(checksum1).toHaveLength(16);
    });
  });
});