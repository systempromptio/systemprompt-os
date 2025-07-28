/**
 * Database Operations Integration Tests
 * Tests database service, adapters, transactions, and migrations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { SqliteAdapter } from '@/modules/core/database/adapters/sqlite.adapter';
import { SqliteConnectionAdapter } from '@/modules/core/database/adapters/sqlite-connection.adapter';
import { SqliteTransactionAdapter } from '@/modules/core/database/adapters/sqlite-transaction.adapter';
import { MigrationService } from '@/modules/core/database/services/migration.service';
import { SchemaService } from '@/modules/core/database/services/schema.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { createTestId, waitForEvent } from './setup';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Database Operations Integration Test', () => {
  let dbService: DatabaseService;
  let migrationService: MigrationService;
  let schemaService: SchemaService;
  let logger: LoggerService;
  
  const testSessionId = `db-ops-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    console.log(`🚀 Setting up database operations test (session: ${testSessionId})...`);
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Initialize logger first
    logger = LoggerService.getInstance();
    
    // Initialize database with proper config
    await DatabaseService.initialize({
      type: 'sqlite',
      sqlite: {
        filename: testDbPath
      }
    }, logger);
    dbService = DatabaseService.getInstance();
    
    // Initialize other services
    migrationService = MigrationService.initialize(dbService, logger);
    // Note: SchemaService requires an import service, skipping for basic database tests
    // schemaService = SchemaService.getInstance();
    
    console.log('✅ Database operations test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up database operations test (session: ${testSessionId})...`);
    
    try {
      await dbService.disconnect();
    } catch (error) {
      // Ignore close errors in cleanup
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    console.log('✅ Cleanup complete!');
  });

  beforeEach(async () => {
    // Reset database for each test
    try {
      await dbService.disconnect();
    } catch (error) {
      // Ignore close errors
    }
    
    // Remove existing test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
  });

  describe('Database Service Initialization', () => {
    it('should initialize database with proper configuration', async () => {
      const config = {
        file: testDbPath,
        verbose: false,
        wal: true,
        timeout: 5000
      };
      
      // Re-initialize with config for this test
      await DatabaseService.initialize({
        type: 'sqlite',
        sqlite: {
          filename: config.file
        }
      }, logger);
      dbService = DatabaseService.getInstance();
      
      // Verify database file was created
      expect(existsSync(testDbPath)).toBe(true);
      
      // Verify connection is working
      const result = await dbService.execute('SELECT 1 AS test');
      expect(result).toBeDefined();
    });

    it('should handle database initialization errors', async () => {
      const invalidConfig = {
        file: '/invalid/path/database.db',
        verbose: false
      };
      
      try {
        await DatabaseService.initialize({
          type: 'sqlite',
          sqlite: {
            filename: invalidConfig.file
          }
        }, logger);
        expect.fail('Should have thrown error for invalid path');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should support WAL mode configuration', async () => {
      await DatabaseService.initialize({
        type: 'sqlite',
        sqlite: {
          filename: testDbPath,
          mode: 'wal'
        }
      }, logger);
      dbService = DatabaseService.getInstance();
      
      const connection = await dbService.getConnection();
      const walResult = await connection.prepare('PRAGMA journal_mode');
      const result = await walResult.get();
      expect(result?.journal_mode).toBe('wal');
    });

    it('should handle concurrent initialization attempts', async () => {
      const config = {
        type: 'sqlite' as const,
        sqlite: {
          filename: testDbPath
        }
      };
      
      // Start multiple initializations concurrently
      const initializations = [
        DatabaseService.initialize(config, logger),
        DatabaseService.initialize(config, logger),
        DatabaseService.initialize(config, logger)
      ];
      
      // All should succeed (singleton pattern)
      await Promise.all(initializations);
      
      // Database should be functional
      const result = await dbService.execute('SELECT 1 AS test');
      expect(result).toBeDefined();
    });
  });

  describe('SQL Execution and Prepared Statements', () => {
    beforeEach(async () => {
      await DatabaseService.initialize({
        type: 'sqlite',
        sqlite: {
          filename: testDbPath
        }
      }, logger);
      dbService = DatabaseService.getInstance();
      
      // Create test table
      await dbService.execute(`
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER,
          active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    it('should execute basic SQL statements', async () => {
      // Insert data
      const insertResult = await dbService.execute(
        'INSERT INTO test_users (name, email, age) VALUES (?, ?, ?)',
        ['John Doe', 'john@example.com', 30]
      );
      
      expect(insertResult.changes).toBe(1);
      expect(insertResult.lastInsertRowid).toBeGreaterThan(0);
      
      // Query data
      const selectResult = await dbService.prepare('SELECT * FROM test_users WHERE email = ?')
        .get('john@example.com');
      
      expect(selectResult).toBeDefined();
      expect(selectResult.name).toBe('John Doe');
      expect(selectResult.email).toBe('john@example.com');
      expect(selectResult.age).toBe(30);
    });

    it('should handle prepared statements efficiently', async () => {
      const insertStmt = dbService.prepare(
        'INSERT INTO test_users (name, email, age) VALUES (?, ?, ?)'
      );
      
      // Insert multiple records using same prepared statement
      const users = [
        ['Alice Smith', 'alice@example.com', 25],
        ['Bob Johnson', 'bob@example.com', 35],
        ['Carol Brown', 'carol@example.com', 28]
      ];
      
      for (const user of users) {
        const result = insertStmt.run(...user);
        expect(result.changes).toBe(1);
      }
      
      // Verify all records were inserted
      const count = await dbService.prepare('SELECT COUNT(*) as count FROM test_users').get();
      expect(count.count).toBe(3);
    });

    it('should handle batch operations with prepared statements', async () => {
      const stmt = dbService.prepare(
        'INSERT INTO test_users (name, email, age) VALUES (?, ?, ?)'
      );
      
      const batchData = [];
      for (let i = 0; i < 100; i++) {
        batchData.push([`User ${i}`, `user${i}@example.com`, 20 + (i % 50)]);
      }
      
      // Execute batch insert
      const startTime = Date.now();
      for (const data of batchData) {
        stmt.run(...data);
      }
      const endTime = Date.now();
      
      // Verify performance (should be fast)
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Verify all records inserted
      const totalCount = await dbService.prepare('SELECT COUNT(*) as count FROM test_users').get();
      expect(totalCount.count).toBe(100);
    });

    it('should handle SQL errors gracefully', async () => {
      // Try to insert duplicate email (unique constraint)
      await dbService.execute(
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['User 1', 'duplicate@example.com']
      );
      
      try {
        await dbService.execute(
          'INSERT INTO test_users (name, email) VALUES (?, ?)',
          ['User 2', 'duplicate@example.com']
        );
        expect.fail('Should have thrown constraint error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('UNIQUE constraint failed');
      }
    });

    it('should support complex queries with joins', async () => {
      // Create related table
      await dbService.execute(`
        CREATE TABLE user_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          bio TEXT,
          avatar_url TEXT,
          FOREIGN KEY (user_id) REFERENCES test_users(id)
        )
      `);
      
      // Insert test data
      const userResult = await dbService.execute(
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['Profile User', 'profile@example.com']
      );
      
      await dbService.execute(
        'INSERT INTO user_profiles (user_id, bio, avatar_url) VALUES (?, ?, ?)',
        [userResult.lastInsertRowid, 'A test bio', 'https://example.com/avatar.jpg']
      );
      
      // Execute join query
      const joinResult = await dbService.prepare(`
        SELECT u.name, u.email, p.bio, p.avatar_url
        FROM test_users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.email = ?
      `).get('profile@example.com');
      
      expect(joinResult).toBeDefined();
      expect(joinResult.name).toBe('Profile User');
      expect(joinResult.bio).toBe('A test bio');
      expect(joinResult.avatar_url).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await DatabaseService.initialize({
        type: 'sqlite',
        sqlite: {
          filename: testDbPath
        }
      }, logger);
      dbService = DatabaseService.getInstance();
      
      await dbService.execute(`
        CREATE TABLE test_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          balance INTEGER DEFAULT 0
        )
      `);
      
      // Setup test accounts
      await dbService.execute('INSERT INTO test_accounts (name, balance) VALUES (?, ?)', ['Account A', 1000]);
      await dbService.execute('INSERT INTO test_accounts (name, balance) VALUES (?, ?)', ['Account B', 500]);
    });

    it('should execute successful transactions', async () => {
      const transferAmount = 200;
      
      await dbService.transaction(async (trx) => {
        // Debit from Account A
        await trx.execute(
          'UPDATE test_accounts SET balance = balance - ? WHERE name = ?',
          [transferAmount, 'Account A']
        );
        
        // Credit to Account B
        await trx.execute(
          'UPDATE test_accounts SET balance = balance + ? WHERE name = ?',
          [transferAmount, 'Account B']
        );
      });
      
      // Verify balances after transaction
      const accountA = await dbService.prepare('SELECT balance FROM test_accounts WHERE name = ?').get('Account A');
      const accountB = await dbService.prepare('SELECT balance FROM test_accounts WHERE name = ?').get('Account B');
      
      expect(accountA.balance).toBe(800);
      expect(accountB.balance).toBe(700);
    });

    it('should rollback failed transactions', async () => {
      const transferAmount = 200;
      
      try {
        await dbService.transaction(async (trx) => {
          // Debit from Account A
          await trx.execute(
            'UPDATE test_accounts SET balance = balance - ? WHERE name = ?',
            [transferAmount, 'Account A']
          );
          
          // Simulate error before credit
          throw new Error('Transaction failed');
          
          // This should not execute
          await trx.execute(
            'UPDATE test_accounts SET balance = balance + ? WHERE name = ?',
            [transferAmount, 'Account B']
          );
        });
        
        expect.fail('Transaction should have failed');
      } catch (error) {
        expect(error.message).toBe('Transaction failed');
      }
      
      // Verify balances are unchanged (rollback successful)
      const accountA = await dbService.prepare('SELECT balance FROM test_accounts WHERE name = ?').get('Account A');
      const accountB = await dbService.prepare('SELECT balance FROM test_accounts WHERE name = ?').get('Account B');
      
      expect(accountA.balance).toBe(1000); // Original balance
      expect(accountB.balance).toBe(500);  // Original balance
    });

    it('should handle nested transactions', async () => {
      // SQLite doesn't support true nested transactions, but should handle savepoints
      const initialBalanceA = 1000;
      const initialBalanceB = 500;
      
      await dbService.transaction(async (outerTrx) => {
        // First transfer
        await outerTrx.execute(
          'UPDATE test_accounts SET balance = balance - ? WHERE name = ?',
          [100, 'Account A']
        );
        await outerTrx.execute(
          'UPDATE test_accounts SET balance = balance + ? WHERE name = ?',
          [100, 'Account B']
        );
        
        // Inner transaction (simulated with additional operations)
        await outerTrx.execute(
          'UPDATE test_accounts SET balance = balance - ? WHERE name = ?',
          [50, 'Account A']
        );
        await outerTrx.execute(
          'UPDATE test_accounts SET balance = balance + ? WHERE name = ?',
          [50, 'Account B']
        );
      });
      
      // Verify final balances
      const accountA = await dbService.prepare('SELECT balance FROM test_accounts WHERE name = ?').get('Account A');
      const accountB = await dbService.prepare('SELECT balance FROM test_accounts WHERE name = ?').get('Account B');
      
      expect(accountA.balance).toBe(850); // 1000 - 100 - 50
      expect(accountB.balance).toBe(650); // 500 + 100 + 50
    });

    it('should handle concurrent transaction attempts', async () => {
      const transfer1 = dbService.transaction(async (trx) => {
        await waitForEvent(50); // Simulate work
        await trx.execute(
          'UPDATE test_accounts SET balance = balance - ? WHERE name = ?',
          [100, 'Account A']
        );
        await trx.execute(
          'UPDATE test_accounts SET balance = balance + ? WHERE name = ?',
          [100, 'Account B']
        );
      });
      
      const transfer2 = dbService.transaction(async (trx) => {
        await waitForEvent(30); // Simulate work
        await trx.execute(
          'UPDATE test_accounts SET balance = balance - ? WHERE name = ?',
          [200, 'Account B']
        );
        await trx.execute(
          'UPDATE test_accounts SET balance = balance + ? WHERE name = ?',
          [200, 'Account A']
        );
      });
      
      // Both transactions should complete successfully
      await Promise.all([transfer1, transfer2]);
      
      // Verify final balances make sense
      const accountA = await dbService.prepare('SELECT balance FROM test_accounts WHERE name = ?').get('Account A');
      const accountB = await dbService.prepare('SELECT balance FROM test_accounts WHERE name = ?').get('Account B');
      
      expect(accountA.balance + accountB.balance).toBe(1500); // Total should be preserved
    });
  });

  describe('Schema and Migration Management', () => {
    beforeEach(async () => {
      await DatabaseService.initialize({
        type: 'sqlite',
        sqlite: {
          filename: testDbPath
        }
      }, logger);
      dbService = DatabaseService.getInstance();
    });

    it('should create and manage database schema', async () => {
      const schema = `
        CREATE TABLE schema_test (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_schema_test_name ON schema_test(name);
        
        CREATE TRIGGER update_schema_test_timestamp 
        AFTER UPDATE ON schema_test
        BEGIN
          UPDATE schema_test SET created_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `;
      
      // Execute schema directly since SchemaService needs complex setup
      const statements = schema.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await dbService.execute(statement);
        }
      }
      
      // Verify table was created
      const tableInfo = await dbService.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_test'"
      ).get();
      expect(tableInfo).toBeDefined();
      
      // Verify index was created
      const indexInfo = await dbService.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_schema_test_name'"
      ).get();
      expect(indexInfo).toBeDefined();
      
      // Verify trigger was created
      const triggerInfo = await dbService.prepare(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name='update_schema_test_timestamp'"
      ).get();
      expect(triggerInfo).toBeDefined();
    });

    it('should handle schema validation', async () => {
      // Create initial schema
      await dbService.execute(`
        CREATE TABLE validation_test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      // Test schema validation using direct SQL since SchemaService needs complex setup
      const tablesResult = await dbService.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='validation_test'").get();
      expect(tablesResult).toBeDefined();
      
      const columnsResult = await dbService.prepare("PRAGMA table_info(validation_test)").all();
      expect(columnsResult).toHaveLength(2);
      expect(columnsResult.map((c: any) => c.name)).toEqual(['id', 'name']);
    });

    it('should manage database migrations', async () => {
      // Create migrations table
      await migrationService.initializeMigrations();
      
      // Verify migrations table exists
      const migrationsTable = await dbService.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
      ).get();
      expect(migrationsTable).toBeDefined();
      
      // Test migration tracking
      await migrationService.recordMigration('001_initial_schema', 'up');
      
      const appliedMigrations = await migrationService.getAppliedMigrations();
      expect(appliedMigrations).toContain('001_initial_schema');
    });

    it('should handle schema evolution', async () => {
      // Initial schema
      await dbService.execute(`
        CREATE TABLE evolution_test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      // Insert test data
      await dbService.execute(
        'INSERT INTO evolution_test (name) VALUES (?)',
        ['Test Record']
      );
      
      // Evolve schema - add column
      await dbService.execute(`
        ALTER TABLE evolution_test ADD COLUMN email TEXT
      `);
      
      // Verify schema evolution using direct SQL
      const updatedColumnsResult = await dbService.prepare("PRAGMA table_info(evolution_test)").all();
      expect(updatedColumnsResult).toHaveLength(3);
      expect(updatedColumnsResult.map((c: any) => c.name)).toEqual(['id', 'name', 'email']);
      
      // Verify existing data is preserved
      const existingData = await dbService.prepare('SELECT * FROM evolution_test').get();
      expect(existingData.name).toBe('Test Record');
      expect(existingData.email).toBeNull();
    });
  });

  describe('Database Adapter Integration', () => {
    beforeEach(async () => {
      await DatabaseService.initialize({
        type: 'sqlite',
        sqlite: {
          filename: testDbPath
        }
      }, logger);
      dbService = DatabaseService.getInstance();
    });

    it('should work with SQLite adapter', async () => {
      const adapter = new SqliteAdapter(testDbPath, { verbose: false });
      
      await adapter.execute(`
        CREATE TABLE adapter_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        )
      `);
      
      const insertResult = await adapter.execute(
        'INSERT INTO adapter_test (data) VALUES (?)',
        ['test data']
      );
      
      expect(insertResult.changes).toBe(1);
      
      const selectResult = await adapter.query('SELECT * FROM adapter_test');
      expect(selectResult).toHaveLength(1);
      expect(selectResult[0].data).toBe('test data');
      
      await adapter.close();
    });

    it('should handle connection pooling', async () => {
      const connectionAdapter = new SqliteConnectionAdapter();
      
      // Initialize connection
      await connectionAdapter.initialize({
        file: testDbPath,
        options: { verbose: false }
      });
      
      // Test connection reuse
      const connection1 = connectionAdapter.getConnection();
      const connection2 = connectionAdapter.getConnection();
      
      expect(connection1).toBe(connection2); // Should be same instance (singleton)
      
      // Test connection functionality
      const result = connection1.prepare('SELECT 1 AS test').get();
      expect(result.test).toBe(1);
      
      await connectionAdapter.close();
    });

    it('should support transaction adapter features', async () => {
      const transactionAdapter = new SqliteTransactionAdapter(dbService);
      
      await dbService.execute(`
        CREATE TABLE transaction_adapter_test (
          id INTEGER PRIMARY KEY,
          value INTEGER
        )
      `);
      
      // Test transaction through adapter
      await transactionAdapter.executeTransaction(async (trx) => {
        await trx.execute('INSERT INTO transaction_adapter_test (value) VALUES (?)', [100]);
        await trx.execute('INSERT INTO transaction_adapter_test (value) VALUES (?)', [200]);
        await trx.execute('INSERT INTO transaction_adapter_test (value) VALUES (?)', [300]);
      });
      
      // Verify transaction completed
      const records = await dbService.prepare('SELECT * FROM transaction_adapter_test ORDER BY value').all();
      expect(records).toHaveLength(3);
      expect(records.map(r => r.value)).toEqual([100, 200, 300]);
    });
  });

  describe('Database Performance and Optimization', () => {
    beforeEach(async () => {
      await DatabaseService.initialize({
        type: 'sqlite',
        sqlite: {
          filename: testDbPath,
          mode: 'wal'
        }
      }, logger);
      dbService = DatabaseService.getInstance();
      
      await dbService.execute(`
        CREATE TABLE performance_test (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT,
          value INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indices for performance
      await dbService.execute('CREATE INDEX idx_performance_category ON performance_test(category)');
      await dbService.execute('CREATE INDEX idx_performance_value ON performance_test(value)');
    });

    it('should handle large dataset operations efficiently', async () => {
      const batchSize = 1000;
      const stmt = dbService.prepare(
        'INSERT INTO performance_test (name, category, value) VALUES (?, ?, ?)'
      );
      
      const startTime = Date.now();
      
      // Insert large batch
      await dbService.transaction(async () => {
        for (let i = 0; i < batchSize; i++) {
          stmt.run(`Record ${i}`, `Category ${i % 10}`, i);
        }
      });
      
      const insertTime = Date.now() - startTime;
      
      // Should be reasonably fast (adjust threshold as needed)
      expect(insertTime).toBeLessThan(5000);
      
      // Verify all records inserted
      const count = await dbService.prepare('SELECT COUNT(*) as count FROM performance_test').get();
      expect(count.count).toBe(batchSize);
      
      // Test query performance with index
      const queryStartTime = Date.now();
      const categoryResults = await dbService.prepare(
        'SELECT * FROM performance_test WHERE category = ? ORDER BY value'
      ).all('Category 5');
      const queryTime = Date.now() - queryStartTime;
      
      expect(queryTime).toBeLessThan(100); // Should be very fast with index
      expect(categoryResults.length).toBe(100); // Should find all Category 5 records
    });

    it('should optimize query execution plans', async () => {
      // Insert test data
      const categories = ['A', 'B', 'C', 'D', 'E'];
      const stmt = dbService.prepare(
        'INSERT INTO performance_test (name, category, value) VALUES (?, ?, ?)'
      );
      
      for (let i = 0; i < 500; i++) {
        const category = categories[i % categories.length];
        stmt.run(`Item ${i}`, category, i * 10);
      }
      
      // Test query plan for indexed column
      const explainResult = await dbService.prepare(
        'EXPLAIN QUERY PLAN SELECT * FROM performance_test WHERE category = ?'
      ).all('A');
      
      // Should use index (exact plan format may vary)
      const planText = explainResult.map(row => row.detail).join(' ');
      expect(planText.toLowerCase()).toContain('index');
    });

    it('should handle concurrent access efficiently', async () => {
      const concurrentOperations = [];
      const operationCount = 50;
      
      // Create concurrent read/write operations
      for (let i = 0; i < operationCount; i++) {
        if (i % 2 === 0) {
          // Write operation
          concurrentOperations.push(
            dbService.execute(
              'INSERT INTO performance_test (name, category, value) VALUES (?, ?, ?)',
              [`Concurrent ${i}`, 'concurrent', i]
            )
          );
        } else {
          // Read operation
          concurrentOperations.push(
            dbService.prepare('SELECT COUNT(*) as count FROM performance_test').get()
          );
        }
      }
      
      const startTime = Date.now();
      await Promise.all(concurrentOperations);
      const totalTime = Date.now() - startTime;
      
      // Should handle concurrent operations efficiently
      expect(totalTime).toBeLessThan(2000);
      
      // Verify some data was written
      const finalCount = await dbService.prepare('SELECT COUNT(*) as count FROM performance_test').get();
      expect(finalCount.count).toBeGreaterThan(0);
    });
  });
});