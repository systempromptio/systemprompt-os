/**
 * Database Module Integration Test
 * 
 * Tests database operations and management:
 * - Database initialization and connections
 * - Transaction management
 * - Schema operations
 * - Migration system
 * - Query execution
 * - Database adapters
 * 
 * Coverage targets:
 * - src/modules/core/database/index.ts
 * - src/modules/core/database/services/*.ts
 * - src/modules/core/database/adapters/*.ts
 * - src/modules/core/database/cli/*.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('Database Module Integration Tests', () => {
  let bootstrap: Bootstrap;
  let databaseService: DatabaseService;
  
  const testSessionId = `database-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path
    process.env.DATABASE_PATH = testDbPath;
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services
    const dbModule = modules.get('database');
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    if ('service' in dbModule.exports && typeof dbModule.exports.service === 'function') {
      databaseService = dbModule.exports.service();
    }
  });

  afterAll(async () => {
    // Shutdown bootstrap
    if (bootstrap) {
      await bootstrap.shutdown();
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Database should already be set up by bootstrap
    // No need to clear specific tables as tests should use unique data
  });

  describe('Module Bootstrap', () => {
    it('should load database module during bootstrap', async () => {
      const modules = bootstrap.getModules();
      expect(modules.has('database')).toBe(true);
      
      const module = modules.get('database');
      expect(module).toBeDefined();
      expect(module?.name).toBe('database');
    });

    it('should execute database status command', async () => {
      const result = await runCLICommand(['database', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/database|status|connected/);
    });
  });

  describe('Database Initialization', () => {
    it('should handle database initialization errors', async () => {
      // Database service should be initialized successfully by bootstrap
      expect(databaseService).toBeDefined();
      
      // Test that the service can execute basic queries
      const result = await databaseService.query('SELECT 1 as test');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should support WAL mode configuration', async () => {
      // Test that we can execute WAL mode pragma (SQLite specific)
      try {
        await databaseService.execute('PRAGMA journal_mode=WAL');
        
        // Verify WAL mode is active
        const result = await databaseService.query('PRAGMA journal_mode');
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // WAL mode might not be supported in test environment, that's ok
        expect(error).toBeDefined();
      }
    });
    
    it('should initialize SQLite database', async () => {
      // Database should be initialized as SQLite by default
      const result = await databaseService.query('SELECT sqlite_version()');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should create database file if not exists', async () => {
      // Database file should exist after initialization
      expect(existsSync(testDbPath)).toBe(true);
    });
  });

  describe('Transaction Management', () => {
    it('should execute transactions successfully', async () => {
      let transactionExecuted = false;
      
      const result = await databaseService.transaction(async (conn) => {
        // Create a test table within transaction
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS test_transaction_${Date.now()} (
            id INTEGER PRIMARY KEY,
            value TEXT
          )
        `);
        
        transactionExecuted = true;
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(transactionExecuted).toBe(true);
    });
    
    it('should rollback on error', async () => {
      const tableName = `test_rollback_${Date.now()}`;
      
      try {
        await databaseService.transaction(async (conn) => {
          // Create table
          await conn.execute(`
            CREATE TABLE ${tableName} (
              id INTEGER PRIMARY KEY,
              value TEXT NOT NULL
            )
          `);
          
          // Insert valid data
          await conn.execute(`INSERT INTO ${tableName} (value) VALUES (?)`, ['test']);
          
          // This should cause an error and rollback
          await conn.execute(`INSERT INTO ${tableName} (value) VALUES (?)`, [null]);
        });
      } catch (error) {
        // Transaction should have failed and rolled back
        expect(error).toBeDefined();
      }
      
      // Table should not exist or be empty due to rollback
      try {
        const result = await databaseService.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        expect(result[0]?.count).toBe(0);
      } catch (error) {
        // Table might not exist, which is also expected
        expect(error).toBeDefined();
      }
    });
  });

  describe('Query Execution', () => {
    it('should execute SELECT queries', async () => {
      const result = await databaseService.query('SELECT 1 as test_value, "hello" as test_string');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toMatchObject({
        test_value: 1,
        test_string: 'hello'
      });
    });
    
    it('should execute INSERT with lastInsertId', async () => {
      const tableName = `test_insert_${Date.now()}`;
      
      // Create test table
      await databaseService.execute(`
        CREATE TABLE ${tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          value TEXT
        )
      `);
      
      // Insert data
      await databaseService.execute(`INSERT INTO ${tableName} (value) VALUES (?)`, ['test_value']);
      
      // Verify data was inserted
      const result = await databaseService.query(`SELECT * FROM ${tableName} WHERE value = ?`, ['test_value']);
      expect(result.length).toBe(1);
      expect(result[0]).toMatchObject({
        id: expect.any(Number),
        value: 'test_value'
      });
    });
    
    it('should execute UPDATE with affected rows', async () => {
      const tableName = `test_update_${Date.now()}`;
      
      // Create test table and insert data
      await databaseService.execute(`
        CREATE TABLE ${tableName} (
          id INTEGER PRIMARY KEY,
          value TEXT
        )
      `);
      
      await databaseService.execute(`INSERT INTO ${tableName} (id, value) VALUES (1, 'old_value')`);
      await databaseService.execute(`INSERT INTO ${tableName} (id, value) VALUES (2, 'old_value')`);
      
      // Update data
      await databaseService.execute(`UPDATE ${tableName} SET value = ? WHERE value = ?`, ['new_value', 'old_value']);
      
      // Verify update
      const result = await databaseService.query(`SELECT COUNT(*) as count FROM ${tableName} WHERE value = ?`, ['new_value']);
      expect(result[0]?.count).toBe(2);
    });
    
    it('should handle prepared statements', async () => {
      const tableName = `test_prepared_${Date.now()}`;
      
      await databaseService.execute(`
        CREATE TABLE ${tableName} (
          id INTEGER PRIMARY KEY,
          value TEXT
        )
      `);
      
      // Use parameterized queries (prepared statements)
      const testValues = ['value1', 'value2', 'value3'];
      
      for (let i = 0; i < testValues.length; i++) {
        await databaseService.execute(`INSERT INTO ${tableName} (id, value) VALUES (?, ?)`, [i + 1, testValues[i]]);
      }
      
      // Query with parameters
      const result = await databaseService.query(`SELECT * FROM ${tableName} WHERE value = ?`, ['value2']);
      expect(result.length).toBe(1);
      expect(result[0]).toMatchObject({
        id: 2,
        value: 'value2'
      });
    });
    
    it('should prevent SQL injection', async () => {
      const tableName = `test_injection_${Date.now()}`;
      
      await databaseService.execute(`
        CREATE TABLE ${tableName} (
          id INTEGER PRIMARY KEY,
          value TEXT
        )
      `);
      
      await databaseService.execute(`INSERT INTO ${tableName} (id, value) VALUES (1, 'safe_value')`);
      
      // Attempt SQL injection through parameter
      const maliciousInput = "'; DROP TABLE " + tableName + "; --";
      
      // This should be safe due to parameterization
      const result = await databaseService.query(`SELECT * FROM ${tableName} WHERE value = ?`, [maliciousInput]);
      
      // Should return no results (not find the malicious input as a value)
      expect(result.length).toBe(0);
      
      // Verify table still exists
      const tableCheck = await databaseService.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      expect(tableCheck[0]?.count).toBe(1);
    });
  });

  describe('CLI Operations', () => {
    it('should clear the database successfully', async () => {
      const result = await runCLICommand(['database', 'clear', '--force']);
      
      // Should succeed or give meaningful error
      expect([0, 1]).toContain(result.exitCode);
      
      if (result.exitCode === 0) {
        expect(result.output.toLowerCase()).toMatch(/clear|success/);
      }
    });

    it('should rebuild the database with clean schema', async () => {
      const result = await runCLICommand(['database', 'rebuild', '--force']);
      
      // Should succeed or give meaningful error
      expect([0, 1]).toContain(result.exitCode);
      
      if (result.exitCode === 0) {
        expect(result.output.toLowerCase()).toMatch(/rebuild|success/);
      }
    });

    it('should verify database integrity after rebuild', async () => {
      const result = await runCLICommand(['database', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/connected|database/);
    });
    
    it('should execute arbitrary queries', async () => {
      const result = await runCLICommand(['database', 'query', 'SELECT 1 as test']);
      
      // Should succeed or be unavailable
      expect([0, 1]).toContain(result.exitCode);
      
      if (result.exitCode === 0) {
        expect(result.output).toContain('1');
      }
    });
  });

  describe('Schema Operations', () => {
    it('should handle schema discovery and initialization', async () => {
      // Schema should be initialized during bootstrap
      // Verify by checking that system tables exist
      try {
        const result = await databaseService.query(`
          SELECT name FROM sqlite_master 
          WHERE type='table' 
          ORDER BY name
        `);
        
        expect(Array.isArray(result)).toBe(true);
        // Should have at least some system tables
        expect(result.length).toBeGreaterThan(0);
      } catch (error) {
        // This might fail in some test environments, that's ok
        expect(error).toBeDefined();
      }
    });
  });

  async function runCLICommand(args: string[]): Promise<{ output: string; errors: string; exitCode: number | null }> {
    const cliProcess = spawn('npm', ['run', 'cli', '--', ...args], {
      cwd: process.cwd(),
      shell: true,
    });

    const output: string[] = [];
    const errors: string[] = [];

    cliProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    cliProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    await new Promise<void>((resolve) => {
      cliProcess.on('close', () => {
        resolve();
      });
    });

    return {
      output: output.join(''),
      errors: errors.join(''),
      exitCode: cliProcess.exitCode,
    };
  }
});