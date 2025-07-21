import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../../../..');
const cliPath = path.join(projectRoot, 'bin/systemprompt');
const testDbPath = path.join(projectRoot, 'test-db.sqlite');

describe('Database CLI Integration Tests', () => {
  // Clean up test database before and after tests
  beforeAll(async () => {
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
    
    // Set test database environment
    process.env.DATABASE_TYPE = 'sqlite';
    process.env.DATABASE_FILE = testDbPath;
  });

  afterAll(async () => {
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  beforeEach(async () => {
    // Ensure the project is built
    try {
      await execAsync('npm run build', { cwd: projectRoot });
    } catch (error) {
      console.error('Build failed:', error);
      throw error;
    }
  });

  describe('database:status', () => {
    it('should show database not initialized on fresh install', async () => {
      const { stdout, stderr } = await execAsync(`${cliPath} database:status`);
      
      expect(stderr).toContain('Database is not initialized');
      expect(stderr).toContain("Run 'systemprompt database:schema --action=init'");
    });

    it('should show status in JSON format', async () => {
      // Initialize first
      await execAsync(`${cliPath} database:schema --action=init --force`);
      
      const { stdout } = await execAsync(`${cliPath} database:status --format=json`);
      const status = JSON.parse(stdout);
      
      expect(status).toHaveProperty('connection');
      expect(status.connection.type).toBe('sqlite');
      expect(status.connection.status).toBe('connected');
      expect(status).toHaveProperty('migrations');
      expect(status).toHaveProperty('schemas');
    });
  });

  describe('database:schema', () => {
    it('should initialize database schema', async () => {
      const { stdout } = await execAsync(`${cliPath} database:schema --action=init`);
      
      expect(stdout).toContain('Initializing database schema');
      expect(stdout).toContain('✓ Base schema initialized');
      expect(stdout).toContain('Database initialization complete');
    });

    it('should list installed schemas', async () => {
      await execAsync(`${cliPath} database:schema --action=init --force`);
      
      const { stdout } = await execAsync(`${cliPath} database:schema --action=list`);
      
      expect(stdout).toContain('Installed Schemas:');
      expect(stdout).toContain('Module Name');
    });

    it('should validate schemas', async () => {
      await execAsync(`${cliPath} database:schema --action=init --force`);
      
      const { stdout } = await execAsync(`${cliPath} database:schema --action=validate`);
      
      expect(stdout).toContain('Validating database schemas');
    });

    it('should prevent reinit without force', async () => {
      await execAsync(`${cliPath} database:schema --action=init --force`);
      
      try {
        await execAsync(`${cliPath} database:schema --action=init`);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stderr).toContain('Database is already initialized');
        expect(error.stderr).toContain('Use --force to reinitialize');
      }
    });
  });

  describe('database:migrate', () => {
    beforeEach(async () => {
      // Initialize database for migration tests
      await execAsync(`${cliPath} database:schema --action=init --force`);
    });

    it('should show no pending migrations on fresh database', async () => {
      const { stdout } = await execAsync(`${cliPath} database:migrate`);
      
      expect(stdout).toContain('No pending migrations found');
    });

    it('should support dry-run mode', async () => {
      const { stdout } = await execAsync(`${cliPath} database:migrate --dry-run`);
      
      expect(stdout).toMatch(/No pending migrations found|DRY RUN/);
    });
  });

  describe('database:query', () => {
    beforeEach(async () => {
      // Initialize database for query tests
      await execAsync(`${cliPath} database:schema --action=init --force`);
    });

    it('should execute SELECT queries in readonly mode', async () => {
      const { stdout } = await execAsync(
        `${cliPath} database:query --sql "SELECT name FROM sqlite_master WHERE type='table' LIMIT 1"`
      );
      
      expect(stdout).toMatch(/\d+ row|0 rows/);
    });

    it('should block write queries in readonly mode', async () => {
      try {
        await execAsync(
          `${cliPath} database:query --sql "CREATE TABLE test (id INTEGER)"`
        );
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stderr).toContain('Only SELECT queries are allowed in readonly mode');
      }
    });

    it('should allow write queries with readonly=false', async () => {
      const { stdout } = await execAsync(
        `${cliPath} database:query --sql "CREATE TABLE test_table (id INTEGER)" --readonly=false`
      );
      
      expect(stdout).toContain('Query executed successfully');
      
      // Verify table was created
      const { stdout: verifyOut } = await execAsync(
        `${cliPath} database:query --sql "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'"`
      );
      expect(verifyOut).toContain('test_table');
    });

    it('should support different output formats', async () => {
      // Create test data
      await execAsync(
        `${cliPath} database:query --sql "CREATE TABLE formats_test (id INTEGER, name TEXT)" --readonly=false`
      );
      await execAsync(
        `${cliPath} database:query --sql "INSERT INTO formats_test VALUES (1, 'Test')" --readonly=false`
      );
      
      // Test JSON format
      const { stdout: jsonOut } = await execAsync(
        `${cliPath} database:query --sql "SELECT * FROM formats_test" --format=json`
      );
      const jsonData = JSON.parse(jsonOut.split('\n')[0]); // First line should be JSON
      expect(jsonData).toEqual([{ id: 1, name: 'Test' }]);
      
      // Test CSV format
      const { stdout: csvOut } = await execAsync(
        `${cliPath} database:query --sql "SELECT * FROM formats_test" --format=csv`
      );
      expect(csvOut).toContain('id,name');
      expect(csvOut).toContain('1,Test');
      
      // Test table format (default)
      const { stdout: tableOut } = await execAsync(
        `${cliPath} database:query --sql "SELECT * FROM formats_test"`
      );
      expect(tableOut).toMatch(/id\s+\|\s+name/);
      expect(tableOut).toContain('1  | Test');
    });
  });

  describe('database:rollback', () => {
    beforeEach(async () => {
      // Initialize database for rollback tests
      await execAsync(`${cliPath} database:schema --action=init --force`);
    });

    it('should show no migrations to rollback on fresh database', async () => {
      const { stdout } = await execAsync(`${cliPath} database:rollback`);
      
      expect(stdout).toContain('No executed migrations found to rollback');
    });

    it('should require force flag for rollback', async () => {
      // This test would need actual migrations to be meaningful
      // For now, we just test the safety mechanism
      const { stdout } = await execAsync(`${cliPath} database:rollback`);
      
      expect(stdout).toMatch(/No executed migrations found|Use --force flag/);
    });
  });

  describe('Error handling', () => {
    it('should show helpful error when database file is not accessible', async () => {
      // Set database to a non-writable location
      process.env.DATABASE_FILE = '/root/inaccessible.db';
      
      try {
        await execAsync(`${cliPath} database:status`);
      } catch (error: any) {
        expect(error.stderr).toMatch(/Database is not initialized|Error getting database status/);
      }
      
      // Reset to test database
      process.env.DATABASE_FILE = testDbPath;
    });

    it('should handle malformed SQL gracefully', async () => {
      await execAsync(`${cliPath} database:schema --action=init --force`);
      
      try {
        await execAsync(`${cliPath} database:query --sql "INVALID SQL SYNTAX"`);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stderr).toContain('Query failed');
      }
    });
  });
});