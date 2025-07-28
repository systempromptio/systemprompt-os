import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ICLIContext } from '@/modules/core/cli/types/index';
import { command as schemaCommand } from '@/modules/core/database/cli/schema';
import { DatabaseSchemaService } from '@/modules/core/cli/services/database-schema.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

// Mock the services
vi.mock('@/modules/core/cli/services/database-schema.service');
vi.mock('@/modules/core/logger/services/logger.service');

describe('database:schema command', () => {
  let mockContext: ICLIContext;
  let mockDatabaseSchemaService: any;
  let mockLoggerService: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Setup mocks
    mockContext = {
      cwd: '/test',
      args: {},
      flags: {},
      env: {}
    };

    // Mock process.exit
    processExitSpy = vi.spyOn(process!, 'exit').mockImplementation((code?: number!) => {
      throw new Error(`Process exited with code ${code}`);
    });

    // Setup logger service mock
    mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Setup database schema service mock
    mockDatabaseSchemaService = {
      listSchemas: vi.fn().mockResolvedValue({
        success: true,
        data: { schemas: [] }
      }),
      initializeSchemas: vi.fn().mockResolvedValue({
        success: true
      }),
      validateSchemas: vi.fn().mockResolvedValue({
        success: true
      }),
    };

    // Mock getInstance methods
    vi.mocked(LoggerService.getInstance).mockReturnValue(mockLoggerService);
    vi.mocked(DatabaseSchemaService.getInstance).mockReturnValue(mockDatabaseSchemaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct command metadata', () => {
    expect(schemaCommand.name).toBe('schema');
    expect(schemaCommand.description).toBe('Manage database schemas');
    expect(schemaCommand.options).toHaveLength(3);
    
    const actionOption = schemaCommand.options?.find(opt => opt.name === 'action');
    expect(actionOption).toBeDefined();
    expect(actionOption?.description).toBe('Action to perform (list, init, validate)');
  });

  it('should require action parameter', async () => {
    await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');
    
    expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Unknown action: undefined');
    expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Valid actions are: list, init, validate');
  });

  describe('list action', () => {
    beforeEach(() => {
      mockContext.args.action = 'list';
    });

    it('should show message when database is not initialized', async () => {
      mockDatabaseSchemaService.listSchemas.mockResolvedValue({
        success: false,
        message: 'Database is not initialized. No schemas installed.'
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Database is not initialized. No schemas installed.');
    });

    it('should show message when no schemas are installed', async () => {
      mockDatabaseSchemaService.listSchemas.mockResolvedValue({
        success: true,
        data: { schemas: [] }
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, 'No schemas found.');
    });

    it('should list installed schemas', async () => {
      const schemas = [
        { moduleName: 'core', version: '1.0.0', installedAt: '2024-01-01T00:00:00Z' },
        { moduleName: 'auth', version: '2.0.0', installedAt: '2024-01-02T00:00:00Z' },
      ];
      mockDatabaseSchemaService.listSchemas.mockResolvedValue({
        success: true,
        data: { schemas }
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, expect.stringMatching(/INSTALLED SCHEMAS/));
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '\nModule Name           Version    Installed At');
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '-'.repeat(60));
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, 'core                 1.0.0      2024-01-01');
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, 'auth                 2.0.0      2024-01-02');
    });
  });

  describe('init action', () => {
    beforeEach(() => {
      mockContext.args.action = 'init';
    });

    it('should prevent initialization when already initialized without force', async () => {
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: false,
        message: 'Database is already initialized. Use --force to reinitialize.'
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        LogSource.DATABASE,
        'Database is already initialized. Use --force to reinitialize.'
      );
    });

    it('should warn when force initializing', async () => {
      mockContext.args.force = true;
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: true,
        warnings: [
          '⚠️  WARNING: Force initializing will reset the database!',
          'This action cannot be undone.\n'
        ]
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.warn).toHaveBeenCalledWith(LogSource.DATABASE, '⚠️  WARNING: Force initializing will reset the database!');
      expect(mockLoggerService.warn).toHaveBeenCalledWith(LogSource.DATABASE, 'This action cannot be undone.\n');
    });

    it('should initialize base schema', async () => {
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: true,
        results: [
          { module: 'base', success: true, message: 'Base schema initialized' }
        ]
      });

      await schemaCommand.execute(mockContext);

      expect(mockDatabaseSchemaService.initializeSchemas).toHaveBeenCalledWith({ force: false });
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '✓ base: Base schema initialized');
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, expect.stringContaining('Database initialization complete'));
    });

    it('should initialize specific module schema', async () => {
      mockContext.args.module = 'auth';
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: true,
        results: [
          { module: 'auth', success: true, message: 'Schema initialized' }
        ]
      });

      await schemaCommand.execute(mockContext);

      expect(mockDatabaseSchemaService.initializeSchemas).toHaveBeenCalledWith({ force: false, module: 'auth' });
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '✓ auth: Schema initialized');
    });

    it('should error when specified module not found', async () => {
      mockContext.args.module = 'nonexistent';
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: false,
        message: "Module 'nonexistent' not found or has no schema."
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        LogSource.DATABASE,
        "Module 'nonexistent' not found or has no schema."
      );
    });

    it('should initialize all discovered schemas', async () => {
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: true,
        results: [
          { module: 'core', success: true, message: 'Schema initialized' },
          { module: 'auth', success: true, message: 'Schema initialized' }
        ]
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '✓ core: Schema initialized');
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '✓ auth: Schema initialized');
    });

    it('should handle schema installation errors', async () => {
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: false,
        message: 'Failed to initialize schema: Schema error'
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Failed to initialize schema: Schema error');
    });
  });

  describe('validate action', () => {
    beforeEach(() => {
      mockContext.args.action = 'validate';
    });

    it('should error when database not initialized', async () => {
      mockDatabaseSchemaService.validateSchemas.mockResolvedValue({
        success: false,
        message: 'Database is not initialized. Nothing to validate.'
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        LogSource.DATABASE,
        'Database is not initialized. Nothing to validate.'
      );
    });

    it('should validate all schemas successfully', async () => {
      mockDatabaseSchemaService.validateSchemas.mockResolvedValue({
        success: true,
        issues: []
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, 'Validating database schemas...\n');
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '\n✓ All schemas are valid.');
    });

    it('should detect missing schemas', async () => {
      mockDatabaseSchemaService.validateSchemas.mockResolvedValue({
        success: true,
        issues: [
          { module: 'auth', message: "Schema for 'auth' is not installed", severity: 'error' }
        ]
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, '✗ auth: Schema for \'auth\' is not installed');
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        LogSource.DATABASE,
        "\n⚠️  Schema validation found issues. Run 'systemprompt database:schema --action=init' to fix."
      );
    });

    it('should detect orphaned schemas', async () => {
      mockDatabaseSchemaService.validateSchemas.mockResolvedValue({
        success: true,
        issues: [
          { module: 'legacy', message: "Installed schema for 'legacy' has no corresponding module", severity: 'warning' }
        ]
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        LogSource.DATABASE,
        "⚠️ legacy: Installed schema for 'legacy' has no corresponding module"
      );
    });

    it('should validate specific module only', async () => {
      mockContext.args.module = 'core';
      mockDatabaseSchemaService.validateSchemas.mockResolvedValue({
        success: true,
        issues: []
      });

      await schemaCommand.execute(mockContext);

      expect(mockDatabaseSchemaService.validateSchemas).toHaveBeenCalledWith({ module: 'core' });
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '\n✓ All schemas are valid.');
    });
  });

  it('should handle service errors gracefully', async () => {
    mockContext.args.action = 'list';
    mockDatabaseSchemaService.listSchemas.mockRejectedValue(new Error('Service error'));

    await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

    expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'Service error' });
  });

  describe('error handling', () => {
    it('should handle unknown string action', async () => {
      mockContext.args.action = 'unknown';

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Unknown action: unknown');
      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Valid actions are: list, init, validate');
    });

    it('should handle DatabaseSchemaService.getInstance() errors', async () => {
      mockContext.args.action = 'list';
      vi.mocked(DatabaseSchemaService.getInstance).mockImplementation(() => {
        throw new Error('Database schema service not initialized');
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'Database schema service not initialized' });
    });

    it('should handle LoggerService.getInstance() errors', async () => {
      mockContext.args.action = 'list';
      vi.mocked(LoggerService.getInstance).mockImplementation(() => {
        throw new Error('Logger service not initialized');
      });

      // The error will be thrown before process.exit is called
      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Logger service not initialized');
    });

    it('should handle non-Error thrown objects', async () => {
      mockContext.args.action = 'list';
      mockDatabaseSchemaService.listSchemas.mockRejectedValue('String error');

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'String error' });
    });

    it('should handle null/undefined thrown values', async () => {
      mockContext.args.action = 'list';
      mockDatabaseSchemaService.listSchemas.mockRejectedValue(null);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'null' });
    });
  });

  describe('list action edge cases', () => {
    beforeEach(() => {
      mockContext.args.action = 'list';
    });

    it('should handle listSchemas() errors', async () => {
      mockDatabaseSchemaService.listSchemas.mockRejectedValue(new Error('Connection failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'Connection failed' });
    });

    it('should handle schemas with missing properties', async () => {
      const schemas = [
        { moduleName: 'core', version: '1.0.0', installedAt: '2024-01-01T00:00:00Z' },
        { moduleName: '', version: '', installedAt: 'invalid-date' }, // Edge case: empty strings
      ];
      mockDatabaseSchemaService.listSchemas.mockResolvedValue({
        success: true,
        data: { schemas }
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, 'core                 1.0.0      2024-01-01');
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '                                invalid-date');
    });

    it('should handle schemas with very long names', async () => {
      const longName = 'a'.repeat(50);
      const schemas = [
        { moduleName: longName, version: '1.0.0', installedAt: '2024-01-01T00:00:00Z' },
      ];
      mockDatabaseSchemaService.listSchemas.mockResolvedValue({
        success: true,
        data: { schemas }
      });

      await schemaCommand.execute(mockContext);

      // Should still display the schema even with long name
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, expect.stringContaining(longName));
    });

    it('should handle installed_at dates without time component', async () => {
      const schemas = [
        { moduleName: 'core', version: '1.0.0', installedAt: '2024-01-01' },
      ];
      mockDatabaseSchemaService.listSchemas.mockResolvedValue({
        success: true,
        data: { schemas }
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, 'core                 1.0.0      2024-01-01');
    });
  });

  describe('init action edge cases', () => {
    beforeEach(() => {
      mockContext.args.action = 'init';
    });

    it('should handle module schema installation failure gracefully', async () => {
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: true,
        results: [
          { module: 'core', success: true, message: 'Success' },
          { module: 'auth', success: false, message: 'Installation failed' }
        ]
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '✓ core: Success');
      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, '✗ auth: Installation failed');
    });

    it('should handle module schema installation failure with non-Error object', async () => {
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: true,
        results: [
          { module: 'core', success: false, message: 'String error' }
        ]
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, '✗ core: String error');
    });

    it('should handle empty module name in specific module init', async () => {
      mockContext.args.module = '';
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: true
      });

      await schemaCommand.execute(mockContext);

      // Empty module name should be treated as general initialization
      expect(mockDatabaseSchemaService.initializeSchemas).toHaveBeenCalledWith({ force: false });
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, expect.stringContaining('Database initialization complete'));
    });

    it('should handle initializeSchemas error during module-specific init', async () => {
      mockContext.args.module = 'auth';
      mockDatabaseSchemaService.initializeSchemas.mockRejectedValue(new Error('Discovery failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'Discovery failed' });
    });

    it('should handle initializeSchemas error during general init', async () => {
      mockDatabaseSchemaService.initializeSchemas.mockRejectedValue(new Error('Discovery failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'Discovery failed' });
    });

    it('should handle force initialization with error', async () => {
      mockContext.args.force = true;
      mockDatabaseSchemaService.initializeSchemas.mockRejectedValue(new Error('Connection failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'Connection failed' });
    });

    it('should handle zero schemas discovered during general init', async () => {
      mockDatabaseSchemaService.initializeSchemas.mockResolvedValue({
        success: true,
        results: []
      });

      await schemaCommand.execute(mockContext);

      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, expect.stringContaining('Database initialization complete'));
      // Should not have any schema-specific messages
      expect(mockLoggerService.info).not.toHaveBeenCalledWith(LogSource.DATABASE, expect.stringMatching(/\u2713.*:/));
    });
  });

  describe('validate action edge cases', () => {
    beforeEach(() => {
      mockContext.args.action = 'validate';
    });

    it('should handle validateSchemas error', async () => {
      mockDatabaseSchemaService.validateSchemas.mockRejectedValue(new Error('Query failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'Query failed' });
    });

    it('should handle validateSchemas error during validation', async () => {
      mockDatabaseSchemaService.validateSchemas.mockRejectedValue(new Error('Discovery failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'Discovery failed' });
    });

    it('should handle module-specific validation with non-existent module', async () => {
      mockContext.args.module = 'nonexistent';
      mockDatabaseSchemaService.validateSchemas.mockResolvedValue({
        success: true,
        issues: [
          { module: 'nonexistent', message: "Schema for 'nonexistent' is not installed", severity: 'error' }
        ]
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, "✗ nonexistent: Schema for 'nonexistent' is not installed");
      expect(mockLoggerService.info).not.toHaveBeenCalledWith(LogSource.DATABASE, '\n✓ All schemas are valid.');
    });

    it('should handle empty module name in validation', async () => {
      mockContext.args.module = '';
      mockDatabaseSchemaService.validateSchemas.mockResolvedValue({
        success: true,
        issues: []
      });

      await schemaCommand.execute(mockContext);

      // Empty module name should be treated as validating all schemas
      expect(mockDatabaseSchemaService.validateSchemas).toHaveBeenCalledWith({});
      expect(mockLoggerService.info).toHaveBeenCalledWith(LogSource.DATABASE, '\n✓ All schemas are valid.');
    });

    it('should handle schemas with undefined moduleName', async () => {
      mockDatabaseSchemaService.validateSchemas.mockResolvedValue({
        success: true,
        issues: [
          { module: 'undefined', message: "Schema for 'undefined' is not installed", severity: 'error' }
        ]
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, "✗ undefined: Schema for 'undefined' is not installed");
    });

    it('should handle validation with mixed scenarios', async () => {
      mockDatabaseSchemaService.validateSchemas.mockResolvedValue({
        success: true,
        issues: [
          { module: 'new-module', message: "Schema for 'new-module' is not installed", severity: 'error' },
          { module: 'old-module', message: "Installed schema for 'old-module' has no corresponding module", severity: 'warning' }
        ]
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, "✗ new-module: Schema for 'new-module' is not installed");
      expect(mockLoggerService.warn).toHaveBeenCalledWith(LogSource.DATABASE, "⚠️ old-module: Installed schema for 'old-module' has no corresponding module");
    });

    it('should handle Promise.all rejection', async () => {
      mockDatabaseSchemaService.validateSchemas.mockRejectedValue(new Error('Async error'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(mockLoggerService.error).toHaveBeenCalledWith(LogSource.DATABASE, 'Error managing schema:', { error: 'Async error' });
    });
  });

  describe('command metadata edge cases', () => {
    it('should have options with correct types', () => {
      const options = schemaCommand.options;
      expect(options).toBeDefined();
      
      const actionOption = options?.find(opt => opt.name === 'action');
      expect(actionOption?.type).toBe('string');
      expect(actionOption?.required).toBe(false);
      
      const forceOption = options?.find(opt => opt.name === 'force');
      expect(forceOption?.type).toBe('boolean');
      expect(forceOption?.required).toBe(false);
      
      const moduleOption = options?.find(opt => opt.name === 'module');
      expect(moduleOption?.type).toBe('string');
      expect(moduleOption?.required).toBe(false);
    });

    it('should have execute function defined', () => {
      expect(typeof schemaCommand.execute).toBe('function');
    });
  });
});