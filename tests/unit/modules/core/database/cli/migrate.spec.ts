/**
 * Unit tests for database migrate CLI command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/database/cli/migrate';
import type { CLIContext } from '../../../../../../src/cli/src/types';

// Mock dependencies
vi.mock('../../../../../../src/modules/core/database/cli/utils', () => ({
  ensureDatabaseInitialized: vi.fn()
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`Process exited with code ${code}`);
});

describe('database:migrate command', () => {
  let mockDbService: any;
  let mockMigrationService: any;
  let mockContext: CLIContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDbService = {
      isInitialized: vi.fn().mockResolvedValue(true),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    };
    
    mockMigrationService = {
      getPendingMigrations: vi.fn().mockResolvedValue([]),
      runMigration: vi.fn().mockResolvedValue(undefined)
    };
    
    const { ensureDatabaseInitialized } = vi.mocked(await import('../../../../../../src/modules/core/database/cli/utils'));
    ensureDatabaseInitialized.mockResolvedValue({
      dbService: mockDbService,
      migrationService: mockMigrationService,
      schemaService: {} as any
    });
    
    mockContext = {
      args: {},
      options: {},
      stdin: null,
      stdout: process.stdout,
      stderr: process.stderr
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('command metadata', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('migrate');
      expect(command.description).toBe('Run pending database migrations');
    });

    it('should have correct options', () => {
      expect(command.options).toHaveLength(2);
      
      const dryRunOption = command.options?.find(o => o.name === 'dry-run');
      expect(dryRunOption).toBeDefined();
      expect(dryRunOption?.alias).toBe('d');
      expect(dryRunOption?.type).toBe('boolean');
      expect(dryRunOption?.default).toBe(false);
      
      const moduleOption = command.options?.find(o => o.name === 'module');
      expect(moduleOption).toBeDefined();
      expect(moduleOption?.alias).toBe('m');
      expect(moduleOption?.type).toBe('string');
    });
  });

  describe('execute', () => {
    it('should check if database is initialized', async () => {
      await command.execute(mockContext);
      
      expect(mockDbService.isInitialized).toHaveBeenCalled();
    });

    it('should exit if database is not initialized', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      
      await expect(command.execute(mockContext)).rejects.toThrow('Process exited with code 1');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Database is not initialized. Run 'systemprompt database:schema --action=init' to initialize."
      );
    });

    it('should get pending migrations', async () => {
      await command.execute(mockContext);
      
      expect(mockMigrationService.getPendingMigrations).toHaveBeenCalled();
    });

    it('should handle no pending migrations', async () => {
      mockMigrationService.getPendingMigrations.mockResolvedValue([]);
      
      await command.execute(mockContext);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('No pending migrations found.');
    });

    it('should filter migrations by module', async () => {
      const allMigrations = [
        { id: '001', module: 'auth', filename: '001_create_users.sql', version: '001' },
        { id: '002', module: 'config', filename: '002_create_config.sql', version: '002' },
        { id: '003', module: 'auth', filename: '003_add_roles.sql', version: '003' }
      ];
      
      mockMigrationService.getPendingMigrations.mockResolvedValue(allMigrations);
      mockContext.args.module = 'auth';
      
      await command.execute(mockContext);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Found 2 pending migration(s):\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('  - auth/001_create_users.sql (001)');
      expect(mockConsoleLog).toHaveBeenCalledWith('  - auth/003_add_roles.sql (003)');
    });

    it('should run migrations in dry-run mode', async () => {
      const migrations = [
        { id: '001', module: 'auth', filename: '001_create_users.sql', version: '001' }
      ];
      
      mockMigrationService.getPendingMigrations.mockResolvedValue(migrations);
      mockMigrationService.executeMigration = vi.fn();
      mockContext.args['dry-run'] = true;
      
      await command.execute(mockContext);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Found 1 pending migration(s):\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('\n[DRY RUN] Migrations were not executed.');
      expect(mockMigrationService.executeMigration).not.toHaveBeenCalled();
    });

    it('should run migrations normally', async () => {
      const migrations = [
        { id: '001', module: 'auth', filename: '001_create_users.sql', version: '001' },
        { id: '002', module: 'config', filename: '002_create_config.sql', version: '002' }
      ];
      
      mockMigrationService.getPendingMigrations.mockResolvedValue(migrations);
      mockMigrationService.executeMigration = vi.fn().mockResolvedValue(undefined);
      
      await command.execute(mockContext);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Found 2 pending migration(s):\n');
      expect(mockConsoleLog).toHaveBeenCalledWith('\nExecuting migrations...\n');
      expect(mockMigrationService.executeMigration).toHaveBeenCalledTimes(2);
      expect(mockMigrationService.executeMigration).toHaveBeenCalledWith(migrations[0]);
      expect(mockMigrationService.executeMigration).toHaveBeenCalledWith(migrations[1]);
      expect(mockConsoleLog).toHaveBeenCalledWith('\nAll migrations completed successfully.');
    });

    it('should handle migration errors and stop on first failure', async () => {
      const migrations = [
        { id: '001', module: 'auth', filename: '001_create_users.sql', version: '001' },
        { id: '002', module: 'config', filename: '002_create_config.sql', version: '002' }
      ];
      
      mockMigrationService.getPendingMigrations.mockResolvedValue(migrations);
      mockMigrationService.executeMigration = vi.fn()
        .mockRejectedValueOnce(new Error('Migration failed'));
      
      await expect(command.execute(mockContext)).rejects.toThrow('Process exited with code 1');
      
      expect(mockConsoleError).toHaveBeenCalledWith('  ✗ Failed: Migration failed');
      expect(mockConsoleError).toHaveBeenCalledWith('\nSome migrations failed. Database may be in an inconsistent state.');
      expect(mockMigrationService.executeMigration).toHaveBeenCalledTimes(1);
    });

    it('should show migration summary', async () => {
      const migrations = [
        { id: '001', module: 'auth', filename: '001_create_users.sql', version: '001' },
        { id: '002', module: 'config', filename: '002_create_config.sql', version: '002' }
      ];
      
      mockMigrationService.getPendingMigrations.mockResolvedValue(migrations);
      mockMigrationService.executeMigration = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'));
      
      await expect(command.execute(mockContext)).rejects.toThrow('Process exited with code 1');
      
      expect(mockConsoleLog).toHaveBeenCalledWith('\nMigration summary:');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Successful: 1');
      expect(mockConsoleLog).toHaveBeenCalledWith('  Failed: 1');
    });

    it('should handle errors during command execution', async () => {
      const { ensureDatabaseInitialized } = vi.mocked(await import('../../../../../../src/modules/core/database/cli/utils'));
      ensureDatabaseInitialized.mockRejectedValue(new Error('Initialization failed'));
      
      await expect(command.execute(mockContext)).rejects.toThrow('Process exited with code 1');
      
      expect(mockConsoleError).toHaveBeenCalledWith('Error running migrations:', 'Initialization failed');
    });
  });
});