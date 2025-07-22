/**
 * Unit tests for DatabaseService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../../../../../../src/modules/core/database/services/database.service';
import { SQLiteAdapter } from '../../../../../../src/modules/core/database/adapters/sqlite.adapter';
import { logger } from '../../../../../../src/utils/logger';
import type { DatabaseConfig, DatabaseConnection } from '../../../../../../src/modules/core/database/interfaces/database.interface';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/database/adapters/sqlite.adapter');
vi.mock('../../../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('DatabaseService', () => {
  let mockConfig: DatabaseConfig;
  let mockConnection: DatabaseConnection;
  let mockAdapter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton
    (DatabaseService as any).instance = undefined;

    // Mock config
    mockConfig = {
      type: 'sqlite',
      path: ':memory:'
    };

    // Mock connection
    mockConnection = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      execute: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn(),
      transaction: vi.fn((callback) => callback({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        execute: vi.fn().mockResolvedValue(undefined),
        prepare: vi.fn()
      })),
      close: vi.fn().mockResolvedValue(undefined)
    };

    // Mock adapter
    mockAdapter = {
      connect: vi.fn().mockResolvedValue(mockConnection),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true)
    };

    vi.mocked(SQLiteAdapter).mockImplementation(() => mockAdapter);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialize', () => {
    it('should create singleton instance', () => {
      const instance1 = DatabaseService.initialize(mockConfig);
      const instance2 = DatabaseService.initialize(mockConfig);
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(DatabaseService);
    });

    it('should store config on initialization', () => {
      const service = DatabaseService.initialize(mockConfig);
      expect(service.getDatabaseType()).toBe('sqlite');
    });
  });

  describe('getInstance', () => {
    it('should return instance if initialized', () => {
      DatabaseService.initialize(mockConfig);
      const instance = DatabaseService.getInstance();
      
      expect(instance).toBeInstanceOf(DatabaseService);
    });

    it('should throw if not initialized', () => {
      expect(() => DatabaseService.getInstance()).toThrow('DatabaseService not initialized');
    });
  });

  describe('getConnection', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig);
    });

    it('should create connection if not exists', async () => {
      const conn = await service.getConnection();

      expect(SQLiteAdapter).toHaveBeenCalled();
      expect(mockAdapter.connect).toHaveBeenCalledWith(mockConfig);
      expect(conn).toBe(mockConnection);
      expect(logger.info).toHaveBeenCalledWith('Database connection established', { type: 'sqlite' });
    });

    it('should reuse existing connection', async () => {
      const conn1 = await service.getConnection();
      const conn2 = await service.getConnection();

      expect(conn1).toBe(conn2);
      expect(mockAdapter.connect).toHaveBeenCalledTimes(1);
    });

    it('should reconnect if connection lost', async () => {
      await service.getConnection();
      
      // Simulate connection loss
      mockAdapter.isConnected.mockReturnValue(false);
      
      await service.getConnection();

      expect(mockAdapter.connect).toHaveBeenCalledTimes(2);
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockAdapter.connect.mockRejectedValue(error);

      await expect(service.getConnection()).rejects.toThrow('Connection failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to connect to database', { error });
    });

    it('should throw error for unsupported database type', async () => {
      const unsupportedConfig: DatabaseConfig = {
        type: 'postgres' as any,
        host: 'localhost'
      };
      
      (DatabaseService as any).instance = undefined; // Reset singleton
      const service = DatabaseService.initialize(unsupportedConfig);
      
      // Mock adapter creation to fail
      vi.mocked(SQLiteAdapter).mockImplementation(() => {
        throw new Error('Wrong adapter');
      });
      
      await expect(service.getConnection()).rejects.toThrow('PostgreSQL adapter not yet implemented');
    });

    it('should throw error for invalid database type', async () => {
      const invalidConfig: DatabaseConfig = {
        type: 'mysql' as any,
        host: 'localhost'
      };
      
      (DatabaseService as any).instance = undefined; // Reset singleton
      const service = DatabaseService.initialize(invalidConfig);
      
      // Mock adapter creation to fail
      vi.mocked(SQLiteAdapter).mockImplementation(() => {
        throw new Error('Wrong adapter');
      });
      
      await expect(service.getConnection()).rejects.toThrow('Unsupported database type: mysql');
    });
  });

  describe('query', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig);
    });

    it('should execute query and return rows', async () => {
      const expectedRows = [{ id: 1, name: 'test' }];
      mockConnection.query.mockResolvedValue({ rows: expectedRows });

      const result = await service.query('SELECT * FROM users');

      expect(mockConnection.query).toHaveBeenCalledWith('SELECT * FROM users', undefined);
      expect(result).toEqual(expectedRows);
    });

    it('should pass parameters to query', async () => {
      const expectedRows = [{ id: 1, name: 'test' }];
      mockConnection.query.mockResolvedValue({ rows: expectedRows });

      const result = await service.query('SELECT * FROM users WHERE id = ?', [1]);

      expect(mockConnection.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toEqual(expectedRows);
    });

    it('should handle empty results', async () => {
      mockConnection.query.mockResolvedValue({ rows: [] });

      const result = await service.query('SELECT * FROM users');

      expect(result).toEqual([]);
    });
  });

  describe('execute', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig);
    });

    it('should execute statement without returning results', async () => {
      await service.execute('CREATE TABLE users (id INTEGER)');

      expect(mockConnection.execute).toHaveBeenCalledWith('CREATE TABLE users (id INTEGER)', undefined);
    });

    it('should pass parameters to execute', async () => {
      await service.execute('INSERT INTO users VALUES (?)', [1]);

      expect(mockConnection.execute).toHaveBeenCalledWith('INSERT INTO users VALUES (?)', [1]);
    });
  });

  describe('transaction', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig);
    });

    it('should execute callback within transaction', async () => {
      const result = await service.transaction(async (conn) => {
        await conn.execute('INSERT INTO users VALUES (1)');
        const users = await conn.query('SELECT * FROM users');
        return users;
      });

      expect(mockConnection.transaction).toHaveBeenCalled();
      expect(result).toEqual({ rows: [] });
    });

    it('should prevent nested transactions', async () => {
      await expect(service.transaction(async (conn) => {
        await conn.transaction(async () => {
          // This should throw
        });
      })).rejects.toThrow('Nested transactions not supported');
    });

    it('should handle transaction errors', async () => {
      mockConnection.transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(service.transaction(async () => {
        // Transaction body
      })).rejects.toThrow('Transaction failed');
    });
  });

  describe('disconnect', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig);
    });

    it('should disconnect and clear connection', async () => {
      await service.getConnection(); // Establish connection
      await service.disconnect();

      expect(mockAdapter.disconnect).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await service.disconnect();

      expect(mockAdapter.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig);
    });

    it('should return false when not connected', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await service.getConnection();
      expect(service.isConnected()).toBe(true);
    });

    it('should delegate to adapter', async () => {
      await service.getConnection();
      mockAdapter.isConnected.mockReturnValue(false);
      
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('isInitialized', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig);
    });

    it('should return true if schema table exists', async () => {
      mockConnection.query.mockResolvedValue({ 
        rows: [{ count: 1 }] 
      });

      const initialized = await service.isInitialized();

      expect(initialized).toBe(true);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('_schema_versions'),
        undefined
      );
    });

    it('should return false if schema table does not exist', async () => {
      mockConnection.query.mockResolvedValue({ 
        rows: [{ count: 0 }] 
      });

      const initialized = await service.isInitialized();

      expect(initialized).toBe(false);
    });

    it('should connect if not connected', async () => {
      mockAdapter.isConnected.mockReturnValue(false);
      mockConnection.query.mockResolvedValue({ 
        rows: [{ count: 1 }] 
      });

      await service.isInitialized();

      expect(mockAdapter.connect).toHaveBeenCalled();
    });

    it('should handle query errors', async () => {
      mockConnection.query.mockRejectedValue(new Error('Table not found'));

      const initialized = await service.isInitialized();

      expect(initialized).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith('Database not initialized', expect.any(Object));
    });
  });

  describe('getDatabaseType', () => {
    it('should return configured database type', () => {
      const service = DatabaseService.initialize(mockConfig);
      expect(service.getDatabaseType()).toBe('sqlite');
    });

    it('should return postgres type when configured', () => {
      const pgConfig: DatabaseConfig = {
        type: 'postgres',
        host: 'localhost'
      };
      
      const service = DatabaseService.initialize(pgConfig);
      expect(service.getDatabaseType()).toBe('postgres');
    });
  });
});