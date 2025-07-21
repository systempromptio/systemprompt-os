import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CLIContext } from '../../../../cli/src/types.js';
import { command as queryCommand } from '../../cli/query.js';
import { DatabaseService } from '../../services/database.service.js';
import * as readline from 'readline';

// Mock the services and modules
vi.mock('../../services/database.service.js');
vi.mock('readline');
vi.mock('fs/promises');

describe('database:query command', () => {
  let mockContext: CLIContext;
  let mockDbService: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Setup mocks
    mockContext = {
      args: {},
      flags: {},
      env: {},
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
    };

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process exited with code ${code}`);
    });

    // Setup service mocks
    mockDbService = {
      isInitialized: vi.fn().mockResolvedValue(true),
      query: vi.fn().mockResolvedValue([]),
      getDatabaseType: vi.fn().mockReturnValue('sqlite'),
    };

    // Mock getInstance methods
    vi.mocked(DatabaseService.getInstance).mockReturnValue(mockDbService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct command metadata', () => {
    expect(queryCommand.name).toBe('query');
    expect(queryCommand.description).toBe('Execute SQL queries safely (admin only)');
    expect(queryCommand.options).toHaveLength(5);
    
    const optionNames = queryCommand.options?.map(opt => opt.name) || [];
    expect(optionNames).toContain('sql');
    expect(optionNames).toContain('file');
    expect(optionNames).toContain('format');
    expect(optionNames).toContain('interactive');
    expect(optionNames).toContain('readonly');
  });

  it('should show error when database is not initialized', async () => {
    mockDbService.isInitialized.mockResolvedValue(false);

    await expect(queryCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize."
    );
  });

  it('should require query input option', async () => {
    await expect(queryCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Please provide --sql, --file, or --interactive option.'
    );
  });

  it('should block write queries in readonly mode', async () => {
    mockContext.args.sql = 'INSERT INTO users (name) VALUES ("test")';
    mockContext.args.readonly = true;

    await expect(queryCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error: Only SELECT queries are allowed in readonly mode.'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Use --readonly=false to execute write queries.'
    );
  });

  it('should execute SELECT query and display results in table format', async () => {
    const mockResults = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ];
    mockDbService.query.mockResolvedValue(mockResults);
    mockContext.args.sql = 'SELECT * FROM users';
    mockContext.args.format = 'table';

    await queryCommand.execute(mockContext);

    // Check table header
    expect(consoleLogSpy).toHaveBeenCalledWith('id | name  | age');
    expect(consoleLogSpy).toHaveBeenCalledWith('-'.repeat(15));
    // Check table rows
    expect(consoleLogSpy).toHaveBeenCalledWith('1  | Alice | 30 ');
    expect(consoleLogSpy).toHaveBeenCalledWith('2  | Bob   | 25 ');
    // Check summary
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\(2 rows in \d+ms\)/));
  });

  it('should execute query and display results in JSON format', async () => {
    const mockResults = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    mockDbService.query.mockResolvedValue(mockResults);
    mockContext.args.sql = 'SELECT * FROM users';
    mockContext.args.format = 'json';

    await queryCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockResults, null, 2));
  });

  it('should execute query and display results in CSV format', async () => {
    const mockResults = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob, Jr.', email: 'bob@example.com' },
    ];
    mockDbService.query.mockResolvedValue(mockResults);
    mockContext.args.sql = 'SELECT * FROM users';
    mockContext.args.format = 'csv';

    await queryCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('id,name,email');
    expect(consoleLogSpy).toHaveBeenCalledWith('1,Alice,alice@example.com');
    expect(consoleLogSpy).toHaveBeenCalledWith('2,"Bob, Jr.",bob@example.com');
  });

  it('should handle NULL values correctly', async () => {
    const mockResults = [
      { id: 1, name: null, email: 'test@example.com' },
    ];
    mockDbService.query.mockResolvedValue(mockResults);
    mockContext.args.sql = 'SELECT * FROM users';
    mockContext.args.format = 'table';

    await queryCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('1  | NULL | test@example.com');
  });

  it('should handle empty result set', async () => {
    mockDbService.query.mockResolvedValue([]);
    mockContext.args.sql = 'SELECT * FROM users WHERE id = -1';

    await queryCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('(0 rows)');
  });

  it('should allow write queries when readonly is false', async () => {
    mockDbService.query.mockResolvedValue({ changes: 1 });
    mockContext.args.sql = 'INSERT INTO users (name) VALUES ("test")';
    mockContext.args.readonly = false;

    await queryCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Query executed successfully \(\d+ms\)/));
    expect(mockDbService.query).toHaveBeenCalledWith('INSERT INTO users (name) VALUES ("test")');
  });

  it('should handle query errors', async () => {
    mockDbService.query.mockRejectedValue(new Error('Syntax error'));
    mockContext.args.sql = 'INVALID SQL';

    await expect(queryCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Query failed:', 'Syntax error');
  });

  it('should execute queries from file', async () => {
    const fs = await import('fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(
      'SELECT * FROM users;\nSELECT * FROM posts;'
    );
    
    mockDbService.query.mockResolvedValue([]);
    mockContext.args.file = '/path/to/queries.sql';

    await queryCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('Executing 2 queries from /path/to/queries.sql...\n');
    expect(mockDbService.query).toHaveBeenCalledTimes(2);
    expect(mockDbService.query).toHaveBeenCalledWith('SELECT * FROM users');
    expect(mockDbService.query).toHaveBeenCalledWith('SELECT * FROM posts');
  });

  it('should validate read-only queries correctly', async () => {
    const testCases = [
      { sql: 'SELECT * FROM users', readonly: true, shouldPass: true },
      { sql: 'select id from posts', readonly: true, shouldPass: true },
      { sql: 'SHOW TABLES', readonly: true, shouldPass: true },
      { sql: 'DESCRIBE users', readonly: true, shouldPass: true },
      { sql: 'EXPLAIN SELECT * FROM users', readonly: true, shouldPass: true },
      { sql: 'WITH cte AS (SELECT 1) SELECT * FROM cte', readonly: true, shouldPass: true },
      { sql: 'INSERT INTO users VALUES (1)', readonly: true, shouldPass: false },
      { sql: 'UPDATE users SET name = "test"', readonly: true, shouldPass: false },
      { sql: 'DELETE FROM users', readonly: true, shouldPass: false },
      { sql: 'DROP TABLE users', readonly: true, shouldPass: false },
    ];

    for (const testCase of testCases) {
      mockContext.args.sql = testCase.sql;
      mockContext.args.readonly = testCase.readonly;

      if (testCase.shouldPass) {
        mockDbService.query.mockResolvedValue([]);
        await queryCommand.execute(mockContext);
        expect(mockDbService.query).toHaveBeenCalledWith(testCase.sql);
      } else {
        await expect(queryCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error: Only SELECT queries are allowed in readonly mode.'
        );
      }

      // Reset mocks for next iteration
      vi.clearAllMocks();
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
        throw new Error(`Process exited with code ${code}`);
      });
    }
  });
});