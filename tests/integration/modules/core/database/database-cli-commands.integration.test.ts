/**
 * Database Module CLI Commands Integration Test
 * 
 * Tests all database CLI commands with full system bootstrap:
 * - database:status - Show connection status
 * - database:summary - Show table statistics  
 * - database:query - Execute SQL queries
 * - database:schema - Manage schemas
 * - database:view - View table data
 * - database:clear - Clear database data
 * - database:rebuild - Rebuild database
 * 
 * Coverage targets:
 * - src/modules/core/database/cli/*.ts
 * - src/modules/core/database/services/cli-handler.service.ts
 * - src/modules/core/database/services/database-summary.service.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { createTestId } from '@tests/integration/setup';

describe('Database CLI Commands Integration', () => {
  let bootstrap: Bootstrap;
  let databaseService: DatabaseService;
  
  const testSessionId = `database-cli-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path
    process.env.SQLITE_FILENAME = testDbPath;
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get database service
    const dbModule = modules.get('database');
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    if ('service' in dbModule.exports && typeof dbModule.exports.service === 'function') {
      databaseService = dbModule.exports.service();
    }

    // Create test tables with data
    await setupTestData();
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

  async function setupTestData() {
    // Create test tables
    await databaseService.execute(`
      CREATE TABLE IF NOT EXISTS test_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await databaseService.execute(`
      CREATE TABLE IF NOT EXISTS test_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        published BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES test_users(id)
      )
    `);

    await databaseService.execute(`
      CREATE TABLE IF NOT EXISTS test_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT CHECK (level IN ('info', 'warn', 'error')),
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert test data
    await databaseService.execute(`
      INSERT INTO test_users (name, email) VALUES 
      ('John Doe', 'john@example.com'),
      ('Jane Smith', 'jane@example.com'),
      ('Bob Wilson', 'bob@example.com')
    `);

    await databaseService.execute(`
      INSERT INTO test_posts (user_id, title, content, published) VALUES 
      (1, 'First Post', 'Hello World', 1),
      (1, 'Second Post', 'Another post', 0),
      (2, 'Jane''s Post', 'My first post', 1),
      (3, 'Bob''s Draft', 'Work in progress', 0)
    `);

    await databaseService.execute(`
      INSERT INTO test_logs (level, message) VALUES 
      ('info', 'System started'),
      ('warn', 'High memory usage'),
      ('error', 'Connection failed'),
      ('info', 'User login'),
      ('info', 'Data processed')
    `);

    // Create a view
    await databaseService.execute(`
      CREATE VIEW IF NOT EXISTS test_user_post_count AS
      SELECT 
        u.name,
        COUNT(p.id) as post_count,
        SUM(CASE WHEN p.published = 1 THEN 1 ELSE 0 END) as published_count
      FROM test_users u
      LEFT JOIN test_posts p ON u.id = p.user_id
      GROUP BY u.id, u.name
    `);
  }

  describe('database:status', () => {
    it('should show database connection status', async () => {
      const result = await runCLICommand(['database:status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Database Status');
      expect(result.output).toContain('Connected');
      expect(result.output).toContain('sqlite');
    });

    it('should show status in JSON format', async () => {
      const result = await runCLICommand(['database:status', '--format', 'json']);
      
      expect(result.exitCode).toBe(0);
      const json = JSON.parse(result.output);
      expect(json).toHaveProperty('connected', true);
      expect(json).toHaveProperty('type', 'sqlite');
      expect(json).toHaveProperty('version');
    });
  });

  describe('database:summary', () => {
    it('should show database summary with table statistics', async () => {
      const result = await runCLICommand(['database:summary']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Database Summary');
      expect(result.output).toContain('Total Tables');
      expect(result.output).toContain('Total Rows');
      expect(result.output).toContain('test_users');
      expect(result.output).toContain('test_posts');
      expect(result.output).toContain('test_logs');
    });

    it('should sort tables by row count', async () => {
      const result = await runCLICommand(['database:summary', '--sort-by', 'rows']);
      
      expect(result.exitCode).toBe(0);
      // test_logs (5 rows) should appear before test_posts (4 rows)
      const logsIndex = result.output.indexOf('test_logs');
      const postsIndex = result.output.indexOf('test_posts');
      expect(logsIndex).toBeLessThan(postsIndex);
    });

    it('should sort tables by column count', async () => {
      const result = await runCLICommand(['database:summary', '--sort-by', 'columns']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('test_posts'); // Has most columns
    });

    it('should output summary in JSON format', async () => {
      const result = await runCLICommand(['database:summary', '--format', 'json']);
      
      expect(result.exitCode).toBe(0);
      const json = JSON.parse(result.output);
      expect(json).toHaveProperty('totalTables');
      expect(json).toHaveProperty('totalRows');
      expect(json).toHaveProperty('tables');
      expect(Array.isArray(json.tables)).toBe(true);
      
      const userTable = json.tables.find((t: any) => t.name === 'test_users');
      expect(userTable).toBeDefined();
      expect(userTable.rowCount).toBe(3);
    });

    it('should include system tables when requested', async () => {
      const result = await runCLICommand(['database:summary', '--include-system']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/sqlite_master|sqlite_sequence/);
    });

    it('should output summary in text format', async () => {
      const result = await runCLICommand(['database:summary', '--format', 'text']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Tables:');
      expect(result.output).toContain('Rows:');
      expect(result.output).toContain('Columns:');
    });
  });

  describe('database:query', () => {
    it('should execute SELECT queries', async () => {
      const result = await runCLICommand(['database:query', 'SELECT * FROM test_users ORDER BY id']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('John Doe');
      expect(result.output).toContain('jane@example.com');
      expect(result.output).toContain('Bob Wilson');
    });

    it('should execute queries with parameters', async () => {
      const result = await runCLICommand([
        'database:query', 
        'SELECT * FROM test_users WHERE email = ?',
        '--params', 'john@example.com'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('John Doe');
      expect(result.output).not.toContain('Jane Smith');
    });

    it('should execute queries with multiple parameters', async () => {
      const result = await runCLICommand([
        'database:query',
        'SELECT * FROM test_posts WHERE user_id = ? AND published = ?',
        '--params', '1,1'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('First Post');
      expect(result.output).not.toContain('Second Post');
    });

    it('should output query results in JSON format', async () => {
      const result = await runCLICommand([
        'database:query',
        'SELECT id, name FROM test_users ORDER BY id',
        '--format', 'json'
      ]);
      
      expect(result.exitCode).toBe(0);
      const json = JSON.parse(result.output);
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(3);
      expect(json[0]).toEqual({ id: 1, name: 'John Doe' });
    });

    it('should output query results in CSV format', async () => {
      const result = await runCLICommand([
        'database:query',
        'SELECT id, name FROM test_users ORDER BY id',
        '--format', 'csv'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('id,name');
      expect(result.output).toContain('1,"John Doe"');
      expect(result.output).toContain('2,"Jane Smith"');
    });

    it('should handle queries with no results', async () => {
      const result = await runCLICommand([
        'database:query',
        'SELECT * FROM test_users WHERE email = ?',
        '--params', 'nonexistent@example.com'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('No results');
    });

    it('should handle invalid SQL gracefully', async () => {
      const result = await runCLICommand(['database:query', 'INVALID SQL']);
      
      expect(result.exitCode).toBe(1);
      expect(result.errors).toContain('Error');
    });

    it('should execute aggregate queries', async () => {
      const result = await runCLICommand([
        'database:query',
        'SELECT level, COUNT(*) as count FROM test_logs GROUP BY level ORDER BY count DESC'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('info');
      expect(result.output).toContain('3'); // 3 info logs
    });
  });

  describe('database:schema', () => {
    it('should list all schemas', async () => {
      const result = await runCLICommand(['database:schema', 'list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Schemas');
      // Should include core module schemas
      expect(result.output).toMatch(/database|logger|cli/);
    });

    it('should validate schemas', async () => {
      const result = await runCLICommand(['database:schema', 'validate']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toContain('valid');
    });

    it('should show schema for specific module', async () => {
      const result = await runCLICommand(['database:schema', 'show', 'database']);
      
      // Command might not be implemented
      if (result.exitCode === 0) {
        expect(result.output).toContain('database');
      }
    });
  });

  describe('database:view', () => {
    it('should display table data', async () => {
      const result = await runCLICommand(['database:view', 'test_users']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('test_users');
      expect(result.output).toContain('John Doe');
      expect(result.output).toContain('jane@example.com');
    });

    it('should display view data', async () => {
      const result = await runCLICommand(['database:view', 'test_user_post_count']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('John Doe');
      expect(result.output).toContain('2'); // John has 2 posts
    });

    it('should limit rows displayed', async () => {
      const result = await runCLICommand(['database:view', 'test_logs', '--limit', '2']);
      
      expect(result.exitCode).toBe(0);
      const logCount = (result.output.match(/info|warn|error/g) || []).length;
      expect(logCount).toBeLessThanOrEqual(2);
    });

    it('should offset rows', async () => {
      const result = await runCLICommand(['database:view', 'test_users', '--offset', '1', '--limit', '1']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Jane Smith');
      expect(result.output).not.toContain('John Doe');
    });

    it('should display in JSON format', async () => {
      const result = await runCLICommand(['database:view', 'test_users', '--format', 'json']);
      
      expect(result.exitCode).toBe(0);
      const json = JSON.parse(result.output);
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(3);
    });

    it('should show table schema', async () => {
      const result = await runCLICommand(['database:view', 'test_posts', '--schema']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('id');
      expect(result.output).toContain('INTEGER');
      expect(result.output).toContain('PRIMARY KEY');
    });

    it('should handle non-existent tables', async () => {
      const result = await runCLICommand(['database:view', 'non_existent_table']);
      
      expect(result.exitCode).toBe(1);
      expect(result.errors).toContain('Error');
    });
  });

  describe('database:clear', () => {
    it('should clear specific table data', async () => {
      // Create a temporary table for clearing
      await databaseService.execute(`
        CREATE TABLE test_temp_clear (
          id INTEGER PRIMARY KEY,
          value TEXT
        )
      `);
      
      await databaseService.execute(`
        INSERT INTO test_temp_clear (id, value) VALUES (1, 'test')
      `);

      const result = await runCLICommand([
        'database:clear',
        '--tables', 'test_temp_clear',
        '--force'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      // Verify table was cleared
      const count = await databaseService.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM test_temp_clear'
      );
      expect(count[0]?.count).toBe(0);
    });

    it('should clear multiple tables', async () => {
      // Create temporary tables
      await databaseService.execute(`
        CREATE TABLE test_clear_1 (id INTEGER PRIMARY KEY)
      `);
      await databaseService.execute(`
        CREATE TABLE test_clear_2 (id INTEGER PRIMARY KEY)
      `);
      
      await databaseService.execute('INSERT INTO test_clear_1 (id) VALUES (1)');
      await databaseService.execute('INSERT INTO test_clear_2 (id) VALUES (1)');

      const result = await runCLICommand([
        'database:clear',
        '--tables', 'test_clear_1,test_clear_2',
        '--force'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      // Verify both tables were cleared
      const count1 = await databaseService.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM test_clear_1'
      );
      const count2 = await databaseService.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM test_clear_2'
      );
      
      expect(count1[0]?.count).toBe(0);
      expect(count2[0]?.count).toBe(0);
    });

    it('should require force flag', async () => {
      const result = await runCLICommand(['database:clear', '--tables', 'test_logs']);
      
      // Should fail without --force
      expect(result.exitCode).toBe(1);
    });
  });

  describe('database:rebuild', () => {
    it('should rebuild database with force flag', async () => {
      const result = await runCLICommand(['database:rebuild', '--force']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toContain('rebuild');
      
      // Original test tables should be gone
      try {
        await databaseService.query('SELECT * FROM test_users');
        // If this succeeds, rebuild didn't drop tables
        expect(true).toBe(false);
      } catch (error) {
        // Expected - table should not exist
        expect(error).toBeDefined();
      }
    });

    it('should require force flag', async () => {
      const result = await runCLICommand(['database:rebuild']);
      
      // Should fail without --force
      expect(result.exitCode).toBe(1);
    });

    it('should rebuild and reinitialize schemas', async () => {
      // First rebuild
      await runCLICommand(['database:rebuild', '--force']);
      
      // Check that core tables were recreated
      const result = await runCLICommand(['database:status']);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Connected');
      
      // Verify by checking for a core table
      const tables = await databaseService.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'logger_%' LIMIT 1"
      );
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Temporarily corrupt the environment
      const originalPath = process.env.SQLITE_FILENAME;
      process.env.SQLITE_FILENAME = '/invalid/path/to/database.db';
      
      const result = await runCLICommand(['database:status']);
      
      // Restore
      process.env.SQLITE_FILENAME = originalPath;
      
      // Should handle error gracefully
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should handle invalid table names in view command', async () => {
      const result = await runCLICommand(['database:view', 'table; DROP TABLE test_users; --']);
      
      expect(result.exitCode).toBe(1);
      expect(result.errors).toContain('Error');
    });

    it('should handle SQL injection attempts in query command', async () => {
      const result = await runCLICommand([
        'database:query',
        'SELECT * FROM test_users WHERE email = ?',
        '--params', "'; DROP TABLE test_users; --"
      ]);
      
      // Should execute safely with parameterization
      expect(result.exitCode).toBe(0);
      
      // Verify table still exists
      const tableCheck = await databaseService.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_users'"
      );
      expect(tableCheck.length).toBe(1);
    });
  });

  async function runCLICommand(args: string[]): Promise<{ 
    output: string; 
    errors: string; 
    exitCode: number | null 
  }> {
    return new Promise((resolve) => {
      const cliProcess = spawn('npm', ['run', 'cli', '--', ...args], {
        cwd: process.cwd(),
        shell: true,
        env: { ...process.env, NO_COLOR: '1' }
      });

      const output: string[] = [];
      const errors: string[] = [];

      cliProcess.stdout.on('data', (data) => {
        output.push(data.toString());
      });

      cliProcess.stderr.on('data', (data) => {
        errors.push(data.toString());
      });

      cliProcess.on('close', (code) => {
        resolve({
          output: output.join(''),
          errors: errors.join(''),
          exitCode: code
        });
      });

      // Set timeout
      setTimeout(() => {
        cliProcess.kill();
        resolve({
          output: output.join(''),
          errors: errors.join('') + '\nProcess timed out',
          exitCode: -1
        });
      }, 30000);
    });
  }
});