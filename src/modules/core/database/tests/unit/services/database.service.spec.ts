/**
 * Unit tests for DatabaseService
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import { SQLiteAdapter } from '@/modules/core/database/adapters/sqlite.adapter';
import { ConnectionError, DatabaseError } from '@/modules/core/database/utils/errors';
import type { DatabaseConfig, DatabaseConnection } from '@/modules/core/database/types';

// Mock the SQLite adapter
jest.mock('@/modules/core/database/adapters/sqlite.adapter');

describe('DatabaseService', () => {
  let mockConnection: jest.Mocked<DatabaseConnection>;
  let mockAdapter: jest.Mocked<SQLiteAdapter>;
  let config: DatabaseConfig;

  beforeEach(() => {
    // Reset the singleton instance
    (DatabaseService as any).instance = null;

    // Setup mock connection
    mockConnection = {
      query: jest.fn(),
      execute: jest.fn(),
      prepare: jest.fn(),
      transaction: jest.fn(),
      close: jest.fn()
    };

    // Setup mock adapter
    mockAdapter = {
      connect: jest.fn().mockResolvedValue(mockConnection),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true)
    } as any;

    // Mock the SQLiteAdapter constructor
    (SQLiteAdapter as jest.MockedClass<typeof SQLiteAdapter>).mockImplementation(() => mockAdapter);

    // Setup config
    config = {
      type: 'sqlite',
      sqlite: {
        filename: '/test/database.db',
        mode: 'wal'
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should create a new instance on first call', () => {
      const service = DatabaseService.initialize(config);
      expect(service).toBeInstanceOf(DatabaseService);
    });

    it('should return the same instance on subsequent calls', () => {
      const service1 = DatabaseService.initialize(config);
      const service2 = DatabaseService.initialize(config);
      expect(service1).toBe(service2);
    });

    it('should accept a logger', () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      const service = DatabaseService.initialize(config, mockLogger);
      expect(service).toBeInstanceOf(DatabaseService);
    });
  });

  describe('getInstance', () => {
    it('should throw error if not initialized', () => {
      expect(() => DatabaseService.getInstance()).toThrow(DatabaseError);
      expect(() => DatabaseService.getInstance()).toThrow('DatabaseService not initialized');
    });

    it('should return instance if initialized', () => {
      const initialized = DatabaseService.initialize(config);
      const instance = DatabaseService.getInstance();
      expect(instance).toBe(initialized);
    });
  });

  describe('getConnection', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(config);
    });

    it('should create connection on first call', async () => {
      const connection = await service.getConnection();
      expect(connection).toBe(mockConnection);
      expect(mockAdapter.connect).toHaveBeenCalledWith(config);
    });

    it('should reuse existing connection if connected', async () => {
      await service.getConnection();
      await service.getConnection();
      expect(mockAdapter.connect).toHaveBeenCalledTimes(1);
    });

    it('should reconnect if adapter is not connected', async () => {
      await service.getConnection();
      mockAdapter.isConnected.mockReturnValue(false);
      await service.getConnection();
      expect(mockAdapter.connect).toHaveBeenCalledTimes(2);
    });

    it('should throw ConnectionError if connection fails', async () => {
      mockAdapter.connect.mockRejectedValue(new Error('Connection failed'));
      await expect(service.getConnection()).rejects.toThrow(ConnectionError);
    });
  });

  describe('query', () => {
    let service: DatabaseService;

    beforeEach(async () => {
      service = DatabaseService.initialize(config);
      mockConnection.query.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('should execute query and return rows', async () => {
      const mockRows = [{ id: 1, name: 'Test' }];
      mockConnection.query.mockResolvedValue({ 
        rows: mockRows, 
        rowCount: mockRows.length 
      });

      const result = await service.query('SELECT * FROM test');
      expect(result).toEqual(mockRows);
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT * FROM test', undefined);
    });

    it('should pass parameters to query', async () => {
      await service.query('SELECT * FROM test WHERE id = ?', [1]);
      expect(mockConnection.query).toHaveBeenCalledWith(
        'SELECT * FROM test WHERE id = ?',
        [1]
      );
    });

    it('should handle query errors', async () => {
      mockConnection.query.mockRejectedValue(new Error('Query failed'));
      await expect(service.query('INVALID SQL')).rejects.toThrow('Query failed');
    });
  });

  describe('execute', () => {
    let service: DatabaseService;

    beforeEach(async () => {
      service = DatabaseService.initialize(config);
    });

    it('should execute statement without returning results', async () => {
      await service.execute('INSERT INTO test (name) VALUES (?)', ['Test']);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT INTO test (name) VALUES (?)',
        ['Test']
      );
    });

    it('should handle execute errors', async () => {
      mockConnection.execute.mockRejectedValue(new Error('Execute failed'));
      await expect(service.execute('INVALID SQL')).rejects.toThrow('Execute failed');
    });
  });

  describe('transaction', () => {
    let service: DatabaseService;

    beforeEach(async () => {
      service = DatabaseService.initialize(config);
    });

    it('should execute callback within transaction', async () => {
      const mockTx = {
        query: jest.fn(),
        execute: jest.fn(),
        prepare: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn()
      };

      mockConnection.transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.transaction(async (conn) => {
        await conn.execute('INSERT INTO test VALUES (1)');
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockConnection.transaction).toHaveBeenCalled();
    });

    it('should prevent nested transactions', async () => {
      const mockTx = {
        query: jest.fn(),
        execute: jest.fn(),
        prepare: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn()
      };

      mockConnection.transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        service.transaction(async (conn) => {
          await conn.transaction(async () => {});
        })
      ).rejects.toThrow('Nested transactions not supported');
    });
  });

  describe('disconnect', () => {
    let service: DatabaseService;

    beforeEach(async () => {
      service = DatabaseService.initialize(config);
      await service.getConnection();
    });

    it('should disconnect and cleanup resources', async () => {
      await service.disconnect();
      expect(mockAdapter.disconnect).toHaveBeenCalled();
    });

    it('should handle multiple disconnect calls gracefully', async () => {
      await service.disconnect();
      await service.disconnect();
      expect(mockAdapter.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDatabaseType', () => {
    it('should return configured database type', () => {
      const service = DatabaseService.initialize(config);
      expect(service.getDatabaseType()).toBe('sqlite');
    });

    it('should return postgres when configured', () => {
      const pgConfig: DatabaseConfig = {
        ...config,
        type: 'postgres'
      };
      (DatabaseService as any).instance = null;
      const service = DatabaseService.initialize(pgConfig);
      expect(service.getDatabaseType()).toBe('postgres');
    });
  });

  describe('isConnected', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(config);
    });

    it('should return false when not connected', async () => {
      const connected = await service.isConnected();
      expect(connected).toBe(false);
    });

    it('should return true when connected', async () => {
      await service.getConnection();
      const connected = await service.isConnected();
      expect(connected).toBe(true);
    });

    it('should return adapter connection status', async () => {
      await service.getConnection();
      mockAdapter.isConnected.mockReturnValue(false);
      const connected = await service.isConnected();
      expect(connected).toBe(false);
    });
  });

  describe('isInitialized', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(config);
    });

    it('should return true if schema tables exist', async () => {
      mockConnection.query.mockResolvedValue({
        rows: [{ count: 1 }],
        rowCount: 1
      });

      const initialized = await service.isInitialized();
      expect(initialized).toBe(true);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('_schema_versions'),
        undefined
      );
    });

    it('should return false if schema tables do not exist', async () => {
      mockConnection.query.mockResolvedValue({
        rows: [{ count: 0 }],
        rowCount: 1
      });

      const initialized = await service.isInitialized();
      expect(initialized).toBe(false);
    });

    it('should return false on query error', async () => {
      mockConnection.query.mockRejectedValue(new Error('Table not found'));
      const initialized = await service.isInitialized();
      expect(initialized).toBe(false);
    });
  });

  describe('error handling', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(config);
    });

    it('should throw ConnectionError for unsupported database type', async () => {
      (service as any).config.type = 'mysql';
      await expect(service.getConnection()).rejects.toThrow('Unsupported database type');
    });

    it('should throw ConnectionError for postgres (not implemented)', async () => {
      (service as any).config.type = 'postgres';
      await expect(service.getConnection()).rejects.toThrow('PostgreSQL adapter not yet implemented');
    });
  });
});