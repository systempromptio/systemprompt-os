/**
 * @fileoverview Unit tests for database module
 * @module tests/unit/modules/core/database
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  initializeDatabase, 
  getDatabase, 
  getSchemaService, 
  getMigrationService,
  shutdownDatabase
} from '@/modules/core/database/index.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import { SchemaService } from '@/modules/core/database/services/schema.service.js';
import { MigrationService } from '@/modules/core/database/services/migration.service.js';
import { logger } from '@utils/logger.js';

vi.mock('@/modules/core/database/services/database.service.js', () => ({
  DatabaseService: {
    initialize: vi.fn(),
    getInstance: vi.fn()
  }
}));

vi.mock('@/modules/core/database/services/schema.service.js', () => ({
  SchemaService: {
    initialize: vi.fn(),
    getInstance: vi.fn()
  }
}));

vi.mock('@/modules/core/database/services/migration.service.js', () => ({
  MigrationService: {
    initialize: vi.fn(),
    getInstance: vi.fn()
  }
}));

vi.mock('@utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('Database Module', () => {
  let mockDbService: any;
  let mockSchemaService: any;
  let mockMigrationService: any;
  
  beforeEach(() => {
    mockDbService = {
      getConnection: vi.fn().mockResolvedValue({}),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };
    
    mockSchemaService = {
      discoverSchemas: vi.fn().mockResolvedValue(undefined),
      initializeSchemas: vi.fn().mockResolvedValue(undefined)
    };
    
    mockMigrationService = {
      discoverMigrations: vi.fn().mockResolvedValue(undefined),
      runMigrations: vi.fn().mockResolvedValue(undefined)
    };
    
    vi.mocked(DatabaseService.initialize).mockReturnValue(mockDbService);
    vi.mocked(SchemaService.initialize).mockReturnValue(mockSchemaService);
    vi.mocked(MigrationService.initialize).mockReturnValue(mockMigrationService);
    vi.mocked(DatabaseService.getInstance).mockReturnValue(mockDbService);
    vi.mocked(SchemaService.getInstance).mockReturnValue(mockSchemaService);
    vi.mocked(MigrationService.getInstance).mockReturnValue(mockMigrationService);
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.DATABASE_TYPE;
    delete process.env.DATABASE_FILE;
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_DB;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.POSTGRES_SSL;
    delete process.env.DB_POOL_MIN;
    delete process.env.DB_POOL_MAX;
    delete process.env.DB_IDLE_TIMEOUT;
  });

  describe('initializeDatabase', () => {
    it('should initialize database with default config', async () => {
      await initializeDatabase();
      
      expect(DatabaseService.initialize).toHaveBeenCalledWith({
        type: 'sqlite',
        sqlite: {
          filename: '/data/state/systemprompt.db',
          mode: 'wal'
        },
        postgres: {
          host: 'localhost',
          port: 5432,
          database: 'systemprompt',
          user: 'systemprompt',
          password: undefined,
          ssl: false
        },
        pool: {
          min: 1,
          max: 10,
          idleTimeout: 30000
        }
      });
      
      expect(mockDbService.getConnection).toHaveBeenCalled();
      expect(mockSchemaService.discoverSchemas).toHaveBeenCalled();
      expect(mockSchemaService.initializeSchemas).toHaveBeenCalled();
      expect(mockMigrationService.discoverMigrations).toHaveBeenCalled();
      expect(mockMigrationService.runMigrations).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Database module initialized successfully');
    });

    it('should use environment variables for configuration', async () => {
      process.env.DATABASE_TYPE = 'postgres';
      process.env.DATABASE_FILE = '/custom/path/db.sqlite';
      process.env.POSTGRES_HOST = 'db.example.com';
      process.env.POSTGRES_PORT = '5433';
      process.env.POSTGRES_DB = 'mydb';
      process.env.POSTGRES_USER = 'myuser';
      process.env.POSTGRES_PASSWORD = 'mypass';
      process.env.POSTGRES_SSL = 'true';
      process.env.DB_POOL_MIN = '5';
      process.env.DB_POOL_MAX = '20';
      process.env.DB_IDLE_TIMEOUT = '60000';
      
      await initializeDatabase();
      
      expect(DatabaseService.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'postgres',
          sqlite: {
            filename: '/custom/path/db.sqlite',
            mode: 'wal'
          },
          postgres: {
            host: 'db.example.com',
            port: 5433,
            database: 'mydb',
            user: 'myuser',
            password: 'mypass',
            ssl: true
          },
          pool: {
            min: 5,
            max: 20,
            idleTimeout: 60000
          }
        })
      );
    });

    it('should merge custom config with defaults', async () => {
      const customConfig = {
        type: 'postgres' as const,
        postgres: {
          host: 'custom.host.com',
          port: 5432,
          database: 'customdb',
          user: 'customuser'
        }
      };
      
      await initializeDatabase(customConfig);
      
      expect(DatabaseService.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'postgres',
          postgres: expect.objectContaining({
            host: 'custom.host.com',
            database: 'customdb'
          })
        })
      );
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Connection failed');
      mockDbService.getConnection.mockRejectedValue(error);
      
      await expect(initializeDatabase()).rejects.toThrow('Connection failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize database module', { error });
    });

    it('should use production modules path in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      await initializeDatabase();
      
      expect(mockSchemaService.discoverSchemas).toHaveBeenCalledWith('/app/src/modules');
      expect(mockMigrationService.discoverMigrations).toHaveBeenCalledWith('/app/src/modules');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Service getters', () => {
    it('should return database service instance', () => {
      const result = getDatabase();
      expect(result).toBe(mockDbService);
      expect(DatabaseService.getInstance).toHaveBeenCalled();
    });

    it('should return schema service instance', () => {
      const result = getSchemaService();
      expect(result).toBe(mockSchemaService);
      expect(SchemaService.getInstance).toHaveBeenCalled();
    });

    it('should return migration service instance', () => {
      const result = getMigrationService();
      expect(result).toBe(mockMigrationService);
      expect(MigrationService.getInstance).toHaveBeenCalled();
    });
  });

  describe('shutdownDatabase', () => {
    it('should disconnect database service', async () => {
      await shutdownDatabase();
      
      expect(mockDbService.disconnect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Database module shutdown complete');
    });

    it('should handle shutdown errors', async () => {
      const error = new Error('Disconnect failed');
      mockDbService.disconnect.mockRejectedValue(error);
      
      await shutdownDatabase();
      
      expect(logger.error).toHaveBeenCalledWith('Error during database shutdown', { error });
    });
  });
});