import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CLIContext } from '@/modules/core/cli/types/index.js';
import { command as queryCommand } from '@/modules/core/database/cli/query.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';
import * as readline from 'readline';

// Mock the services and modules
vi.mock('@/modules/core/database/services/database.service.js');
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
    processExitSpy = vi.spyOn(process!, 'exit').mockImplementation((code?: number!) => {
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
      processExitSpy = vi.spyOn(process!, 'exit').mockImplementation((code?: number!) => {
        throw new Error(`Process exited with code ${code}`);
      });
    }
  });

  it('should start interactive mode when interactive flag is true', async () => {
    mockContext.args.interactive = true;
    
    // Mock readline interface
    const mockRl = {
      prompt: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };
    vi.mocked(readline.createInterface).mockReturnValue(mockRl as any);

    // Start the command (this will set up the readline interface)
    // We need to await this but also handle the fact that interactive mode doesn't naturally return
    const executePromise = queryCommand.execute(mockContext);
    
    // Let the promise start executing
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify readline interface was created with correct options
    expect(readline.createInterface).toHaveBeenCalledWith({
      input: process.stdin,
      output: process.stdout,
      prompt: 'query> '
    });

    // Verify initial setup
    expect(consoleLogSpy).toHaveBeenCalledWith('Interactive SQL query mode. Type ".exit" to quit.');
    expect(mockRl.prompt).toHaveBeenCalled();

    // Verify event handlers were set up
    expect(mockRl.on).toHaveBeenCalledWith('line', expect.any(Function));
    expect(mockRl.on).toHaveBeenCalledWith('close', expect.any(Function));

    // Simulate .exit command to close readline
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];
    lineHandler('.exit');
    
    expect(mockRl.close).toHaveBeenCalled();
  });

  it('should handle file reading errors', async () => {
    const fs = await import('fs/promises');
    vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
    
    mockContext.args.file = '/nonexistent/file.sql';

    await expect(queryCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Query failed:', 'File not found');
  });

  it('should handle files with no queries', async () => {
    const fs = await import('fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue('   \n\n  \n  ;  ; ');
    
    mockContext.args.file = '/path/to/empty.sql';

    await queryCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('No queries found in file.');
  });

  it('should handle write operations that return non-array results', async () => {
    mockDbService.query.mockResolvedValue({ changes: 3, lastID: 123 });
    mockContext.args.sql = 'DELETE FROM old_records WHERE created < "2020-01-01"';
    mockContext.args.readonly = false;

    await queryCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Query executed successfully \(\d+ms\)/));
    expect(mockDbService.query).toHaveBeenCalledWith('DELETE FROM old_records WHERE created < "2020-01-01"');
  });

  it('should handle different SQL command patterns for readonly validation', async () => {
    const additionalTestCases = [
      { sql: 'CREATE INDEX idx_name ON users(name)', readonly: true, shouldPass: false },
      { sql: 'ALTER TABLE users ADD COLUMN email VARCHAR(255)', readonly: true, shouldPass: false },
      { sql: 'TRUNCATE TABLE logs', readonly: true, shouldPass: false },
      { sql: '  SELECT  *  FROM  users  ', readonly: true, shouldPass: true }, // whitespace
      { sql: 'PRAGMA table_info(users)', readonly: true, shouldPass: true }, // PRAGMA commands
      { sql: 'VACUUM', readonly: true, shouldPass: true }, // maintenance commands
    ];

    for (const testCase of additionalTestCases) {
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
      processExitSpy = vi.spyOn(process!, 'exit').mockImplementation((code?: number!) => {
        throw new Error(`Process exited with code ${code}`);
      });
    }
  });
});