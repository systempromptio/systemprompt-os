/**
 * @fileoverview Unit tests for SQLite database adapter
 * @module tests/unit/modules/core/database/adapters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SqliteAdapter } from '@/modules/core/database/adapters/sqlite.adapter.js';
import type { IDatabaseConfig } from '@/modules/core/database/types/database.types.js';

// Mock better-sqlite3
const mockDatabase = {
  prepare: vi.fn(),
  exec: vi.fn(),
  pragma: vi.fn(),
  close: vi.fn(),
  open: true
};

const mockStatement = {
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn()
};

vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => mockDatabase)
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('SQLiteAdapter', () => {
  let adapter: SqliteAdapter;
  
  beforeEach(() => {
    adapter = new SqliteAdapter();
    vi.clearAllMocks();
    mockDatabase.prepare.mockReturnValue(mockStatement);
    mockDatabase.open = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to database successfully', async () => {
      const config: IDatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: '/path/to/db.sqlite',
          mode: 'wal'
        }
      };

      const connection = await adapter.connect(config);
      
      expect(connection).toBeDefined();
      expect(mockDatabase.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('busy_timeout = 5000');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('synchronous = NORMAL');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('cache_size = -64000');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('foreign_keys = ON');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('temp_store = MEMORY');
    });

    it('should throw error if sqlite config is missing', async () => {
      const config: IDatabaseConfig = {
        type: 'sqlite'
      };
      
      await expect(adapter.connect(config)).rejects.toThrow('SQLite configuration is required');
    });

    it('should create directory if it does not exist', async () => {
      const { mkdir } = await import('node:fs/promises');
      const config: IDatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: '/path/to/nested/db.sqlite'
        }
      };

      await adapter.connect(config);
      
      expect(mkdir).toHaveBeenCalledWith('/path/to/nested', { recursive: true });
    });

    it('should handle connection errors', async () => {
      const Database = (await import('better-sqlite3')).default;
      const error = new Error('Connection failed');
      vi.mocked(Database).mockImplementationOnce(() => {
        throw error;
      });

      const config: IDatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: '/path/to/db.sqlite'
        }
      };

      await expect(adapter.connect(config)).rejects.toThrow(
        'Failed to connect to SQLite database at /path/to/db.sqlite'
      );
    });
  });

  describe('disconnect', () => {
    it('should close database connection', async () => {
      const config: IDatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: '/path/to/db.sqlite'
        }
      };

      await adapter.connect(config);
      await adapter.disconnect();
      
      expect(mockDatabase.close).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await adapter.disconnect();
      expect(mockDatabase.close).not.toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      const config: IDatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: '/path/to/db.sqlite'
        }
      };

      await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);
    });

    it('should return false when database is closed', async () => {
      const config: IDatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: '/path/to/db.sqlite'
        }
      };

      await adapter.connect(config);
      mockDatabase.open = false;
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('DatabaseConnection', () => {
    let connection: any;
    
    beforeEach(async () => {
      const config: IDatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: '/path/to/db.sqlite'
        }
      };
      connection = await adapter.connect(config);
    });

    describe('query', () => {
      it('should execute query and return results', async () => {
        const mockRows = [{ id: 1, name: 'test' }];
        mockStatement.all.mockReturnValue(mockRows);

        const result = await connection.query('SELECT * FROM users WHERE id = ?', [1]);
        
        expect(mockDatabase.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
        expect(mockStatement.all).toHaveBeenCalledWith(1);
        expect(result).toEqual({
          rows: mockRows,
          rowCount: 1
        });
      });

      it('should handle query without parameters', async () => {
        const mockRows = [];
        mockStatement.all.mockReturnValue(mockRows);

        const result = await connection.query('SELECT * FROM users');
        
        expect(mockStatement.all).toHaveBeenCalledWith();
        expect(result).toEqual({
          rows: [],
          rowCount: 0
        });
      });
    });

    describe('execute', () => {
      it('should execute statement with parameters', async () => {
        await connection.execute('INSERT INTO users (name) VALUES (?)', ['John']);
        
        expect(mockDatabase.prepare).toHaveBeenCalledWith('INSERT INTO users (name) VALUES (?)');
        expect(mockStatement.run).toHaveBeenCalledWith('John');
      });

      it('should execute statement without parameters', async () => {
        await connection.execute('DELETE FROM users');
        
        expect(mockDatabase.exec).toHaveBeenCalledWith('DELETE FROM users');
      });
    });

    describe('prepare', () => {
      it('should return prepared statement', async () => {
        const stmt = await connection.prepare('SELECT * FROM users WHERE id = ?');
        
        expect(stmt).toBeDefined();
        expect(mockDatabase.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
      });
    });

    describe('transaction', () => {
      it('should commit transaction on success', async () => {
        const result = await connection.transaction(async (tx: any) => {
          await tx.execute('INSERT INTO users (name) VALUES (?)', ['John']);
          return 'success';
        });
        
        expect(mockDatabase.exec).toHaveBeenCalledWith('BEGIN');
        expect(mockDatabase.exec).toHaveBeenCalledWith('COMMIT');
        expect(result).toBe('success');
      });

      it('should rollback transaction on error', async () => {
        const error = new Error('Transaction failed');
        
        await expect(
          connection.transaction(async (tx: any) => {
            throw error;
          })
        ).rejects.toThrow('Transaction failed');
        
        expect(mockDatabase.exec).toHaveBeenCalledWith('BEGIN');
        expect(mockDatabase.exec).toHaveBeenCalledWith('ROLLBACK');
      });
    });

    describe('close', () => {
      it('should close connection', async () => {
        await connection.close();
        expect(mockDatabase.close).toHaveBeenCalled();
      });
    });
  });

  describe('PreparedStatement', () => {
    let connection: any;
    let stmt: any;
    
    beforeEach(async () => {
      const config: IDatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: '/path/to/db.sqlite'
        }
      };
      connection = await adapter.connect(config);
      stmt = await connection.prepare('SELECT * FROM users WHERE id = ?');
    });

    it('should execute statement and return results', async () => {
      const mockRows = [{ id: 1, name: 'test' }];
      mockStatement.all.mockReturnValue(mockRows);

      const result = await stmt.execute([1]);
      
      expect(mockStatement.all).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        rows: mockRows,
        rowCount: 1
      });
    });

    it('should get all rows', async () => {
      const mockRows = [{ id: 1 }, { id: 2 }];
      mockStatement.all.mockReturnValue(mockRows);

      const rows = await stmt.all([]);
      
      expect(rows).toEqual(mockRows);
    });

    it('should get single row', async () => {
      const mockRow = { id: 1, name: 'test' };
      mockStatement.get.mockReturnValue(mockRow);

      const row = await stmt.get([1]);
      
      expect(mockStatement.get).toHaveBeenCalledWith(1);
      expect(row).toEqual(mockRow);
    });

    it('should run statement and return changes', async () => {
      mockStatement.run.mockReturnValue({ changes: 1, lastInsertRowid: 42 });

      const result = await stmt.run(['John']);
      
      expect(mockStatement.run).toHaveBeenCalledWith('John');
      expect(result).toEqual({
        changes: 1,
        lastInsertRowid: 42
      });
    });

    it('should finalize statement', async () => {
      await stmt.finalize();
      // SQLite statements don't need explicit finalization in better-sqlite3
    });
  });
});