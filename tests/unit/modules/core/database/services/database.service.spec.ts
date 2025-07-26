/**
 * Unit tests for DatabaseService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../../../../../../src/modules/core/database/services/database.service.js';
import { SqliteAdapter } from '../../../../../../src/modules/core/database/adapters/sqlite.adapter.js';
import type { IDatabaseConfig, IDatabaseConnection, IQueryResult, ITransaction } from '../../../../../../src/modules/core/database/types/database.types.js';
import type { ILogger } from '../../../../../../src/modules/core/logger/types/index.js';
import { LogSource } from '../../../../../../src/modules/core/logger/types/index.js';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/database/adapters/sqlite.adapter');

// Create mock logger
const mockLogger: ILogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
  access: vi.fn(),
  clearLogs: vi.fn(),
  getLogs: vi.fn(),
  setDatabaseService: vi.fn()
};

describe('DatabaseService', () => {
  let mockConfig: IDatabaseConfig;
  let mockConnection: IDatabaseConnection;
  let mockTransaction: ITransaction;
  let mockAdapter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton
    (DatabaseService as any).instance = undefined;

    // Mock config
    mockConfig = {
      type: 'sqlite',
      sqlite: {
        filename: ':memory:'
      }
    };

    // Mock transaction
    mockTransaction = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      execute: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined)
    };

    // Mock connection
    mockConnection = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      execute: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn(),
      transaction: vi.fn().mockImplementation((callback) => callback(mockTransaction)),
      close: vi.fn().mockResolvedValue(undefined)
    };

    // Mock adapter
    mockAdapter = {
      connect: vi.fn().mockResolvedValue(mockConnection),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true)
    };

    vi.mocked(SqliteAdapter).mockImplementation(() => mockAdapter);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialize', () => {
    it('should create singleton instance', () => {
      const instance1 = DatabaseService.initialize(mockConfig);
      const initializeSpy = vi.spyOn(DatabaseService, 'initialize');
      const instance2 = DatabaseService.initialize(mockConfig);
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(DatabaseService);
      expect(initializeSpy).toHaveBeenCalledTimes(1);
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
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should create connection if not exists', async () => {
      const conn = await service.getConnection();

      expect(SqliteAdapter).toHaveBeenCalled();
      expect(mockAdapter.connect).toHaveBeenCalledWith(mockConfig);
      expect(conn).toBe(mockConnection);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.DATABASE, 'Database connection established', { type: 'sqlite' });
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
      const error = new Error('Failed to connect');
      mockAdapter.connect.mockRejectedValue(error);

      await expect(service.getConnection()).rejects.toThrow('Failed to connect');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Failed to connect to database', { error });
    });

    it('should throw error for unsupported database type', async () => {
      const unsupportedConfig: IDatabaseConfig = {
        type: 'postgres' as any,
        host: 'localhost'
      };
      
      (DatabaseService as any).instance = undefined; // Reset singleton
      const service = DatabaseService.initialize(unsupportedConfig);
      
      // Mock adapter creation to fail
      vi.mocked(SqliteAdapter).mockImplementation(() => {
        throw new Error('Failed to connect to postgres database');
      });
      
      await expect(service.getConnection()).rejects.toThrow('Failed to connect to postgres database');
    });

    it('should throw error for invalid database type', async () => {
      const invalidConfig: IDatabaseConfig = {
        type: 'mysql' as any,
        host: 'localhost'
      };
      
      (DatabaseService as any).instance = undefined; // Reset singleton
      const service = DatabaseService.initialize(invalidConfig);
      
      // Mock adapter creation to fail
      vi.mocked(SqliteAdapter).mockImplementation(() => {
        throw new Error('Failed to connect to mysql database');
      });
      
      await expect(service.getConnection()).rejects.toThrow('Failed to connect to mysql database');
    });
  });

  describe('query', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
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
      service = DatabaseService.initialize(mockConfig, mockLogger);
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
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should execute callback within transaction', async () => {
      const result = await service.transaction(async (conn) => {
        await conn.execute('INSERT INTO users VALUES (1)');
        const users = await conn.query('SELECT * FROM users');
        return users;
      });

      expect(mockConnection.transaction).toHaveBeenCalled();
      expect(result).toEqual({ rows: [], rowCount: 0 });
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
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should disconnect and clear connection', async () => {
      await service.getConnection(); // Establish connection
      await service.disconnect();

      expect(mockAdapter.disconnect).toHaveBeenCalled();
      expect(await service.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await service.disconnect();

      expect(mockAdapter.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should return false when not connected', async () => {
      expect(await service.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await service.getConnection();
      expect(await service.isConnected()).toBe(true);
    });

    it('should delegate to adapter', async () => {
      await service.getConnection();
      mockAdapter.isConnected.mockReturnValue(false);
      
      expect(await service.isConnected()).toBe(false);
    });
  });

  describe('isInitialized', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should return true if user tables exist', async () => {
      mockConnection.query.mockResolvedValue({ 
        rows: [{ count: 1 }],
        rowCount: 1
      });

      const initialized = await service.isInitialized();

      expect(initialized).toBe(true);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('sqlite_master'),
        undefined
      );
    });

    it('should return false if no user tables exist', async () => {
      mockConnection.query.mockResolvedValue({ 
        rows: [{ count: 0 }],
        rowCount: 1
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
      expect(mockLogger.debug).toHaveBeenCalledWith(LogSource.DATABASE, 'Database not initialized', expect.objectContaining({
        error: expect.any(Error),
        persistToDb: false
      }));
    });
  });

  describe('getDatabaseType', () => {
    it('should return configured database type', () => {
      const service = DatabaseService.initialize(mockConfig);
      expect(service.getDatabaseType()).toBe('sqlite');
    });

    it('should return postgres type when configured', () => {
      const pgConfig: IDatabaseConfig = {
        type: 'postgres',
        postgres: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          user: 'test'
        }
      };
      
      const service = DatabaseService.initialize(pgConfig);
      expect(service.getDatabaseType()).toBe('postgres');
    });

    it('should throw error when config is null', () => {
      const service = DatabaseService.initialize(mockConfig);
      // Manually set config to null to test edge case
      (service as any).config = null;
      
      expect(() => service.getDatabaseType()).toThrow('DatabaseService not initialized. Call initialize() first.');
    });
  });

  describe('isConnected', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should return false when adapter is null', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return adapter connection status when adapter exists', async () => {
      await service.getConnection(); // This creates the adapter
      mockAdapter.isConnected.mockReturnValue(true);
      
      expect(service.isConnected()).toBe(true);
    });

    it('should return false when adapter exists but not connected', async () => {
      await service.getConnection(); // This creates the adapter
      mockAdapter.isConnected.mockReturnValue(false);
      
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('initialization state tracking', () => {
    it('should track initialization state correctly', () => {
      const service = DatabaseService.initialize(mockConfig, mockLogger);
      expect((service as any).initialized).toBe(true);
    });

    it('should prevent getInstance when not initialized', () => {
      (DatabaseService as any).instance = new (DatabaseService as any)();
      (DatabaseService as any).instance.initialized = false;
      
      expect(() => DatabaseService.getInstance()).toThrow('DatabaseService not initialized. Call initialize() first.');
    });

    it('should allow getInstance when initialized', () => {
      const service = DatabaseService.initialize(mockConfig, mockLogger);
      const retrieved = DatabaseService.getInstance();
      
      expect(retrieved).toBe(service);
    });
  });

  describe('getConnection edge cases', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should throw error when connection fails to establish', async () => {
      mockAdapter.connect.mockResolvedValue(null);
      
      await expect(service.getConnection()).rejects.toThrow('Failed to establish database connection');
    });

    it('should handle connection null check after successful adapter connection', async () => {
      // Mock adapter.connect to return null to test connection null check
      mockAdapter.connect.mockResolvedValue(null);
      
      await expect(service.getConnection()).rejects.toThrow('Failed to establish database connection');
    });

    it('should reconnect when adapter reports disconnected', async () => {
      // First connection
      await service.getConnection();
      expect(mockAdapter.connect).toHaveBeenCalledTimes(1);
      
      // Simulate disconnection
      mockAdapter.isConnected.mockReturnValue(false);
      
      // Second call should reconnect
      await service.getConnection();
      expect(mockAdapter.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('private connect method scenarios', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should throw error when config is null during connection', async () => {
      (service as any).config = null;
      
      await expect(service.getConnection()).rejects.toThrow('DatabaseService not initialized. Call initialize() first.');
    });

    it('should handle sqlite adapter creation', async () => {
      await service.getConnection();
      
      expect(SqliteAdapter).toHaveBeenCalled();
      expect(mockAdapter.connect).toHaveBeenCalledWith(mockConfig);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.DATABASE, 'Database connection established', { type: 'sqlite' });
    });

    it('should handle postgres not implemented error', async () => {
      const postgresConfig: IDatabaseConfig = {
        type: 'postgres',
        postgres: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          user: 'test'
        }
      };
      
      (DatabaseService as any).instance = undefined;
      const postgresService = DatabaseService.initialize(postgresConfig, mockLogger);
      
      await expect(postgresService.getConnection()).rejects.toThrow('Failed to connect to postgres database');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Failed to connect to database', expect.objectContaining({
        error: expect.any(Error)
      }));
    });

    it('should handle unknown database type', async () => {
      const unknownConfig: IDatabaseConfig = {
        type: 'unknown' as any
      };
      
      (DatabaseService as any).instance = undefined;
      const unknownService = DatabaseService.initialize(unknownConfig, mockLogger);
      
      await expect(unknownService.getConnection()).rejects.toThrow('Failed to connect to unknown database');
      expect(mockLogger.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Failed to connect to database', expect.objectContaining({
        error: expect.any(Error)
      }));
    });
  });

  describe('transaction edge cases', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should properly wrap transaction connection methods', async () => {
      const testResult = { data: 'test' };
      
      const result = await service.transaction(async (txConn) => {
        // Test that all methods are properly bound
        expect(typeof txConn.query).toBe('function');
        expect(typeof txConn.execute).toBe('function');
        expect(typeof txConn.prepare).toBe('function');
        expect(typeof txConn.transaction).toBe('function');
        expect(typeof txConn.close).toBe('function');
        
        return testResult;
      });
      
      expect(result).toBe(testResult);
      expect(mockConnection.transaction).toHaveBeenCalled();
    });

    it('should prevent nested transactions by throwing error', async () => {
      await expect(service.transaction(async (txConn) => {
        await expect(txConn.transaction(async () => {
          return 'nested';
        })).rejects.toThrow('Nested transactions not supported');
        return 'outer';
      })).resolves.toBe('outer');
    });

    it('should handle transaction errors gracefully', async () => {
      const error = new Error('Transaction execution failed');
      mockConnection.transaction.mockRejectedValue(error);
      
      await expect(service.transaction(async () => {
        return 'should not reach';
      })).rejects.toThrow('Transaction execution failed');
    });

    it('should properly bind transaction methods to transaction object', async () => {
      await service.transaction(async (txConn) => {
        // Call the wrapped methods to ensure they're properly bound
        await txConn.query('SELECT 1');
        await txConn.execute('INSERT INTO test VALUES (1)');
        await txConn.prepare('SELECT * FROM test');
        await txConn.close(); // Should be a no-op
        
        return 'success';
      });
      
      // Verify the original transaction methods were called
      expect(mockTransaction.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockTransaction.execute).toHaveBeenCalledWith('INSERT INTO test VALUES (1)');
      expect(mockTransaction.prepare).toHaveBeenCalledWith('SELECT * FROM test');
    });
  });

  describe('isInitialized edge cases', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should handle empty result set', async () => {
      mockConnection.query.mockResolvedValue({ 
        rows: [],
        rowCount: 0
      });

      const initialized = await service.isInitialized();
      expect(initialized).toBe(false);
    });

    it('should handle undefined result in rows array', async () => {
      mockConnection.query.mockResolvedValue({ 
        rows: [undefined as any],
        rowCount: 1
      });

      const initialized = await service.isInitialized();
      expect(initialized).toBe(false);
    });

    it('should handle result with zero count', async () => {
      mockConnection.query.mockResolvedValue({ 
        rows: [{ count: 0 }],
        rowCount: 1
      });

      const initialized = await service.isInitialized();
      expect(initialized).toBe(false);
    });

    it('should connect before checking if not already connected', async () => {
      mockAdapter.isConnected.mockReturnValue(false);
      mockConnection.query.mockResolvedValue({ 
        rows: [{ count: 1 }],
        rowCount: 1
      });
      
      // Reset connection to null to force reconnection
      (service as any).connection = null;
      (service as any).adapter = null;

      await service.isInitialized();

      expect(SqliteAdapter).toHaveBeenCalled();
    });

    it('should log debug message on query error with correct format', async () => {
      const testError = new Error('Query failed');
      mockConnection.query.mockRejectedValue(testError);

      const initialized = await service.isInitialized();

      expect(initialized).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        LogSource.DATABASE,
        'Database not initialized',
        {
          error: testError,
          persistToDb: false
        }
      );
    });
  });

  describe('query and execute error handling', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should propagate query errors', async () => {
      const queryError = new Error('Query execution failed');
      mockConnection.query.mockRejectedValue(queryError);

      await expect(service.query('SELECT * FROM test')).rejects.toThrow('Query execution failed');
    });

    it('should propagate execute errors', async () => {
      const executeError = new Error('Execute failed');
      mockConnection.execute.mockRejectedValue(executeError);

      await expect(service.execute('CREATE TABLE test')).rejects.toThrow('Execute failed');
    });

    it('should handle query with parameters', async () => {
      const expectedResult = [{ id: 1, name: 'test' }];
      mockConnection.query.mockResolvedValue({ 
        rows: expectedResult,
        rowCount: 1
      });

      const result = await service.query('SELECT * FROM users WHERE id = ?', [1]);

      expect(mockConnection.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toEqual(expectedResult);
    });

    it('should handle execute with parameters', async () => {
      await service.execute('INSERT INTO users VALUES (?)', ['test']);

      expect(mockConnection.execute).toHaveBeenCalledWith('INSERT INTO users VALUES (?)', ['test']);
    });
  });

  describe('disconnect edge cases', () => {
    let service: DatabaseService;

    beforeEach(() => {
      service = DatabaseService.initialize(mockConfig, mockLogger);
    });

    it('should handle disconnect when adapter is null', async () => {
      await service.disconnect();
      
      // Should not throw and should not call adapter methods
      expect(mockAdapter.disconnect).not.toHaveBeenCalled();
    });

    it('should properly cleanup after disconnect', async () => {
      await service.getConnection(); // Establish connection
      await service.disconnect();
      
      expect(mockAdapter.disconnect).toHaveBeenCalled();
      expect((service as any).adapter).toBeNull();
      expect((service as any).connection).toBeNull();
    });

    it('should handle disconnect errors gracefully', async () => {
      await service.getConnection(); // Establish connection
      const disconnectError = new Error('Disconnect failed');
      mockAdapter.disconnect.mockRejectedValue(disconnectError);
      
      await expect(service.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });
});