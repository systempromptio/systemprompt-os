/**
 * Module generator service for creating new SystemPrompt OS modules.
 * @file Module generator service for creating new SystemPrompt OS modules.
 * @module modules/core/dev/services/module-generator
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import type { IModuleGeneratorOptions, IModuleGeneratorService } from '@/modules/core/dev/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Service for generating new SystemPrompt OS modules with complete boilerplate.
 */
export class ModuleGeneratorService implements IModuleGeneratorService {
  private static instance: ModuleGeneratorService;
  private logger!: ILogger;
  private initialized = false;

  /**
   * Get singleton instance.
   * @returns ModuleGeneratorService instance.
   */
  public static getInstance(): ModuleGeneratorService {
    ModuleGeneratorService.instance ||= new ModuleGeneratorService();
    return ModuleGeneratorService.instance;
  }

  /**
   * Private constructor for singleton.
   */
  private constructor() {}

  /**
   * Initialize the service.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger = LoggerService.getInstance();
    this.initialized = true;
    this.logger.info(LogSource.MODULES, 'ModuleGeneratorService initialized');
  }

  /**
   * Generate a new module with all necessary files.
   * @param options - Module generation options.
   */
  async generateModule(options: IModuleGeneratorOptions): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (!this.validateModuleName(options.name)) {
        throw new Error(`Invalid module name: ${options.name}`);
      }

      await this.createDirectoryStructure(options);

      await this.generateModuleFiles(options);
      await this.generateTypeDefinitions(options);
      await this.generateServiceLayer(options);

      if (options.needsDatabase) {
        await this.generateDatabaseSchema(options);
      }

      if (options.needsCli) {
        await this.generateCliCommands(options);
      }

      await this.generateRepositoryLayer(options);
      await this.generateErrorClasses(options);
      await this.generateTests(options);

      await this.validateTypeScript();
      await this.checkLinting(options);

      await this.registerModule(options);

