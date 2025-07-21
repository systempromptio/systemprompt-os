import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CLIContext } from '../../../../cli/src/types.js';
import { command as migrateCommand } from '../../cli/migrate.js';
import { DatabaseService } from '../../services/database.service.js';
import { MigrationService } from '../../services/migration.service.js';

// Mock the services
vi.mock('../../services/database.service.js');
vi.mock('../../services/migration.service.js');

describe('database:migrate command', () => {
  let mockContext: CLIContext;
  let mockDbService: any;
  let mockMigrationService: any;
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
    };

    mockMigrationService = {
      getPendingMigrations: vi.fn().mockResolvedValue([]),
      executeMigration: vi.fn().mockResolvedValue(undefined),
    };

    // Mock getInstance methods
    vi.mocked(DatabaseService.getInstance).mockReturnValue(mockDbService);
    vi.mocked(MigrationService.getInstance).mockReturnValue(mockMigrationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct command metadata', () => {
    expect(migrateCommand.name).toBe('migrate');
    expect(migrateCommand.description).toBe('Run pending database migrations');
    expect(migrateCommand.options).toHaveLength(2);
    expect(migrateCommand.options?.[0]).toMatchObject({
      name: 'dry-run',
      alias: 'd',
      type: 'boolean',
      description: 'Preview migrations without running them',
      default: false,
    });
    expect(migrateCommand.options?.[1]).toMatchObject({
      name: 'module',
      alias: 'm',
      type: 'string',
      description: 'Run migrations for a specific module only',
    });
  });

  it('should show error when database is not initialized', async () => {
    mockDbService.isInitialized.mockResolvedValue(false);

    await expect(migrateCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize."
    );
  });

  it('should handle no pending migrations', async () => {
    mockMigrationService.getPendingMigrations.mockResolvedValue([]);

    await migrateCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('No pending migrations found.');
  });

  it('should list pending migrations in dry run mode', async () => {
    const migrations = [
      { module: 'auth', name: '001_create_users.sql', version: '001' },
      { module: 'core', name: '002_add_settings.sql', version: '002' },
    ];
    mockMigrationService.getPendingMigrations.mockResolvedValue(migrations);
    mockContext.args['dry-run'] = true;

    await migrateCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('Found 2 pending migration(s):\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - auth/001_create_users.sql (001)');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - core/002_add_settings.sql (002)');
    expect(consoleLogSpy).toHaveBeenCalledWith('\n[DRY RUN] Migrations were not executed.');
    expect(mockMigrationService.executeMigration).not.toHaveBeenCalled();
  });

  it('should execute pending migrations', async () => {
    const migrations = [
      { module: 'auth', name: '001_create_users.sql', version: '001' },
      { module: 'core', name: '002_add_settings.sql', version: '002' },
    ];
    mockMigrationService.getPendingMigrations.mockResolvedValue(migrations);

    await migrateCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('\nExecuting migrations...\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('Running auth/001_create_users.sql...');
    expect(consoleLogSpy).toHaveBeenCalledWith('  ✓ Success');
    expect(consoleLogSpy).toHaveBeenCalledWith('Running core/002_add_settings.sql...');
    expect(consoleLogSpy).toHaveBeenCalledWith('  ✓ Success');
    
    expect(consoleLogSpy).toHaveBeenCalledWith('\nMigration summary:');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Successful: 2');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Failed: 0');
    expect(consoleLogSpy).toHaveBeenCalledWith('\nAll migrations completed successfully.');

    expect(mockMigrationService.executeMigration).toHaveBeenCalledTimes(2);
  });

  it('should filter migrations by module', async () => {
    const migrations = [
      { module: 'auth', name: '001_create_users.sql', version: '001' },
      { module: 'core', name: '002_add_settings.sql', version: '002' },
      { module: 'auth', name: '003_add_roles.sql', version: '003' },
    ];
    mockMigrationService.getPendingMigrations.mockResolvedValue(migrations);
    mockContext.args.module = 'auth';

    await migrateCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('Found 2 pending migration(s):\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - auth/001_create_users.sql (001)');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - auth/003_add_roles.sql (003)');
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('core'));

    expect(mockMigrationService.executeMigration).toHaveBeenCalledTimes(2);
  });

  it('should stop on first failure', async () => {
    const migrations = [
      { module: 'auth', name: '001_create_users.sql', version: '001' },
      { module: 'core', name: '002_add_settings.sql', version: '002' },
      { module: 'auth', name: '003_add_roles.sql', version: '003' },
    ];
    mockMigrationService.getPendingMigrations.mockResolvedValue(migrations);
    mockMigrationService.executeMigration
      .mockResolvedValueOnce(undefined) // First succeeds
      .mockRejectedValueOnce(new Error('Migration failed')); // Second fails

    await expect(migrateCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

    expect(consoleLogSpy).toHaveBeenCalledWith('  ✓ Success');
    expect(consoleErrorSpy).toHaveBeenCalledWith('  ✗ Failed: Migration failed');
    
    expect(consoleLogSpy).toHaveBeenCalledWith('\nMigration summary:');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Successful: 1');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Failed: 1');
    expect(consoleErrorSpy).toHaveBeenCalledWith('\nSome migrations failed. Database may be in an inconsistent state.');

    // Should not execute the third migration
    expect(mockMigrationService.executeMigration).toHaveBeenCalledTimes(2);
  });

  it('should handle service errors gracefully', async () => {
    mockMigrationService.getPendingMigrations.mockRejectedValue(new Error('Database error'));

    await expect(migrateCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error running migrations:',
      'Database error'
    );
  });
});