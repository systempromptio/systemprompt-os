import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CLIContext } from '@/modules/core/cli/types';
import { command as schemaCommand } from '@/modules/core/database/cli/schema';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { SchemaService } from '@/modules/core/database/services/schema.service';

// Mock the services
vi.mock('@/modules/core/database/services/database.service');
vi.mock('@/modules/core/database/services/schema.service');

describe('database:schema command', () => {
  let mockContext: CLIContext;
  let mockDbService: any;
  let mockSchemaService: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Setup mocks
    mockContext = {
      cwd: '/test',
      args: {},
      flags: {},
      env: {}
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
    };

    mockSchemaService = {
      getInstalledSchemas: vi.fn().mockResolvedValue([]),
      initializeBaseSchema: vi.fn().mockResolvedValue(undefined),
      discoverSchemasArray: vi.fn().mockResolvedValue([]),
      installModuleSchema: vi.fn().mockResolvedValue(undefined),
    };

    // Mock getInstance methods
    vi.mocked(DatabaseService.getInstance).mockReturnValue(mockDbService);
    vi.mocked(SchemaService.getInstance).mockReturnValue(mockSchemaService);
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
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unknown action: undefined');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Valid actions are: list, init, validate');
  });

  describe('list action', () => {
    beforeEach(() => {
      mockContext.args.action = 'list';
    });

    it('should show message when database is not initialized', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('Database is not initialized. No schemas installed.');
    });

    it('should show message when no schemas are installed', async () => {
      mockSchemaService.getInstalledSchemas.mockResolvedValue([]);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('No schemas found.');
    });

    it('should list installed schemas', async () => {
      const schemas = [
        { module_name: 'core', version: '1.0.0', installed_at: '2024-01-01T00:00:00Z' },
        { module_name: 'auth', version: '2.0.0', installed_at: '2024-01-02T00:00:00Z' },
      ];
      mockSchemaService.getInstalledSchemas.mockResolvedValue(schemas);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('\nInstalled Schemas:\n');
      expect(consoleLogSpy).toHaveBeenCalledWith('Module Name           Version    Installed At');
      expect(consoleLogSpy).toHaveBeenCalledWith('-'.repeat(60));
      expect(consoleLogSpy).toHaveBeenCalledWith('core                 1.0.0      2024-01-01');
      expect(consoleLogSpy).toHaveBeenCalledWith('auth                 2.0.0      2024-01-02');
    });
  });

  describe('init action', () => {
    beforeEach(() => {
      mockContext.args.action = 'init';
    });

    it('should prevent initialization when already initialized without force', async () => {
      mockDbService.isInitialized.mockResolvedValue(true);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Database is already initialized. Use --force to reinitialize.'
      );
    });

    it('should warn when force initializing', async () => {
      mockDbService.isInitialized.mockResolvedValue(true);
      mockContext.args.force = true;

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️  WARNING: Force initializing will reset the database!');
      expect(consoleLogSpy).toHaveBeenCalledWith('This action cannot be undone.\n');
    });

    it('should initialize base schema', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('Initializing database schema...\n');
      expect(mockSchemaService.initializeBaseSchema).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Base schema initialized');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nDatabase initialization complete.');
    });

    it('should initialize specific module schema', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      mockContext.args.module = 'auth';
      
      const moduleSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
        { moduleName: 'auth', schemaPath: '/path/to/auth/schema.sql' },
      ];
      mockSchemaService.discoverSchemasArray.mockResolvedValue(moduleSchemas);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('\nInitializing schema for module: auth');
      expect(mockSchemaService.installModuleSchema).toHaveBeenCalledWith(moduleSchemas[1]);
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Schema for auth initialized');
    });

    it('should error when specified module not found', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      mockContext.args.module = 'nonexistent';
      mockSchemaService.discoverSchemasArray.mockResolvedValue([]);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Module 'nonexistent' not found or has no schema."
      );
    });

    it('should initialize all discovered schemas', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      
      const moduleSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
        { moduleName: 'auth', schemaPath: '/path/to/auth/schema.sql' },
      ];
      mockSchemaService.discoverSchemasArray.mockResolvedValue(moduleSchemas);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('\nFound 2 module schema(s) to install:\n');
      expect(consoleLogSpy).toHaveBeenCalledWith('Installing schema for core...');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ✓ Success');
      expect(consoleLogSpy).toHaveBeenCalledWith('Installing schema for auth...');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ✓ Success');
      expect(mockSchemaService.installModuleSchema).toHaveBeenCalledTimes(2);
    });

    it('should handle schema installation errors', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      mockSchemaService.initializeBaseSchema.mockRejectedValue(new Error('Schema error'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize schema:', 'Schema error');
    });
  });

  describe('validate action', () => {
    beforeEach(() => {
      mockContext.args.action = 'validate';
    });

    it('should error when database not initialized', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Database is not initialized. Nothing to validate.'
      );
    });

    it('should validate all schemas successfully', async () => {
      const installedSchemas = [
        { module_name: 'core', version: '1.0.0' },
        { module_name: 'auth', version: '1.0.0' },
      ];
      const discoveredSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
        { moduleName: 'auth', schemaPath: '/path/to/auth/schema.sql' },
      ];

      mockSchemaService.getInstalledSchemas.mockResolvedValue(installedSchemas);
      mockSchemaService.discoverSchemasArray.mockResolvedValue(discoveredSchemas);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('Validating database schemas...\n');
      expect(consoleLogSpy).toHaveBeenCalledWith("✓ Schema for 'core' is installed (v1.0.0)");
      expect(consoleLogSpy).toHaveBeenCalledWith("✓ Schema for 'auth' is installed (v1.0.0)");
      expect(consoleLogSpy).toHaveBeenCalledWith('\n✓ All schemas are valid.');
    });

    it('should detect missing schemas', async () => {
      const installedSchemas = [
        { module_name: 'core', version: '1.0.0' },
      ];
      const discoveredSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
        { moduleName: 'auth', schemaPath: '/path/to/auth/schema.sql' },
      ];

      mockSchemaService.getInstalledSchemas.mockResolvedValue(installedSchemas);
      mockSchemaService.discoverSchemasArray.mockResolvedValue(discoveredSchemas);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleLogSpy).toHaveBeenCalledWith("✓ Schema for 'core' is installed (v1.0.0)");
      expect(consoleLogSpy).toHaveBeenCalledWith("⚠️  Schema for 'auth' is not installed");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "\n⚠️  Schema validation found issues. Run 'systemprompt database:schema --action=init' to fix."
      );
    });

    it('should detect orphaned schemas', async () => {
      const installedSchemas = [
        { module_name: 'core', version: '1.0.0' },
        { module_name: 'legacy', version: '1.0.0' },
      ];
      const discoveredSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
      ];

      mockSchemaService.getInstalledSchemas.mockResolvedValue(installedSchemas);
      mockSchemaService.discoverSchemasArray.mockResolvedValue(discoveredSchemas);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "⚠️  Installed schema for 'legacy' has no corresponding module"
      );
    });

    it('should validate specific module only', async () => {
      mockContext.args.module = 'core';
      
      const installedSchemas = [
        { module_name: 'core', version: '1.0.0' },
        { module_name: 'auth', version: '1.0.0' },
      ];
      const discoveredSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
        { moduleName: 'auth', schemaPath: '/path/to/auth/schema.sql' },
      ];

      mockSchemaService.getInstalledSchemas.mockResolvedValue(installedSchemas);
      mockSchemaService.discoverSchemasArray.mockResolvedValue(discoveredSchemas);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith("✓ Schema for 'core' is installed (v1.0.0)");
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('auth'));
    });
  });

  it('should handle service errors gracefully', async () => {
    mockContext.args.action = 'list';
    mockSchemaService.getInstalledSchemas.mockRejectedValue(new Error('Service error'));

    await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error managing schema:', 'Service error');
  });

  describe('error handling', () => {
    it('should handle unknown string action', async () => {
      mockContext.args.action = 'unknown';

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Unknown action: unknown');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Valid actions are: list, init, validate');
    });

    it('should handle DatabaseService.getInstance() errors', async () => {
      mockContext.args.action = 'list';
      vi.mocked(DatabaseService.getInstance).mockImplementation(() => {
        throw new Error('Database service not initialized');
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error managing schema:', 'Database service not initialized');
    });

    it('should handle SchemaService.getInstance() errors', async () => {
      mockContext.args.action = 'list';
      vi.mocked(SchemaService.getInstance).mockImplementation(() => {
        throw new Error('Schema service not initialized');
      });

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error managing schema:', 'Schema service not initialized');
    });

    it('should handle non-Error thrown objects', async () => {
      mockContext.args.action = 'list';
      mockSchemaService.getInstalledSchemas.mockRejectedValue('String error');

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error managing schema:', 'String error');
    });

    it('should handle null/undefined thrown values', async () => {
      mockContext.args.action = 'list';
      mockSchemaService.getInstalledSchemas.mockRejectedValue(null);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error managing schema:', 'null');
    });
  });

  describe('list action edge cases', () => {
    beforeEach(() => {
      mockContext.args.action = 'list';
    });

    it('should handle dbService.isInitialized() errors', async () => {
      mockDbService.isInitialized.mockRejectedValue(new Error('Connection failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error managing schema:', 'Connection failed');
    });

    it('should handle schemas with missing properties', async () => {
      const schemas = [
        { module_name: 'core', version: '1.0.0', installed_at: '2024-01-01T00:00:00Z' },
        { module_name: '', version: '', installed_at: 'invalid-date' }, // Edge case: empty strings
      ];
      mockSchemaService.getInstalledSchemas.mockResolvedValue(schemas);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('core                 1.0.0      2024-01-01');
      expect(consoleLogSpy).toHaveBeenCalledWith('                                invalid-date');
    });

    it('should handle schemas with very long names', async () => {
      const longName = 'a'.repeat(50);
      const schemas = [
        { module_name: longName, version: '1.0.0', installed_at: '2024-01-01T00:00:00Z' },
      ];
      mockSchemaService.getInstalledSchemas.mockResolvedValue(schemas);

      await schemaCommand.execute(mockContext);

      // Should still display the schema even with long name
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(longName));
    });

    it('should handle installed_at dates without time component', async () => {
      const schemas = [
        { module_name: 'core', version: '1.0.0', installed_at: '2024-01-01' },
      ];
      mockSchemaService.getInstalledSchemas.mockResolvedValue(schemas);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('core                 1.0.0      2024-01-01');
    });
  });

  describe('init action edge cases', () => {
    beforeEach(() => {
      mockContext.args.action = 'init';
    });

    it('should handle module schema installation failure gracefully', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      
      const moduleSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
        { moduleName: 'auth', schemaPath: '/path/to/auth/schema.sql' },
      ];
      mockSchemaService.discoverSchemasArray.mockResolvedValue(moduleSchemas);
      
      // Mock first installation to succeed, second to fail
      mockSchemaService.installModuleSchema
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Installation failed'));

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('Installing schema for core...');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ✓ Success');
      expect(consoleLogSpy).toHaveBeenCalledWith('Installing schema for auth...');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ✗ Failed: Installation failed');
    });

    it('should handle module schema installation failure with non-Error object', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      
      const moduleSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
      ];
      mockSchemaService.discoverSchemasArray.mockResolvedValue(moduleSchemas);
      mockSchemaService.installModuleSchema.mockRejectedValue('String error');

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('  ✗ Failed: String error');
    });

    it('should handle empty module name in specific module init', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      mockContext.args.module = '';
      mockSchemaService.discoverSchemasArray.mockResolvedValue([]);

      await schemaCommand.execute(mockContext);

      // Empty module name should be treated as general initialization
      expect(consoleLogSpy).toHaveBeenCalledWith('Initializing database schema...\n');
      expect(mockSchemaService.initializeBaseSchema).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Base schema initialized');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nDatabase initialization complete.');
    });

    it('should handle discoverSchemasArray error during module-specific init', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      mockContext.args.module = 'auth';
      mockSchemaService.discoverSchemasArray.mockRejectedValue(new Error('Discovery failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize schema:', 'Discovery failed');
    });

    it('should handle discoverSchemasArray error during general init', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      mockSchemaService.discoverSchemasArray.mockRejectedValue(new Error('Discovery failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize schema:', 'Discovery failed');
    });

    it('should handle force initialization with dbService.isInitialized error', async () => {
      mockContext.args.force = true;
      mockDbService.isInitialized.mockRejectedValue(new Error('Connection failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error managing schema:', 'Connection failed');
    });

    it('should handle zero schemas discovered during general init', async () => {
      mockDbService.isInitialized.mockResolvedValue(false);
      mockSchemaService.discoverSchemasArray.mockResolvedValue([]);

      await schemaCommand.execute(mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith('Initializing database schema...\n');
      expect(mockSchemaService.initializeBaseSchema).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Base schema initialized');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nDatabase initialization complete.');
      // Should not show the "Found N module schema(s)" message
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Found'));
    });
  });

  describe('validate action edge cases', () => {
    beforeEach(() => {
      mockContext.args.action = 'validate';
    });

    it('should handle getInstalledSchemas error', async () => {
      mockDbService.isInitialized.mockResolvedValue(true);
      mockSchemaService.getInstalledSchemas.mockRejectedValue(new Error('Query failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Validation failed:', 'Query failed');
    });

    it('should handle discoverSchemasArray error during validation', async () => {
      mockDbService.isInitialized.mockResolvedValue(true);
      mockSchemaService.getInstalledSchemas.mockResolvedValue([]);
      mockSchemaService.discoverSchemasArray.mockRejectedValue(new Error('Discovery failed'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Validation failed:', 'Discovery failed');
    });

    it('should handle module-specific validation with non-existent module', async () => {
      mockContext.args.module = 'nonexistent';
      
      const installedSchemas = [
        { module_name: 'core', version: '1.0.0' },
      ];
      const discoveredSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
      ];

      mockSchemaService.getInstalledSchemas.mockResolvedValue(installedSchemas);
      mockSchemaService.discoverSchemasArray.mockResolvedValue(discoveredSchemas);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleLogSpy).toHaveBeenCalledWith("⚠️  Schema for 'nonexistent' is not installed");
      expect(consoleLogSpy).not.toHaveBeenCalledWith('\n✓ All schemas are valid.');
    });

    it('should handle empty module name in validation', async () => {
      mockContext.args.module = '';
      
      const installedSchemas = [
        { module_name: 'core', version: '1.0.0' },
      ];
      const discoveredSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
      ];

      mockSchemaService.getInstalledSchemas.mockResolvedValue(installedSchemas);
      mockSchemaService.discoverSchemasArray.mockResolvedValue(discoveredSchemas);

      await schemaCommand.execute(mockContext);

      // Empty module name should be treated as validating all schemas
      expect(consoleLogSpy).toHaveBeenCalledWith("✓ Schema for 'core' is installed (v1.0.0)");
      expect(consoleLogSpy).toHaveBeenCalledWith('\n✓ All schemas are valid.');
    });

    it('should handle schemas with undefined moduleName', async () => {
      const installedSchemas = [
        { module_name: 'core', version: '1.0.0' },
      ];
      const discoveredSchemas = [
        { moduleName: undefined, schemaPath: '/path/to/core/schema.sql' }, // Edge case
      ];

      mockSchemaService.getInstalledSchemas.mockResolvedValue(installedSchemas);
      mockSchemaService.discoverSchemasArray.mockResolvedValue(discoveredSchemas);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleLogSpy).toHaveBeenCalledWith("⚠️  Schema for 'undefined' is not installed");
    });

    it('should handle validation with mixed scenarios', async () => {
      const installedSchemas = [
        { module_name: 'core', version: '1.0.0' },
        { module_name: 'old-module', version: '1.0.0' },
      ];
      const discoveredSchemas = [
        { moduleName: 'core', schemaPath: '/path/to/core/schema.sql' },
        { moduleName: 'new-module', schemaPath: '/path/to/new/schema.sql' },
      ];

      mockSchemaService.getInstalledSchemas.mockResolvedValue(installedSchemas);
      mockSchemaService.discoverSchemasArray.mockResolvedValue(discoveredSchemas);

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleLogSpy).toHaveBeenCalledWith("✓ Schema for 'core' is installed (v1.0.0)");
      expect(consoleLogSpy).toHaveBeenCalledWith("⚠️  Schema for 'new-module' is not installed");
      expect(consoleLogSpy).toHaveBeenCalledWith("⚠️  Installed schema for 'old-module' has no corresponding module");
    });

    it('should handle Promise.all rejection', async () => {
      mockDbService.isInitialized.mockResolvedValue(true);
      mockSchemaService.getInstalledSchemas.mockResolvedValue([]);
      mockSchemaService.discoverSchemasArray.mockRejectedValue(new Error('Async error'));

      await expect(schemaCommand.execute(mockContext)).rejects.toThrow('Process exited with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Validation failed:', 'Async error');
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