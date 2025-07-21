import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CLIContext } from '../../../../cli/src/types.js';
import { command as statusCommand } from '../../cli/status.js';
import { DatabaseService } from '../../services/database.service.js';
import { MigrationService } from '../../services/migration.service.js';
import { SchemaService } from '../../services/schema.service.js';

// Mock the services
vi.mock('../../services/database.service.js');
vi.mock('../../services/migration.service.js');
vi.mock('../../services/schema.service.js');

describe('database:status command', () => {
  let mockContext: CLIContext;
  let mockDbService: any;
  let mockMigrationService: any;
  let mockSchemaService: any;
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
      getConnection: vi.fn().mockResolvedValue({}),
    };

    mockMigrationService = {
      getPendingMigrations: vi.fn().mockResolvedValue([]),
      getExecutedMigrations: vi.fn().mockResolvedValue([]),
    };

    mockSchemaService = {
      getInstalledSchemas: vi.fn().mockResolvedValue([]),
    };

    // Mock getInstance methods
    vi.mocked(DatabaseService.getInstance).mockReturnValue(mockDbService);
    vi.mocked(MigrationService.getInstance).mockReturnValue(mockMigrationService);
    vi.mocked(SchemaService.getInstance).mockReturnValue(mockSchemaService);

    // Mock environment variables
    process.env.DATABASE_TYPE = 'sqlite';
    process.env.DATABASE_FILE = './test.db';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct command metadata', () => {
    expect(statusCommand.name).toBe('status');
    expect(statusCommand.description).toBe('Show database connection status and information');
    expect(statusCommand.options).toHaveLength(1);
    expect(statusCommand.options?.[0]).toMatchObject({
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (json, table)',
      default: 'table',
    });
  });

  it('should show error when database is not initialized', async () => {
    mockDbService.isInitialized.mockResolvedValue(false);

    await expect(statusCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize."
    );
  });

  it('should display status in table format', async () => {
    mockMigrationService.getExecutedMigrations.mockResolvedValue([
      { executed_at: '2024-01-01T00:00:00Z' }
    ]);
    mockSchemaService.getInstalledSchemas.mockResolvedValue([
      { module_name: 'core' },
      { module_name: 'auth' }
    ]);

    await statusCommand.execute(mockContext);

    // Check output structure
    expect(consoleLogSpy).toHaveBeenCalledWith('\n=== Database Status ===\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('Connection:');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Type: sqlite');
    expect(consoleLogSpy).toHaveBeenCalledWith('  File: ./test.db');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Status: connected');
    
    expect(consoleLogSpy).toHaveBeenCalledWith('\nMigrations:');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Executed: 1');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Pending: 0');
    
    expect(consoleLogSpy).toHaveBeenCalledWith('\nSchemas:');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Installed: 2');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Modules: core, auth');
  });

  it('should display status in JSON format', async () => {
    mockContext.args.format = 'json';
    
    mockMigrationService.getPendingMigrations.mockResolvedValue([
      { name: 'pending1' },
      { name: 'pending2' }
    ]);
    mockSchemaService.getInstalledSchemas.mockResolvedValue([
      { module_name: 'database' }
    ]);

    await statusCommand.execute(mockContext);

    // Verify JSON output
    const jsonCall = consoleLogSpy.mock.calls.find(
      call => typeof call[0] === 'string' && call[0].includes('"connection"')
    );
    expect(jsonCall).toBeDefined();
    
    const output = JSON.parse(jsonCall[0]);
    expect(output).toMatchObject({
      connection: {
        type: 'sqlite',
        file: './test.db',
        status: 'connected',
      },
      migrations: {
        executed: 0,
        pending: 2,
        lastExecuted: 'none',
      },
      schemas: {
        installed: 1,
        modules: ['database'],
      },
    });
  });

  it('should handle PostgreSQL configuration', async () => {
    process.env.DATABASE_TYPE = 'postgres';
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_DB = 'testdb';
    mockContext.args.format = 'json';

    await statusCommand.execute(mockContext);

    const jsonCall = consoleLogSpy.mock.calls.find(
      call => typeof call[0] === 'string' && call[0].includes('"connection"')
    );
    const output = JSON.parse(jsonCall[0]);
    
    expect(output.connection).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      database: 'testdb',
      status: 'connected',
    });
    expect(output.connection.file).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    mockDbService.isInitialized.mockRejectedValue(new Error('Connection failed'));

    await expect(statusCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error getting database status:',
      'Connection failed'
    );
  });

  it('should show disconnected status when no connection', async () => {
    mockDbService.getConnection.mockResolvedValue(null);

    await statusCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('  Status: disconnected');
  });
});