      this.logger.info(LogSource.MODULES, `Successfully generated module: ${options.name}`);
    } catch (error) {
      this.logger.error(LogSource.MODULES, `Failed to generate module: ${options.name}`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Validate module name.
   * @param name - Module name to validate.
   * @returns True if valid.
   */
  validateModuleName(name: string): boolean {
    return (/^[a-z][a-z0-9-]*$/).test(name) && name.length >= 3;
  }

  /**
   * Get module path.
   * @param name - Module name.
   * @param isCustom - Whether this is a custom module.
   * @returns Full module path.
   */
  getModulePath(name: string, isCustom = false): string {
    return path.join(process.cwd(), 'src', 'modules', isCustom ? 'custom' : 'core', name);
  }

  /**
   * Create directory structure for the module.
   * @param options - Module options.
   */
  private async createDirectoryStructure(options: IModuleGeneratorOptions): Promise<void> {
    const modulePath = this.getModulePath(options.name, options.isCustom);
    const directories = [
      modulePath,
      path.join(modulePath, 'types'),
      path.join(modulePath, 'services'),
      path.join(modulePath, 'repositories'),
      path.join(modulePath, 'cli'),
      path.join(modulePath, 'database'),
      path.join(modulePath, 'database', 'migrations'),
      path.join(modulePath, 'errors')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Generate main module files.
   * @param options - Module options.
   */
  private async generateModuleFiles(options: IModuleGeneratorOptions): Promise<void> {
    const modulePath = this.getModulePath(options.name, options.isCustom);
    const pascalName = this.toPascalCase(options.name);
    const camelName = this.toCamelCase(options.name);
    const upperName = options.name.toUpperCase().replace(/-/g, '_');

    const indexContent = this.generateIndexTemplate(options, pascalName, camelName, upperName);
    await fs.writeFile(path.join(modulePath, 'index.ts'), indexContent);

    const yamlContent = this.generateModuleYaml(options);
    await fs.writeFile(path.join(modulePath, 'module.yaml'), yamlContent);
  }

  /**
   * Generate type definitions.
   * @param options - Module options.
   */
  private async generateTypeDefinitions(options: IModuleGeneratorOptions): Promise<void> {
    const modulePath = this.getModulePath(options.name, options.isCustom);
    const pascalName = this.toPascalCase(options.name);
    const content = this.generateTypesTemplate(options, pascalName);
    await fs.writeFile(path.join(modulePath, 'types', 'index.ts'), content);
  }

  /**
   * Generate service layer.
   * @param options - Module options.
   */
  private async generateServiceLayer(options: IModuleGeneratorOptions): Promise<void> {
    const modulePath = this.getModulePath(options.name, options.isCustom);
    const pascalName = this.toPascalCase(options.name);
    const camelName = this.toCamelCase(options.name);
    const content = this.generateServiceTemplate(options, pascalName, camelName);
    await fs.writeFile(path.join(modulePath, 'services', `${options.name}.service.ts`), content);
  }

  /**
   * Generate database schema.
   * @param options - Module options.
   */
  private async generateDatabaseSchema(options: IModuleGeneratorOptions): Promise<void> {
    if (!options.needsDatabase) { return; }

    const modulePath = this.getModulePath(options.name, options.isCustom);
    const content = this.generateSchemaTemplate(options);
    await fs.writeFile(path.join(modulePath, 'database', 'schema.sql'), content);
  }

  /**
   * Generate CLI commands.
   * @param options - Module options.
   */
  private async generateCliCommands(options: IModuleGeneratorOptions): Promise<void> {
    if (!options.needsCli) { return; }

    const modulePath = this.getModulePath(options.name, options.isCustom);
    const pascalName = this.toPascalCase(options.name);

    const indexContent = this.generateCliIndexTemplate(options, pascalName);
    await fs.writeFile(path.join(modulePath, 'cli', 'index.ts'), indexContent);

    const listContent = this.generateCliListTemplate(options, pascalName);
    await fs.writeFile(path.join(modulePath, 'cli', 'list.ts'), listContent);

    const createContent = this.generateCliCreateTemplate(options, pascalName);
    await fs.writeFile(path.join(modulePath, 'cli', 'create.ts'), createContent);
  }

  /**
   * Generate repository layer.
   * @param options - Module options.
   */
  private async generateRepositoryLayer(options: IModuleGeneratorOptions): Promise<void> {
    const modulePath = this.getModulePath(options.name, options.isCustom);
    const pascalName = this.toPascalCase(options.name);
    const camelName = this.toCamelCase(options.name);
    const content = this.generateRepositoryTemplate(options, pascalName, camelName);
    await fs.writeFile(path.join(modulePath, 'repositories', `${options.name}.repository.ts`), content);
  }

  /**
   * Generate error classes.
   * @param options - Module options.
   */
  private async generateErrorClasses(options: IModuleGeneratorOptions): Promise<void> {
    const modulePath = this.getModulePath(options.name, options.isCustom);
    const pascalName = this.toPascalCase(options.name);
    const content = this.generateErrorsTemplate(options, pascalName);
    await fs.writeFile(path.join(modulePath, 'errors', 'index.ts'), content);
  }

  /**
   * Generate tests.
   * @param options - Module options.
   */
  private async generateTests(options: IModuleGeneratorOptions): Promise<void> {
    const unitTestPath = path.join(process.cwd(), 'tests', 'unit', 'modules', 'core', options.name);
    const e2eTestPath = path.join(process.cwd(), 'tests', 'e2e');

    await fs.mkdir(unitTestPath, { recursive: true });

    const pascalName = this.toPascalCase(options.name);
    const unitTestContent = this.generateUnitTestTemplate(options, pascalName);
    await fs.writeFile(path.join(unitTestPath, `${options.name}.spec.ts`), unitTestContent);

    if (options.needsCli) {
      const e2eTestContent = this.generateE2ETestTemplate(options, pascalName);
      await fs.writeFile(path.join(e2eTestPath, `${options.name}.e2e.test.ts`), e2eTestContent);
    }
  }

  /**
   * Validate TypeScript compilation.
   */
  private async validateTypeScript(): Promise<void> {
    try {
      execSync('npm run typecheck', { stdio: 'pipe' });
    } catch (error) {
      this.logger.warn(LogSource.MODULES, 'TypeScript validation found issues - please review');
    }
  }

  /**
   * Check linting rules.
   * @param options - Module options.
   */
  private async checkLinting(options: IModuleGeneratorOptions): Promise<void> {
    try {
      const modulePath = this.getModulePath(options.name, options.isCustom);
      execSync(`npm run lint ${modulePath}`, { stdio: 'pipe' });
    } catch (error) {
      this.logger.warn(LogSource.MODULES, 'Linting found issues - please review');
    }
  }

  /**
   * Register module in the system.
   * @param options - Module options.
   */
  private async registerModule(options: IModuleGeneratorOptions): Promise<void> {
    this.logger.info(LogSource.MODULES, `Module ${options.name} generated. Manual registration required in:
    1. src/modules/types/index.ts - Add to ModuleName enum
    2. src/bootstrap/phases/core-modules-phase.ts - Add to core modules list
    3. src/modules/core/cli/commands/index.ts - Add CLI command (if applicable)`);
  }

  // Template generation methods

  private generateIndexTemplate(options: IModuleGeneratorOptions, pascalName: string, camelName: string, upperName: string): string {
    const modulePrefix = options.isCustom ? 'custom' : 'core';
    return `/**
 * ${options.description}
 *
 * @file ${pascalName} module entry point.
 * @module modules/${modulePrefix}/${options.name}
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { ModuleStatusEnum } from '@/modules/core/modules/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { ${pascalName}Service } from '@/modules/${modulePrefix}/${options.name}/services/${options.name}.service';
import type { I${pascalName}Service } from '@/modules/${modulePrefix}/${options.name}/types/index';

/**
 * Strongly typed exports interface for ${pascalName} module.
 */
export interface I${pascalName}ModuleExports {
  readonly service: () => I${pascalName}Service;
}

/**
 * ${pascalName} module implementation.
 */
export class ${pascalName}Module implements IModule<I${pascalName}ModuleExports> {
  public readonly name = '${options.name}';
  public readonly type = '${options.type}' as const;
  public readonly version = '1.0.0';
  public readonly description = '${options.description}';
  public readonly dependencies = ${JSON.stringify(options.dependencies)};
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private ${camelName}Service!: I${pascalName}Service;
  private logger!: ILogger;
  private initialized = false;
  private started = false;

  get exports(): I${pascalName}ModuleExports {
    return {
      service: (): I${pascalName}Service => this.getService(),
    };
  }

  /**
   * Initialize the ${options.name} module.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('${pascalName} module already initialized');
    }

    this.logger = LoggerService.getInstance();
    
    try {
      this.${camelName}Service = ${pascalName}Service.getInstance();
      await this.${camelName}Service.initialize();
      
      this.initialized = true;
      this.logger.info(LogSource.MODULES, '${pascalName} module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(\`Failed to initialize ${options.name} module: \${errorMessage}\`);
    }
  }

  /**
   * Start the ${options.name} module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('${pascalName} module not initialized');
    }

    if (this.started) {
      throw new Error('${pascalName} module already started');
    }

    this.status = ModuleStatusEnum.RUNNING;
    this.started = true;
    this.logger.info(LogSource.MODULES, '${pascalName} module started');
  }

  /**
   * Stop the ${options.name} module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModuleStatusEnum.STOPPED;
      this.started = false;
      this.logger.info(LogSource.MODULES, '${pascalName} module stopped');
    }
  }

  /**
   * Health check for the ${options.name} module.
   *
   * @returns Health status object.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: '${pascalName} module not initialized'
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: '${pascalName} module not started'
      };
    }
    return {
      healthy: true,
      message: '${pascalName} module is healthy'
    };
  }

  /**
   * Get the ${camelName} service.
   *
   * @returns The ${pascalName} service instance.
   * @throws {Error} When module is not initialized.
   */
  private getService(): I${pascalName}Service {
    if (!this.initialized) {
      throw new Error('${pascalName} module not initialized');
    }
    return this.${camelName}Service;
  }
}

/**
 * Factory function for creating the module.
 *
 * @returns New ${pascalName}Module instance.
 */
export function createModule(): ${pascalName}Module {
  return new ${pascalName}Module();
}

/**
 * Initialize function for core module pattern.
 *
 * @returns Initialized ${pascalName}Module instance.
 */
export async function initialize(): Promise<${pascalName}Module> {
  const ${camelName}Module = new ${pascalName}Module();
  await ${camelName}Module.initialize();
  return ${camelName}Module;
}

/**
 * Gets the ${pascalName} module with type safety and validation.
 *
 * @returns The ${pascalName} module with guaranteed typed exports.
 * @throws {Error} If ${pascalName} module is not available or missing required exports.
 */
export function get${pascalName}Module(): IModule<I${pascalName}ModuleExports> {
  // Dynamic imports to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getModuleLoader } = require('@/modules/loader');
  // eslint-disable-next-line @typescript-eslint/no-require-imports  
  const { ModuleName } = require('@/modules/types/index');
  
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const moduleLoader = getModuleLoader();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const ${camelName}Module = moduleLoader.getModule(ModuleName.${upperName});
  
  // Validate the module has expected structure
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (!${camelName}Module.exports?.service || typeof ${camelName}Module.exports.service !== 'function') {
    throw new Error('${pascalName} module missing required service export');
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return ${camelName}Module as IModule<I${pascalName}ModuleExports>;
}

// Re-export types and enums for convenience
export * from '@/modules/${modulePrefix}/${options.name}/types/index';
`;
  }

  private generateModuleYaml(options: IModuleGeneratorOptions): string {
    const yaml = {
      name: options.name,
      version: '1.0.0',
      description: options.description,
      type: options.type,
      status: 'active',
      dependencies: options.dependencies,
      exports: ['service']
    };

    if (options.needsCli) {
      (yaml as any).cli = {
        commands: [options.name]
      };
    }

    if (options.needsDatabase) {
      (yaml as any).database = {
        tables: [`${options.name}s`]
      };
    }

    (yaml as any).configuration = {
      schema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true
          }
        }
      }
    };

    return `name: ${yaml.name}
version: ${yaml.version}
description: ${yaml.description}
type: ${yaml.type}
status: ${yaml.status}
dependencies:
${yaml.dependencies.map(dep => { return `  - ${dep}` }).join('\n')}
exports:
${yaml.exports.map(exp => { return `  - ${exp}` }).join('\n')}${options.needsCli ? `
cli:
  commands:
    - ${options.name}` : ''}${options.needsDatabase ? `
database:
  tables:
    - ${options.name}s` : ''}
configuration:
  schema:
    type: object
    properties:
      enabled:
        type: boolean
        default: true
`;
  }

  private generateTypesTemplate(options: IModuleGeneratorOptions, pascalName: string): string {
    const modulePrefix = options.isCustom ? 'custom' : 'core';

    return `/**
 * Type definitions for ${options.name} module.
 *
 * @module modules/${modulePrefix}/${options.name}/types
 */

/**
 * ${pascalName} entity interface.
 */
export interface ${pascalName} {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create ${pascalName} DTO.
 */
export interface Create${pascalName}Dto {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Update ${pascalName} DTO.
 */
export interface Update${pascalName}Dto {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * ${pascalName} service interface.
 */
export interface I${pascalName}Service {
  initialize(): Promise<void>;
  create(data: Create${pascalName}Dto): Promise<${pascalName}>;
  getById(id: string): Promise<${pascalName} | null>;
  getAll(): Promise<${pascalName}[]>;
  update(id: string, data: Update${pascalName}Dto): Promise<${pascalName}>;
  delete(id: string): Promise<void>;
}

/**
 * ${pascalName} repository interface.
 */
export interface I${pascalName}Repository {
  initialize(): Promise<void>;
  create(data: Create${pascalName}Dto): Promise<${pascalName}>;
  findById(id: string): Promise<${pascalName} | null>;
  findAll(): Promise<${pascalName}[]>;
  update(id: string, data: Update${pascalName}Dto): Promise<${pascalName}>;
  delete(id: string): Promise<void>;
}
`;
  }

  private generateServiceTemplate(options: IModuleGeneratorOptions, pascalName: string, camelName: string): string {
    const modulePrefix = options.isCustom ? 'custom' : 'core';

    return `/**
 * ${pascalName} service implementation.
 *
 * @file ${pascalName} service implementation.
 * @module modules/${modulePrefix}/${options.name}/services
 */

import type { 
  I${pascalName}Service, 
  ${pascalName}, 
  Create${pascalName}Dto, 
  Update${pascalName}Dto 
} from '@/modules/${modulePrefix}/${options.name}/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { ${pascalName}Repository } from '@/modules/${modulePrefix}/${options.name}/repositories/${options.name}.repository';
import type { I${pascalName}Repository } from '@/modules/${modulePrefix}/${options.name}/types/index';
import { ${pascalName}NotFoundError, ${pascalName}ValidationError } from '@/modules/${modulePrefix}/${options.name}/errors/index';

/**
 * ${pascalName} service implementation.
 */
export class ${pascalName}Service implements I${pascalName}Service {
  private static instance: ${pascalName}Service;
  private logger!: ILogger;
  private repository!: I${pascalName}Repository;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   *
   * @returns ${pascalName}Service instance.
   */
  public static getInstance(): ${pascalName}Service {
    if (!${pascalName}Service.instance) {
      ${pascalName}Service.instance = new ${pascalName}Service();
    }
    return ${pascalName}Service.instance;
  }

  /**
   * Initialize the service.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger = LoggerService.getInstance();
    this.repository = ${pascalName}Repository.getInstance();
    await this.repository.initialize();

    this.initialized = true;
    this.logger.info(LogSource.MODULES, '${pascalName}Service initialized');
  }

  /**
   * Create a new ${camelName}.
   *
   * @param data - Creation data.
   * @returns Created ${camelName}.
   */
  async create(data: Create${pascalName}Dto): Promise<${pascalName}> {
    this.ensureInitialized();
    
    // Validate input
    if (!data.name || data.name.trim().length === 0) {
      throw new ${pascalName}ValidationError('Name is required');
    }

    try {
      const result = await this.repository.create(data);
      this.logger.info(LogSource.MODULES, \`Created ${options.name}: \${result.id}\`);
      return result;
    } catch (error) {
      this.logger.error(LogSource.MODULES, 'Failed to create ${options.name}', { error });
      throw error;
    }
  }

  /**
   * Get ${camelName} by ID.
   *
   * @param id - ${pascalName} ID.
   * @returns ${pascalName} or null if not found.
   */
  async getById(id: string): Promise<${pascalName} | null> {
    this.ensureInitialized();
    return await this.repository.findById(id);
  }

  /**
   * Get all ${camelName}s.
   *
   * @returns Array of ${camelName}s.
   */
  async getAll(): Promise<${pascalName}[]> {
    this.ensureInitialized();
    return await this.repository.findAll();
  }

  /**
   * Update a ${camelName}.
   *
   * @param id - ${pascalName} ID.
   * @param data - Update data.
   * @returns Updated ${camelName}.
   */
  async update(id: string, data: Update${pascalName}Dto): Promise<${pascalName}> {
    this.ensureInitialized();
    
    const existing = await this.repository.findById(id);
    if (existing === null) {
      throw new ${pascalName}NotFoundError(id);
    }

    // Validate update data
    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new ${pascalName}ValidationError('Name cannot be empty');
    }

    return await this.repository.update(id, data);
  }

  /**
   * Delete a ${camelName}.
   *
   * @param id - ${pascalName} ID.
   */
  async delete(id: string): Promise<void> {
    this.ensureInitialized();
    
    const existing = await this.repository.findById(id);
    if (existing === null) {
      throw new ${pascalName}NotFoundError(id);
    }

    await this.repository.delete(id);
    this.logger.info(LogSource.MODULES, \`Deleted ${options.name}: \${id}\`);
  }

  /**
   * Ensure service is initialized.
   *
   * @throws {Error} When service is not initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('${pascalName}Service not initialized');
    }
  }
}
`;
  }

  private generateSchemaTemplate(options: IModuleGeneratorOptions): string {
    return `-- ${options.name} module schema
-- Description: ${options.description}

-- Main ${options.name} table
CREATE TABLE IF NOT EXISTS ${options.name}s (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  metadata JSON DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_${options.name}s_name ON ${options.name}s(name);
CREATE INDEX idx_${options.name}s_created_at ON ${options.name}s(created_at);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER update_${options.name}s_updated_at
AFTER UPDATE ON ${options.name}s
BEGIN
  UPDATE ${options.name}s SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`;
  }

  private generateRepositoryTemplate(options: IModuleGeneratorOptions, pascalName: string, camelName: string): string {
    const {needsDatabase} = options;
    const modulePrefix = options.isCustom ? 'custom' : 'core';

    return `/**
 * ${pascalName} repository implementation.
 *
 * @file ${pascalName} repository implementation.
 * @module modules/${modulePrefix}/${options.name}/repositories
 */

import type { 
  I${pascalName}Repository, 
  ${pascalName}, 
  Create${pascalName}Dto, 
  Update${pascalName}Dto 
} from '@/modules/${modulePrefix}/${options.name}/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
${needsDatabase ? `import { DatabaseService } from '@/modules/core/database/services/database.service';
import { DatabaseServiceAdapter } from '@/modules/core/database/adapters/database-service-adapter';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';` : ''}

/**
 * ${pascalName} repository implementation.
 */
export class ${pascalName}Repository implements I${pascalName}Repository {
  private static instance: ${pascalName}Repository;
  private logger!: ILogger;
  ${needsDatabase ? 'private db!: IDatabaseConnection;' : ''}
  private initialized = false;
  ${!needsDatabase ? `private readonly storage: Map<string, ${pascalName}> = new Map();` : ''}

  /**
   * Private constructor for singleton.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   *
   * @returns ${pascalName}Repository instance.
   */
  public static getInstance(): ${pascalName}Repository {
    if (!${pascalName}Repository.instance) {
      ${pascalName}Repository.instance = new ${pascalName}Repository();
    }
    return ${pascalName}Repository.instance;
  }

  /**
   * Initialize the repository.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger = LoggerService.getInstance();
    ${needsDatabase ? `const databaseService = DatabaseService.getInstance();
    this.db = new DatabaseServiceAdapter(databaseService);` : ''}
    
    this.initialized = true;
    this.logger.info(LogSource.MODULES, '${pascalName}Repository initialized');
  }

  /**
   * Create a new ${camelName}.
   *
   * @param data - Creation data.
   * @returns Created ${camelName}.
   */
  async create(data: Create${pascalName}Dto): Promise<${pascalName}> {
    this.ensureInitialized();
    
    ${needsDatabase ? `await this.db.execute(
      'INSERT INTO ${options.name}s (name, description, metadata) VALUES (?, ?, ?)',
      [data.name, data.description ?? null, JSON.stringify(data.metadata ?? {})]
    );

    const result = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM ${options.name}s WHERE id = last_insert_rowid()',
      []
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create ${options.name}');
    }

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to retrieve created ${options.name}');
    }

    return this.mapDbRow(row);` : `const id = this.generateId();
    const now = new Date();
    const ${camelName}: ${pascalName} = {
      id,
      name: data.name,
      description: data.description,
      metadata: data.metadata ?? {},
      createdAt: now,
      updatedAt: now
    };
    
    this.storage.set(id, ${camelName});
    return ${camelName};`}
  }

  /**
   * Find ${camelName} by ID.
   *
   * @param id - ${pascalName} ID.
   * @returns ${pascalName} or null if not found.
   */
  async findById(id: string): Promise<${pascalName} | null> {
    this.ensureInitialized();
    
    ${needsDatabase ? `const result = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM ${options.name}s WHERE id = ?',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.mapDbRow(row);` : `return this.storage.get(id) ?? null;`}
  }

  /**
   * Find all ${camelName}s.
   *
   * @returns Array of ${camelName}s.
   */
  async findAll(): Promise<${pascalName}[]> {
    this.ensureInitialized();
    
    ${needsDatabase ? `const results = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM ${options.name}s ORDER BY created_at DESC',
      []
    );

    return results.rows.map((row): ${pascalName} => this.mapDbRow(row));` : `return Array.from(this.storage.values())
      .sort((a, b): number => b.createdAt.getTime() - a.createdAt.getTime());`}
  }

  /**
   * Update a ${camelName}.
   *
   * @param id - ${pascalName} ID.
   * @param data - Update data.
   * @returns Updated ${camelName}.
   * @throws {Error} When ${camelName} not found or update fails.
   */
  async update(id: string, data: Update${pascalName}Dto): Promise<${pascalName}> {
    this.ensureInitialized();
    
    ${needsDatabase ? `const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }

    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (existing === null) {
        throw new Error('${pascalName} not found');
      }
      return existing;
    }

    values.push(id);
    await this.db.execute(
      \`UPDATE ${options.name}s SET \${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?\`,
      values
    );

    const result = await this.findById(id);
    if (result === null) {
      throw new Error('Failed to update ${options.name}');
    }

    return result;` : `const existing = this.storage.get(id);
    if (!existing) {
      throw new Error('${pascalName} not found');
    }

    const updated: ${pascalName} = {
      ...existing,
      ...data,
      updatedAt: new Date()
    };

    this.storage.set(id, updated);
    return updated;`}
  }

  /**
   * Delete a ${camelName}.
   *
   * @param id - ${pascalName} ID.
   */
  async delete(id: string): Promise<void> {
    this.ensureInitialized();
    
    ${needsDatabase ? `await this.db.execute(
      'DELETE FROM ${options.name}s WHERE id = ?',
      [id]
    );` : `this.storage.delete(id);`}
  }

  /**
   * Ensure repository is initialized.
   *
   * @throws {Error} When repository is not initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('${pascalName}Repository not initialized');
    }
  }

  ${needsDatabase ? `/**
   * Map database row to ${pascalName} entity.
   *
   * @param row - Database row.
   * @returns ${pascalName} entity.
   */
  private mapDbRow(row: Record<string, unknown>): ${pascalName} {
    return {
      id: String(row.id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      metadata: typeof row.metadata === 'string' ? 
        JSON.parse(row.metadata) as Record<string, unknown> : 
        row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at))
    };
  }` : `/**
   * Generate a unique ID.
   *
   * @returns Unique ID.
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }`}
}
`;
  }

  private generateErrorsTemplate(options: IModuleGeneratorOptions, pascalName: string): string {
    const modulePrefix = options.isCustom ? 'custom' : 'core';

    return `/**
 * Custom error classes for ${options.name} module.
 *
 * @file Custom error classes for ${options.name} module.
 * @module modules/${modulePrefix}/${options.name}/errors
 */

/**
 * Base error class for ${options.name} module.
 */
export class ${pascalName}Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = '${pascalName}Error';
  }
}

