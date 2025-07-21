import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CLIContext } from '../../../../cli/src/types.js';
import { command as rollbackCommand } from '../../cli/rollback.js';
import { DatabaseService } from '../../services/database.service.js';
import { MigrationService } from '../../services/migration.service.js';

// Mock the services
vi.mock('../../services/database.service.js');
vi.mock('../../services/migration.service.js');

describe('database:rollback command', () => {
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
      getExecutedMigrations: vi.fn().mockResolvedValue([]),
      rollbackMigration: vi.fn().mockResolvedValue(undefined),
    };

    // Mock getInstance methods
    vi.mocked(DatabaseService.getInstance).mockReturnValue(mockDbService);
    vi.mocked(MigrationService.getInstance).mockReturnValue(mockMigrationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct command metadata', () => {
    expect(rollbackCommand.name).toBe('rollback');
    expect(rollbackCommand.description).toBe('Rollback database migrations');
    expect(rollbackCommand.options).toHaveLength(3);
    
    const stepsOption = rollbackCommand.options?.find(opt => opt.name === 'steps');
    expect(stepsOption).toBeDefined();
    expect(stepsOption?.default).toBe(1);
    
    const forceOption = rollbackCommand.options?.find(opt => opt.name === 'force');
    expect(forceOption).toBeDefined();
    expect(forceOption?.default).toBe(false);
  });

  it('should show error when database is not initialized', async () => {
    mockDbService.isInitialized.mockResolvedValue(false);

    await expect(rollbackCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Database is not initialized. Nothing to rollback.'
    );
  });

  it('should handle no executed migrations', async () => {
    mockMigrationService.getExecutedMigrations.mockResolvedValue([]);

    await rollbackCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('No executed migrations found to rollback.');
  });

  it('should show warning without force flag', async () => {
    const migrations = [
      { module: 'auth', name: '001_create_users.sql', executed_at: '2024-01-01T00:00:00Z' },
    ];
    mockMigrationService.getExecutedMigrations.mockResolvedValue(migrations);

    await rollbackCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('Planning to rollback 1 migration(s):\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - auth/001_create_users.sql (executed: 2024-01-01T00:00:00Z)');
    expect(consoleLogSpy).toHaveBeenCalledWith('\n⚠️  WARNING: This action cannot be undone!');
    expect(consoleLogSpy).toHaveBeenCalledWith('Use --force flag to confirm rollback.\n');
    expect(mockMigrationService.rollbackMigration).not.toHaveBeenCalled();
  });

  it('should rollback single migration with force flag', async () => {
    const migrations = [
      { module: 'auth', name: '002_add_roles.sql', executed_at: '2024-01-02T00:00:00Z' },
      { module: 'auth', name: '001_create_users.sql', executed_at: '2024-01-01T00:00:00Z' },
    ];
    mockMigrationService.getExecutedMigrations.mockResolvedValue(migrations);
    mockContext.args.force = true;

    await rollbackCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('Planning to rollback 1 migration(s):\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - auth/002_add_roles.sql (executed: 2024-01-02T00:00:00Z)');
    expect(consoleLogSpy).toHaveBeenCalledWith('\nExecuting rollbacks...\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('Rolling back auth/002_add_roles.sql...');
    expect(consoleLogSpy).toHaveBeenCalledWith('  ✓ Success');
    expect(consoleLogSpy).toHaveBeenCalledWith('\nRollback summary:');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Successful: 1');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Failed: 0');
    expect(consoleLogSpy).toHaveBeenCalledWith('\nAll rollbacks completed successfully.');

    expect(mockMigrationService.rollbackMigration).toHaveBeenCalledTimes(1);
    expect(mockMigrationService.rollbackMigration).toHaveBeenCalledWith(migrations[0]);
  });

  it('should rollback multiple migrations with steps parameter', async () => {
    const migrations = [
      { module: 'core', name: '003_add_logs.sql', executed_at: '2024-01-03T00:00:00Z' },
      { module: 'auth', name: '002_add_roles.sql', executed_at: '2024-01-02T00:00:00Z' },
      { module: 'auth', name: '001_create_users.sql', executed_at: '2024-01-01T00:00:00Z' },
    ];
    mockMigrationService.getExecutedMigrations.mockResolvedValue(migrations);
    mockContext.args.steps = 2;
    mockContext.args.force = true;

    await rollbackCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('Planning to rollback 2 migration(s):\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - core/003_add_logs.sql (executed: 2024-01-03T00:00:00Z)');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - auth/002_add_roles.sql (executed: 2024-01-02T00:00:00Z)');
    
    expect(mockMigrationService.rollbackMigration).toHaveBeenCalledTimes(2);
    expect(mockMigrationService.rollbackMigration).toHaveBeenCalledWith(migrations[0]);
    expect(mockMigrationService.rollbackMigration).toHaveBeenCalledWith(migrations[1]);
  });

  it('should filter migrations by module', async () => {
    const migrations = [
      { module: 'core', name: '003_add_logs.sql', executed_at: '2024-01-03T00:00:00Z' },
      { module: 'auth', name: '002_add_roles.sql', executed_at: '2024-01-02T00:00:00Z' },
      { module: 'auth', name: '001_create_users.sql', executed_at: '2024-01-01T00:00:00Z' },
    ];
    mockMigrationService.getExecutedMigrations.mockResolvedValue(migrations);
    mockContext.args.module = 'auth';
    mockContext.args.steps = 10; // More than available
    mockContext.args.force = true;

    await rollbackCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('Planning to rollback 2 migration(s):\n');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - auth/002_add_roles.sql (executed: 2024-01-02T00:00:00Z)');
    expect(consoleLogSpy).toHaveBeenCalledWith('  - auth/001_create_users.sql (executed: 2024-01-01T00:00:00Z)');
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('core'));

    expect(mockMigrationService.rollbackMigration).toHaveBeenCalledTimes(2);
  });

  it('should stop on first failure', async () => {
    const migrations = [
      { module: 'core', name: '003_add_logs.sql', executed_at: '2024-01-03T00:00:00Z' },
      { module: 'auth', name: '002_add_roles.sql', executed_at: '2024-01-02T00:00:00Z' },
      { module: 'auth', name: '001_create_users.sql', executed_at: '2024-01-01T00:00:00Z' },
    ];
    mockMigrationService.getExecutedMigrations.mockResolvedValue(migrations);
    mockMigrationService.rollbackMigration
      .mockResolvedValueOnce(undefined) // First succeeds
      .mockRejectedValueOnce(new Error('Rollback failed')); // Second fails

    mockContext.args.steps = 3;
    mockContext.args.force = true;

    await expect(rollbackCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

    expect(consoleLogSpy).toHaveBeenCalledWith('  ✓ Success');
    expect(consoleErrorSpy).toHaveBeenCalledWith('  ✗ Failed: Rollback failed');
    
    expect(consoleLogSpy).toHaveBeenCalledWith('\nRollback summary:');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Successful: 1');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Failed: 1');
    expect(consoleErrorSpy).toHaveBeenCalledWith('\nSome rollbacks failed. Database may be in an inconsistent state.');

    // Should not execute the third rollback
    expect(mockMigrationService.rollbackMigration).toHaveBeenCalledTimes(2);
  });

  it('should handle service errors gracefully', async () => {
    mockMigrationService.getExecutedMigrations.mockRejectedValue(new Error('Database error'));

    await expect(rollbackCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error rolling back migrations:',
      'Database error'
    );
  });

  it('should handle no migrations after filtering', async () => {
    const migrations = [
      { module: 'core', name: '001_init.sql', executed_at: '2024-01-01T00:00:00Z' },
    ];
    mockMigrationService.getExecutedMigrations.mockResolvedValue(migrations);
    mockContext.args.module = 'auth'; // Filter by non-existent module

    await rollbackCommand.execute(mockContext);

    expect(consoleLogSpy).toHaveBeenCalledWith('No executed migrations found to rollback.');
    expect(mockMigrationService.rollbackMigration).not.toHaveBeenCalled();
  });
});