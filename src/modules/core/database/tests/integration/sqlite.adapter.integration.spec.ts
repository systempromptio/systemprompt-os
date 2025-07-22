/**
 * Integration tests for SQLite adapter
 */

import { SQLiteAdapter } from '@/modules/core/database/adapters/sqlite.adapter';
import { ConnectionError, QueryError, TransactionError } from '@/modules/core/database/utils/errors';
import type { DatabaseConfig, DatabaseConnection } from '@/modules/core/database/types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('SQLiteAdapter Integration Tests', () => {
  let adapter: SQLiteAdapter;
  let connection: DatabaseConnection;
  let testDbPath: string;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test database
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-test-'));
    testDbPath = path.join(testDir, 'test.db');
    
    adapter = new SQLiteAdapter();
  });

  afterEach(async () => {
    // Cleanup
    if (connection) {
      await connection.close();
    }
    if (adapter) {
      await adapter.disconnect();
    }
    
    // Remove test database
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('connect', () => {
    it('should successfully connect to SQLite database', async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: testDbPath,
          mode: 'wal'
        }
      };

      connection = await adapter.connect(config);
      
      expect(connection).toBeDefined();
      expect(adapter.isConnected()).toBe(true);
    });

    it('should create database file if it does not exist', async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: testDbPath
        }
      };

      connection = await adapter.connect(config);
      
      const fileExists = await fs.access(testDbPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should throw ConnectionError if sqlite config is missing', async () => {
      const config: DatabaseConfig = {
        type: 'sqlite'
      };

      await expect(adapter.connect(config)).rejects.toThrow(ConnectionError);
      await expect(adapter.connect(config)).rejects.toThrow('SQLite configuration is required');
    });

    it('should apply SQLite pragmas', async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          filename: testDbPath
        }
      };

      connection = await adapter.connect(config);
      
      // Check journal mode
      const result = await connection.query<{ journal_mode: string }>('PRAGMA journal_mode');
      expect(result.rows[0].journal_mode.toUpperCase()).toBe('WAL');
    });
  });

  describe('query operations', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        sqlite: { filename: testDbPath }
      };
      connection = await adapter.connect(config);
      
      // Create test table
      await connection.execute(`
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER
        )
      `);
    });

    it('should execute queries and return results', async () => {
      // Insert test data
      await connection.execute(
        'INSERT INTO test_users (name, email, age) VALUES (?, ?, ?)',
        ['John Doe', 'john@example.com', 30]
      );

      // Query data
      const result = await connection.query<{ id: number; name: string; email: string; age: number }>(
        'SELECT * FROM test_users WHERE email = ?',
        ['john@example.com']
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      });
      expect(result.rowCount).toBe(1);
    });

    it('should handle empty result sets', async () => {
      const result = await connection.query('SELECT * FROM test_users WHERE id = ?', [999]);
      
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should execute statements without returning results', async () => {
      await expect(
        connection.execute(
          'INSERT INTO test_users (name, email) VALUES (?, ?)',
          ['Jane Doe', 'jane@example.com']
        )
      ).resolves.toBeUndefined();

      const result = await connection.query('SELECT COUNT(*) as count FROM test_users');
      expect(result.rows[0].count).toBe(1);
    });

    it('should handle SQL execution with no parameters', async () => {
      await connection.execute('DELETE FROM test_users');
      
      const result = await connection.query('SELECT COUNT(*) as count FROM test_users');
      expect(result.rows[0].count).toBe(0);
    });
  });

  describe('prepared statements', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        sqlite: { filename: testDbPath }
      };
      connection = await adapter.connect(config);
      
      await connection.execute(`
        CREATE TABLE test_products (
          id INTEGER PRIMARY KEY,
          name TEXT,
          price REAL
        )
      `);
    });

    it('should prepare and execute statements', async () => {
      const stmt = await connection.prepare(
        'INSERT INTO test_products (name, price) VALUES (?, ?)'
      );

      const result = await stmt.run(['Product 1', 19.99]);
      
      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeGreaterThan(0);
      
      await stmt.finalize();
    });

    it('should retrieve single row with get()', async () => {
      await connection.execute(
        'INSERT INTO test_products (id, name, price) VALUES (1, ?, ?)',
        ['Test Product', 9.99]
      );

      const stmt = await connection.prepare('SELECT * FROM test_products WHERE id = ?');
      const product = await stmt.get<{ id: number; name: string; price: number }>([1]);
      
      expect(product).toMatchObject({
        id: 1,
        name: 'Test Product',
        price: 9.99
      });
      
      await stmt.finalize();
    });

    it('should retrieve all rows with all()', async () => {
      // Insert multiple products
      for (let i = 1; i <= 3; i++) {
        await connection.execute(
          'INSERT INTO test_products (name, price) VALUES (?, ?)',
          [`Product ${i}`, i * 10]
        );
      }

      const stmt = await connection.prepare('SELECT * FROM test_products WHERE price > ?');
      const products = await stmt.all<{ name: string; price: number }>([15]);
      
      expect(products).toHaveLength(2);
      expect(products[0].price).toBeGreaterThan(15);
      expect(products[1].price).toBeGreaterThan(15);
      
      await stmt.finalize();
    });
  });

  describe('transactions', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        sqlite: { filename: testDbPath }
      };
      connection = await adapter.connect(config);
      
      await connection.execute(`
        CREATE TABLE test_accounts (
          id INTEGER PRIMARY KEY,
          balance REAL NOT NULL
        )
      `);
      
      // Create test accounts
      await connection.execute('INSERT INTO test_accounts (id, balance) VALUES (1, 100), (2, 50)');
    });

    it('should commit successful transactions', async () => {
      await connection.transaction(async (tx) => {
        // Transfer money between accounts
        await tx.execute('UPDATE test_accounts SET balance = balance - 30 WHERE id = 1');
        await tx.execute('UPDATE test_accounts SET balance = balance + 30 WHERE id = 2');
      });

      const result = await connection.query<{ id: number; balance: number }>(
        'SELECT * FROM test_accounts ORDER BY id'
      );
      
      expect(result.rows[0].balance).toBe(70);
      expect(result.rows[1].balance).toBe(80);
    });

    it('should rollback failed transactions', async () => {
      await expect(
        connection.transaction(async (tx) => {
          await tx.execute('UPDATE test_accounts SET balance = balance - 30 WHERE id = 1');
          // This should fail due to constraint
          throw new Error('Simulated failure');
        })
      ).rejects.toThrow('Simulated failure');

      // Check that changes were rolled back
      const result = await connection.query<{ balance: number }>(
        'SELECT balance FROM test_accounts WHERE id = 1'
      );
      expect(result.rows[0].balance).toBe(100);
    });

    it('should prevent nested transactions', async () => {
      await expect(
        connection.transaction(async (tx) => {
          await tx.transaction(async () => {
            // This should not be allowed
          });
        })
      ).rejects.toThrow(TransactionError);
    });

    it('should handle transaction with prepare statements', async () => {
      await connection.transaction(async (tx) => {
        const stmt = await tx.prepare('UPDATE test_accounts SET balance = ? WHERE id = ?');
        await stmt.run([200, 1]);
        await stmt.run([150, 2]);
        await stmt.finalize();
      });

      const result = await connection.query('SELECT SUM(balance) as total FROM test_accounts');
      expect(result.rows[0].total).toBe(350);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        sqlite: { filename: testDbPath }
      };
      connection = await adapter.connect(config);
    });

    it('should handle SQL syntax errors', async () => {
      await expect(
        connection.query('INVALID SQL SYNTAX')
      ).rejects.toThrow();
    });

    it('should handle constraint violations', async () => {
      await connection.execute('CREATE TABLE test_unique (id INTEGER PRIMARY KEY, email TEXT UNIQUE)');
      await connection.execute('INSERT INTO test_unique (email) VALUES (?)', ['test@example.com']);
      
      await expect(
        connection.execute('INSERT INTO test_unique (email) VALUES (?)', ['test@example.com'])
      ).rejects.toThrow();
    });

    it('should handle missing table errors', async () => {
      await expect(
        connection.query('SELECT * FROM non_existent_table')
      ).rejects.toThrow();
    });
  });

  describe('disconnect', () => {
    it('should close database connection', async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        sqlite: { filename: testDbPath }
      };

      connection = await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);
      
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
      
      // Should not be able to query after disconnect
      await expect(
        connection.query('SELECT 1')
      ).rejects.toThrow();
    });

    it('should handle multiple disconnect calls', async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        sqlite: { filename: testDbPath }
      };

      await adapter.connect(config);
      
      await adapter.disconnect();
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });
});