/**
 * Error thrown when ${options.name} is not found.
 */
export class ${pascalName}NotFoundError extends ${pascalName}Error {
  constructor(id: string) {
    super(\`${pascalName} not found: \${id}\`);
    this.name = '${pascalName}NotFoundError';
  }
}

/**
 * Error thrown when ${options.name} validation fails.
 */
export class ${pascalName}ValidationError extends ${pascalName}Error {
  constructor(message: string) {
    super(\`Validation error: \${message}\`);
    this.name = '${pascalName}ValidationError';
  }
}

/**
 * Error thrown when ${options.name} operation is unauthorized.
 */
export class ${pascalName}UnauthorizedError extends ${pascalName}Error {
  constructor(operation: string) {
    super(\`Unauthorized operation: \${operation}\`);
    this.name = '${pascalName}UnauthorizedError';
  }
}
`;
  }

  private generateCliIndexTemplate(options: IModuleGeneratorOptions, pascalName: string): string {
    const modulePrefix = options.isCustom ? 'custom' : 'core';

    return `/**
 * ${pascalName} CLI commands.
 *
 * @file ${pascalName} CLI commands.
 * @module modules/${modulePrefix}/${options.name}/cli
 */

import { Command } from 'commander';
import { CliFormatterService } from '@/modules/core/cli/services/cli-formatter.service';

// Import subcommands
import { createListCommand } from '@/modules/${modulePrefix}/${options.name}/cli/list';
import { createCreateCommand } from '@/modules/${modulePrefix}/${options.name}/cli/create';

/**
 * Create ${options.name} command with subcommands.
 *
 * @returns Commander command instance.
 */
export function create${pascalName}Command(): Command {
  const formatter = CliFormatterService.getInstance();
  const command = new Command('${options.name}')
    .description('${options.description}');

  formatter.enhanceCommand(command, {
    icon: '📦',
    category: 'Services',
    priority: 10
  });

  command.addCommand(createListCommand());
  command.addCommand(createCreateCommand());

  command.configureHelp({
    formatHelp: (cmd): string => formatter.formatHelp(cmd, false)
  });

  return command;
}

// Export for CLI registration
export const command = create${pascalName}Command();
`;
  }

  private generateCliListTemplate(options: IModuleGeneratorOptions, pascalName: string): string {
    const modulePrefix = options.isCustom ? 'custom' : 'core';

    return `/**
 * List command for ${options.name} module.
 *
 * @file List command for ${options.name} module.
 * @module modules/${modulePrefix}/${options.name}/cli
 */

import { Command } from 'commander';
import { CliFormatterService } from '@/modules/core/cli/services/cli-formatter.service';
import { get${pascalName}Module } from '@/modules/${modulePrefix}/${options.name}/index';
import Table from 'cli-table3';

/**
 * Create list command.
 *
 * @returns Commander command instance.
 */
export function createListCommand(): Command {
  const formatter = CliFormatterService.getInstance();
  const command = new Command('list')
    .description('List all ${options.name}s')
    .option('-l, --limit <number>', 'Limit number of results', '50')
    .option('-s, --sort <field>', 'Sort by field (name, created)', 'created');

  command.action(async (commandOptions): Promise<void> => {
    const progress = formatter.createProgressLogger('loading', 'Loading ${options.name}s...');
    progress.start();

    try {
      const module = get${pascalName}Module();
      const items = await module.exports.service().getAll();
      
      progress.succeed(\`Found \${items.length} ${options.name}s\`);
      
      if (items.length === 0) {
        // eslint-disable-next-line no-console
        console.log(formatter.formatInfo('No ${options.name}s found'));
        return;
      }

      const sorted = [...items].sort((a, b): number => {
        if (commandOptions.sort === 'name') {
          return a.name.localeCompare(b.name);
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const limited = sorted.slice(0, parseInt(commandOptions.limit, 10));

      const table = new Table({
        head: ['ID', 'Name', 'Description', 'Created'],
        style: { head: ['cyan'] },
        wordWrap: true,
        colWidths: [38, 25, 40, 20]
      });

      limited.forEach((item): void => {
        table.push([
          item.id,
          item.name,
          item.description ?? '-',
          item.createdAt.toLocaleString()
        ]);
      });

      // eslint-disable-next-line no-console
      console.log(table.toString());
      
      if (limited.length < items.length) {
        // eslint-disable-next-line no-console
        console.log(formatter.formatInfo(\`Showing \${limited.length} of \${items.length} items\`));
      }
    } catch (error) {
      progress.fail('Failed to load ${options.name}s');
      // eslint-disable-next-line no-console
      console.error(formatter.formatError(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

  return command;
}
`;
  }

  private generateCliCreateTemplate(options: IModuleGeneratorOptions, pascalName: string): string {
    const modulePrefix = options.isCustom ? 'custom' : 'core';

    return `/**
 * Create command for ${options.name} module.
 *
 * @file Create command for ${options.name} module.
 * @module modules/${modulePrefix}/${options.name}/cli
 */

import { Command } from 'commander';
import { CliFormatterService } from '@/modules/core/cli/services/cli-formatter.service';
import { get${pascalName}Module } from '@/modules/${modulePrefix}/${options.name}/index';
import inquirer from 'inquirer';

/**
 * Create create command.
 *
 * @returns Commander command instance.
 */
export function createCreateCommand(): Command {
  const formatter = CliFormatterService.getInstance();
  const command = new Command('create')
    .description('Create a new ${options.name}')
    .argument('[name]', 'Name of the ${options.name}')
    .option('-d, --description <desc>', 'Description')
    .option('-m, --metadata <json>', 'Metadata as JSON');

  command.action(async (name, commandOptions): Promise<void> => {
    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '${pascalName} name:',
          when: !name,
          validate: (input): string | boolean => input.trim().length > 0 || 'Name is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description (optional):',
          when: !commandOptions.description
        }
      ]);

      const finalName = name ?? answers.name;
      const finalDescription = commandOptions.description ?? answers.description;
      
      const progress = formatter.createProgressLogger('processing', \`Creating ${options.name} "\${finalName}"...\`);
      progress.start();

      const module = get${pascalName}Module();
      const data = {
        name: finalName,
        description: finalDescription,
        metadata: commandOptions.metadata ? JSON.parse(commandOptions.metadata) as Record<string, unknown> : undefined
      };

      const result = await module.exports.service().create(data);
      
      progress.succeed(\`Created ${options.name} with ID: \${result.id}\`);
      // eslint-disable-next-line no-console
      console.log(formatter.formatSuccess('Successfully created ${options.name}'));
      
      // eslint-disable-next-line no-console
      console.log('\\nCreated ${options.name}:');
      // eslint-disable-next-line no-console
      console.log(\`  ID: \${formatter.highlight(result.id)}\`);
      // eslint-disable-next-line no-console
      console.log(\`  Name: \${result.name}\`);
      if (result.description) {
        // eslint-disable-next-line no-console
        console.log(\`  Description: \${result.description}\`);
      }
      // eslint-disable-next-line no-console
      console.log(\`  Created: \${result.createdAt.toLocaleString()}\`);
      
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(formatter.formatError(\`Failed to create ${options.name}: \${error instanceof Error ? error.message : String(error)}\`));
      process.exit(1);
    }
  });

  return command;
}
`;
  }

  private generateUnitTestTemplate(options: IModuleGeneratorOptions, pascalName: string): string {
    return `/**
 * @file Unit tests for ${options.name} module.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ${pascalName}Module } from '@/modules/core/${options.name}/index';
import { ${pascalName}Service } from '@/modules/core/${options.name}/services/${options.name}.service';
import { ${pascalName}Repository } from '@/modules/core/${options.name}/repositories/${options.name}.repository';

// Mock dependencies
vi.mock('@/modules/core/logger/services/logger.service', () => ({
  LoggerService: {
    getInstance: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    })
  }
}));

${options.needsDatabase ? `vi.mock('@/modules/core/database/index', () => ({
  getDatabaseModule: () => ({
    exports: {
      service: () => ({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn()
      })
    }
  })
}));` : ''}

describe('${pascalName} Module', () => {
  let module: ${pascalName}Module;

  beforeEach(() => {
    // Clear singletons
    vi.clearAllMocks();
    (${pascalName}Service as any).instance = undefined;
    (${pascalName}Repository as any).instance = undefined;
    
    module = new ${pascalName}Module();
  });

  describe('Module Lifecycle', () => {
    it('should initialize successfully', async () => {
      await expect(module.initialize()).resolves.not.toThrow();
      expect(module.status).toBe('stopped');
    });

    it('should start successfully after initialization', async () => {
      await module.initialize();
      await expect(module.start()).resolves.not.toThrow();
      expect(module.status).toBe('running');
    });

    it('should throw error when starting without initialization', async () => {
      await expect(module.start()).rejects.toThrow('${pascalName} module not initialized');
    });

    it('should stop successfully after starting', async () => {
      await module.initialize();
      await module.start();
      await expect(module.stop()).resolves.not.toThrow();
      expect(module.status).toBe('stopped');
    });

    it('should provide health check status', async () => {
      // Not initialized
      let health = await module.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.message).toContain('not initialized');

      // Initialized but not started
      await module.initialize();
      health = await module.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.message).toContain('not started');

      // Started
      await module.start();
      health = await module.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.message).toContain('healthy');
    });
  });

  describe('Module Exports', () => {
    it('should expose service through exports', async () => {
      await module.initialize();
      
      const exports = module.exports;
      expect(exports.service).toBeDefined();
      expect(typeof exports.service).toBe('function');
      
      const service = exports.service();
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(${pascalName}Service);
    });

    it('should throw error when accessing service before initialization', () => {
      const exports = module.exports;
      expect(() => exports.service()).toThrow('${pascalName} module not initialized');
    });
  });

  describe('${pascalName} Service', () => {
    let service: ${pascalName}Service;

    beforeEach(async () => {
      service = ${pascalName}Service.getInstance();
      await service.initialize();
    });

    it('should create a new ${options.name}', async () => {
      const mockResult = {
        id: 'test-id',
        name: 'Test ${pascalName}',
        description: 'Test description',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const repository = ${pascalName}Repository.getInstance();
      vi.spyOn(repository, 'create').mockResolvedValue(mockResult);

      const result = await service.create({
        name: 'Test ${pascalName}',
        description: 'Test description'
      });

      expect(result).toEqual(mockResult);
    });

    it('should validate required fields on create', async () => {
      await expect(service.create({ name: '' })).rejects.toThrow('Name is required');
    });

    it('should get ${options.name} by ID', async () => {
      const mockResult = {
        id: 'test-id',
        name: 'Test ${pascalName}',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const repository = ${pascalName}Repository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(mockResult as any);

      const result = await service.getById('test-id');
      expect(result).toEqual(mockResult);
    });

    it('should get all ${options.name}s', async () => {
      const mockResults = [
        {
          id: 'test-1',
          name: 'Test 1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'test-2',
          name: 'Test 2',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const repository = ${pascalName}Repository.getInstance();
      vi.spyOn(repository, 'findAll').mockResolvedValue(mockResults as any);

      const results = await service.getAll();
      expect(results).toHaveLength(2);
      expect(results).toEqual(mockResults);
    });

    it('should update ${options.name}', async () => {
      const existing = {
        id: 'test-id',
        name: 'Original Name',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updated = {
        ...existing,
        name: 'Updated Name',
        updatedAt: new Date()
      };

      const repository = ${pascalName}Repository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(existing as any);
      vi.spyOn(repository, 'update').mockResolvedValue(updated as any);

      const result = await service.update('test-id', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw error when updating non-existent ${options.name}', async () => {
      const repository = ${pascalName}Repository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'Test' }))
        .rejects.toThrow('${pascalName} not found');
    });

    it('should delete ${options.name}', async () => {
      const existing = {
        id: 'test-id',
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const repository = ${pascalName}Repository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(existing as any);
      vi.spyOn(repository, 'delete').mockResolvedValue(undefined);

      await expect(service.delete('test-id')).resolves.not.toThrow();
    });

    it('should throw error when deleting non-existent ${options.name}', async () => {
      const repository = ${pascalName}Repository.getInstance();
      vi.spyOn(repository, 'findById').mockResolvedValue(null);

      await expect(service.delete('non-existent'))
        .rejects.toThrow('${pascalName} not found');
    });
  });
});
`;
  }

  private generateE2ETestTemplate(options: IModuleGeneratorOptions, pascalName: string): string {
    return `/**
 * @file E2E tests for ${options.name} module.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('${pascalName} Module E2E Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../bin/systemprompt');
  let createdId: string;

  beforeAll(() => {
    // Ensure clean state - delete all ${options.name}s
    try {
      const listOutput = execSync(\`\${CLI_PATH} ${options.name} list\`, { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      // Extract IDs from output and delete each one
      const idMatches = listOutput.matchAll(/([a-f0-9]{32})/g);
      for (const match of idMatches) {
        try {
          execSync(\`\${CLI_PATH} ${options.name} delete \${match[1]}\`, {
            encoding: 'utf8',
            stdio: 'pipe'
          });
        } catch {
          // Ignore errors during cleanup
        }
      }
    } catch {
      // List might fail if no items exist, which is fine
    }
  });

  afterAll(() => {
    // Cleanup created test data
    if (createdId) {
      try {
        execSync(\`\${CLI_PATH} ${options.name} delete \${createdId}\`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should display help for ${options.name} command', () => {
    const output = execSync(\`\${CLI_PATH} ${options.name} --help\`, {
      encoding: 'utf8'
    });

    expect(output).toContain('${options.name}');
    expect(output).toContain('${options.description}');
    expect(output).toContain('list');
    expect(output).toContain('create');
    expect(output).toContain('Commands:');
  });

  it('should list ${options.name}s (initially empty)', () => {
    const output = execSync(\`\${CLI_PATH} ${options.name} list\`, {
      encoding: 'utf8'
    });

    expect(output).toContain('No ${options.name}s found');
  });

  it('should create a new ${options.name}', () => {
    const output = execSync(\`\${CLI_PATH} ${options.name} create "Test ${pascalName}" -d "Test description"\`, {
      encoding: 'utf8'
    });

    expect(output).toContain('Successfully created ${options.name}');
    expect(output).toContain('Created ${options.name}:');
    expect(output).toContain('Test ${pascalName}');
    expect(output).toContain('Test description');
    
    // Extract ID from output
    const idMatch = output.match(/ID: ([a-f0-9]+)/);
    expect(idMatch).toBeTruthy();
    createdId = idMatch![1];
  });

  it('should list ${options.name}s after creation', () => {
    const output = execSync(\`\${CLI_PATH} ${options.name} list\`, {
      encoding: 'utf8'
    });

    expect(output).toContain('Found 1 ${options.name}s');
    expect(output).toContain('Test ${pascalName}');
    expect(output).toContain('Test description');
    expect(output).toContain(createdId);
  });

  it('should handle list command with options', () => {
    // Create another item for testing
    const createOutput = execSync(\`\${CLI_PATH} ${options.name} create "Another ${pascalName}"\`, {
      encoding: 'utf8'
    });
    const anotherIdMatch = createOutput.match(/ID: ([a-f0-9]+)/);
    const anotherId = anotherIdMatch![1];

    try {
      // Test with limit
      const limitOutput = execSync(\`\${CLI_PATH} ${options.name} list --limit 1\`, {
        encoding: 'utf8'
      });
      expect(limitOutput).toContain('Showing 1 of 2 items');

      // Test with sort
      const sortOutput = execSync(\`\${CLI_PATH} ${options.name} list --sort name\`, {
        encoding: 'utf8'
      });
      expect(sortOutput).toContain('Another ${pascalName}');
      expect(sortOutput).toContain('Test ${pascalName}');

      // Cleanup
      execSync(\`\${CLI_PATH} ${options.name} delete \${anotherId}\`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (error) {
      // Cleanup on error
      try {
        execSync(\`\${CLI_PATH} ${options.name} delete \${anotherId}\`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch {}
      throw error;
    }
  });

  it('should handle create command with metadata', () => {
    const metadata = { key: 'value', number: 42 };
    const output = execSync(
      \`\${CLI_PATH} ${options.name} create "With Metadata" --metadata '\${JSON.stringify(metadata)}'\`,
      {
        encoding: 'utf8'
      }
    );

    expect(output).toContain('Successfully created ${options.name}');
    expect(output).toContain('With Metadata');

    // Extract and cleanup
    const idMatch = output.match(/ID: ([a-f0-9]+)/);
    if (idMatch) {
      execSync(\`\${CLI_PATH} ${options.name} delete \${idMatch[1]}\`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    }
  });

  it('should handle errors gracefully', () => {
    // Test creating with empty name
    let error: any;
    try {
      execSync(\`\${CLI_PATH} ${options.name} create ""\`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(1);
    expect(error.stderr || error.stdout).toContain('Failed to create ${options.name}');
  });

  it('should handle missing subcommand', () => {
    const output = execSync(\`\${CLI_PATH} ${options.name}\`, {
      encoding: 'utf8'
    });

    // Should show help when no subcommand is provided
    expect(output).toContain('Commands:');
    expect(output).toContain('list');
    expect(output).toContain('create');
  });
});
`;
  }

  // Helper methods
  private toPascalCase(str: string): string {
    return str
      .split('-')
      .map(word => { return word.charAt(0).toUpperCase() + word.slice(1) })
      .join('');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}
