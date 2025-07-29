# Module Creator Agent

The Module Creator agent helps you create fully functional SystemPrompt OS modules with proper structure, database integration, CLI commands, and comprehensive testing.

## Core Competencies

- Creates complete module structure following SystemPrompt OS patterns
- Generates database schemas with proper migrations
- Implements CLI commands with proper formatting
- Ensures TypeScript type safety
- Validates ESLint compliance
- Creates comprehensive E2E tests
- Provides working boilerplate code

## Usage

This agent is invoked when you need to create a new module for SystemPrompt OS. It will:

1. Ask for module specifications
2. Generate complete module structure
3. Create all necessary files
4. Implement basic functionality
5. Add proper CLI integration
6. Create database schema if needed
7. Generate tests
8. Validate everything works

## Module Creation Process

### Step 1: Gather Requirements

The agent will ask for:
- Module name (e.g., "notifications", "analytics")
- Module type (service, utility, integration)
- Description of functionality
- Whether it needs database tables
- CLI commands required
- Dependencies on other modules

### Step 2: Generate Module Structure

Creates the following structure:
```
src/modules/core/{moduleName}/
├── index.ts                    # Module entry point
├── module.yaml                 # Module metadata
├── types/
│   └── index.ts               # Type definitions
├── services/
│   └── {moduleName}.service.ts # Main service
├── database/
│   ├── schema.sql             # Database schema
│   └── migrations/            # Migration files
├── repositories/
│   └── {moduleName}.repository.ts # Data access layer
├── cli/
│   ├── index.ts              # CLI command entry
│   └── {subcommands}.ts      # Individual commands
└── errors/
    └── index.ts              # Custom error classes
```

### Step 3: Implement Core Components

#### Module Index (index.ts)
```typescript
/**
 * {ModuleName} module for {description}
 * @file {ModuleName} module entry point.
 * @module modules/core/{moduleName}
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { ModuleStatusEnum } from '@/modules/core/modules/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { {ModuleName}Service } from '@/modules/core/{moduleName}/services/{moduleName}.service';
import type { I{ModuleName}Service } from '@/modules/core/{moduleName}/types/index';

export interface I{ModuleName}ModuleExports {
  readonly service: () => I{ModuleName}Service;
  // Add other exports as needed
}

export class {ModuleName}Module implements IModule<I{ModuleName}ModuleExports> {
  public readonly name = '{moduleName}';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = '{description}';
  public readonly dependencies = ['logger', 'database'];
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private {moduleName}Service!: I{ModuleName}Service;
  private logger!: ILogger;
  private initialized = false;
  private started = false;

  get exports(): I{ModuleName}ModuleExports {
    return {
      service: () => this.getService(),
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('{ModuleName} module already initialized');
    }

    this.logger = LoggerService.getInstance();
    
    try {
      this.{moduleName}Service = {ModuleName}Service.getInstance();
      await this.{moduleName}Service.initialize();
      
      this.initialized = true;
      this.logger.info(LogSource.MODULE, '{ModuleName} module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize {moduleName} module: ${errorMessage}`);
    }
  }

  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('{ModuleName} module not initialized');
    }

    if (this.started) {
      throw new Error('{ModuleName} module already started');
    }

    this.status = ModuleStatusEnum.RUNNING;
    this.started = true;
    this.logger.info(LogSource.MODULE, '{ModuleName} module started');
  }

  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModuleStatusEnum.STOPPED;
      this.started = false;
      this.logger.info(LogSource.MODULE, '{ModuleName} module stopped');
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: '{ModuleName} module not initialized'
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: '{ModuleName} module not started'
      };
    }
    return {
      healthy: true,
      message: '{ModuleName} module is healthy'
    };
  }

  private getService(): I{ModuleName}Service {
    if (!this.initialized) {
      throw new Error('{ModuleName} module not initialized');
    }
    return this.{moduleName}Service;
  }
}

export function createModule(): {ModuleName}Module {
  return new {ModuleName}Module();
}

export async function initialize(): Promise<{ModuleName}Module> {
  const {moduleName}Module = new {ModuleName}Module();
  await {moduleName}Module.initialize();
  return {moduleName}Module;
}

export function get{ModuleName}Module(): IModule<I{ModuleName}ModuleExports> {
  const { getModuleLoader } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/index');
  
  const moduleLoader = getModuleLoader();
  const {moduleName}Module = moduleLoader.getModule(ModuleName.{MODULE_NAME});
  
  if (!{moduleName}Module.exports?.service || typeof {moduleName}Module.exports.service !== 'function') {
    throw new Error('{ModuleName} module missing required service export');
  }
  
  return {moduleName}Module as IModule<I{ModuleName}ModuleExports>;
}

export * from '@/modules/core/{moduleName}/types/index';
```

#### Module YAML (module.yaml)
```yaml
name: {moduleName}
version: 1.0.0
description: {description}
type: service
status: active
dependencies:
  - logger
  - database
exports:
  - service
cli:
  commands:
    - {moduleName}
database:
  tables:
    - {moduleName}s
configuration:
  schema:
    type: object
    properties:
      enabled:
        type: boolean
        default: true
```

#### Service Implementation
```typescript
/**
 * @file {ModuleName} service implementation.
 * @module modules/core/{moduleName}/services
 */

import type { I{ModuleName}Service, {ModuleName}Config } from '@/modules/core/{moduleName}/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { {ModuleName}Repository } from '@/modules/core/{moduleName}/repositories/{moduleName}.repository';
import type { I{ModuleName}Repository } from '@/modules/core/{moduleName}/types/index';

export class {ModuleName}Service implements I{ModuleName}Service {
  private static instance: {ModuleName}Service;
  private logger!: ILogger;
  private repository!: I{ModuleName}Repository;
  private initialized = false;

  public static getInstance(): {ModuleName}Service {
    {ModuleName}Service.instance ||= new {ModuleName}Service();
    return {ModuleName}Service.instance;
  }

  private constructor() {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger = LoggerService.getInstance();
    this.repository = {ModuleName}Repository.getInstance();
    await this.repository.initialize();

    this.initialized = true;
    this.logger.info(LogSource.MODULE, '{ModuleName}Service initialized');
  }

  async create(data: Create{ModuleName}Dto): Promise<{ModuleName}> {
    this.ensureInitialized();
    
    try {
      const result = await this.repository.create(data);
      this.logger.info(LogSource.MODULE, `Created {moduleName}: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(LogSource.MODULE, 'Failed to create {moduleName}', { error });
      throw error;
    }
  }

  async getById(id: string): Promise<{ModuleName} | null> {
    this.ensureInitialized();
    return await this.repository.findById(id);
  }

  async getAll(): Promise<{ModuleName}[]> {
    this.ensureInitialized();
    return await this.repository.findAll();
  }

  async update(id: string, data: Update{ModuleName}Dto): Promise<{ModuleName}> {
    this.ensureInitialized();
    
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`{ModuleName} not found: ${id}`);
    }

    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    this.ensureInitialized();
    await this.repository.delete(id);
    this.logger.info(LogSource.MODULE, `Deleted {moduleName}: ${id}`);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('{ModuleName}Service not initialized');
    }
  }
}
```

#### CLI Command Implementation
```typescript
/**
 * @file {ModuleName} CLI commands.
 * @module modules/core/{moduleName}/cli
 */

import { Command } from 'commander';
import { CliFormatterService } from '@/modules/core/cli/services/cli-formatter.service';
import { get{ModuleName}Module } from '@/modules/core/{moduleName}/index';

export function create{ModuleName}Command(): Command {
  const formatter = CliFormatterService.getInstance();
  const command = new Command('{moduleName}')
    .description('{description}');

  formatter.enhanceCommand(command, {
    icon: '📦',
    category: 'Services',
    priority: 10
  });

  // List command
  command
    .command('list')
    .description('List all {moduleName}s')
    .action(async () => {
      const progress = formatter.createProgressLogger('loading', 'Loading {moduleName}s...');
      progress.start();

      try {
        const module = get{ModuleName}Module();
        const items = await module.exports.service().getAll();
        
        progress.succeed(`Found ${items.length} {moduleName}s`);
        
        if (items.length === 0) {
          console.log(formatter.formatInfo('No {moduleName}s found'));
          return;
        }

        // Display results in a table
        const Table = require('cli-table3');
        const table = new Table({
          head: ['ID', 'Name', 'Created'],
          style: { head: ['cyan'] }
        });

        items.forEach(item => {
          table.push([item.id, item.name, item.createdAt]);
        });

        console.log(table.toString());
      } catch (error) {
        progress.fail('Failed to load {moduleName}s');
        console.error(formatter.formatError(error.message));
        process.exit(1);
      }
    });

  // Create command
  command
    .command('create <name>')
    .description('Create a new {moduleName}')
    .action(async (name: string) => {
      const progress = formatter.createProgressLogger('creating', `Creating {moduleName} "${name}"...`);
      progress.start();

      try {
        const module = get{ModuleName}Module();
        const result = await module.exports.service().create({ name });
        
        progress.succeed(`Created {moduleName} with ID: ${result.id}`);
        console.log(formatter.formatSuccess('Successfully created {moduleName}'));
      } catch (error) {
        progress.fail('Failed to create {moduleName}');
        console.error(formatter.formatError(error.message));
        process.exit(1);
      }
    });

  // Delete command
  command
    .command('delete <id>')
    .description('Delete a {moduleName}')
    .action(async (id: string) => {
      const progress = formatter.createProgressLogger('deleting', `Deleting {moduleName} ${id}...`);
      progress.start();

      try {
        const module = get{ModuleName}Module();
        await module.exports.service().delete(id);
        
        progress.succeed('Deleted successfully');
        console.log(formatter.formatSuccess(`{ModuleName} ${id} has been deleted`));
      } catch (error) {
        progress.fail('Failed to delete {moduleName}');
        console.error(formatter.formatError(error.message));
        process.exit(1);
      }
    });

  // Override help
  command.configureHelp({
    formatHelp: (cmd) => formatter.formatHelp(cmd, false)
  });

  return command;
}
```

#### Database Schema
```sql
-- {moduleName} module schema
CREATE TABLE IF NOT EXISTS {moduleName}s (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  metadata JSON DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_{moduleName}s_name ON {moduleName}s(name);
CREATE INDEX idx_{moduleName}s_created_at ON {moduleName}s(created_at);

-- Triggers
CREATE TRIGGER update_{moduleName}s_updated_at
AFTER UPDATE ON {moduleName}s
BEGIN
  UPDATE {moduleName}s SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

### Step 4: Create Tests

#### E2E Test Template
```typescript
/**
 * @file E2E tests for {moduleName} module.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('{ModuleName} Module E2E Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../bin/systemprompt');
  let createdId: string;

  beforeAll(() => {
    // Ensure clean state
    execSync(`${CLI_PATH} {moduleName} delete --all`, { 
      encoding: 'utf8',
      stdio: 'pipe' 
    });
  });

  afterAll(() => {
    // Cleanup
    if (createdId) {
      execSync(`${CLI_PATH} {moduleName} delete ${createdId}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    }
  });

  it('should display help for {moduleName} command', () => {
    const output = execSync(`${CLI_PATH} {moduleName} --help`, {
      encoding: 'utf8'
    });

    expect(output).toContain('{moduleName}');
    expect(output).toContain('list');
    expect(output).toContain('create');
    expect(output).toContain('delete');
  });

  it('should list {moduleName}s (initially empty)', () => {
    const output = execSync(`${CLI_PATH} {moduleName} list`, {
      encoding: 'utf8'
    });

    expect(output).toContain('No {moduleName}s found');
  });

  it('should create a new {moduleName}', () => {
    const output = execSync(`${CLI_PATH} {moduleName} create "Test Item"`, {
      encoding: 'utf8'
    });

    expect(output).toContain('Successfully created {moduleName}');
    
    // Extract ID from output
    const idMatch = output.match(/ID: ([a-f0-9]+)/);
    expect(idMatch).toBeTruthy();
    createdId = idMatch![1];
  });

  it('should list {moduleName}s after creation', () => {
    const output = execSync(`${CLI_PATH} {moduleName} list`, {
      encoding: 'utf8'
    });

    expect(output).toContain('Test Item');
    expect(output).toContain(createdId);
  });

  it('should delete the {moduleName}', () => {
    const output = execSync(`${CLI_PATH} {moduleName} delete ${createdId}`, {
      encoding: 'utf8'
    });

    expect(output).toContain('has been deleted');
  });

  it('should show empty list after deletion', () => {
    const output = execSync(`${CLI_PATH} {moduleName} list`, {
      encoding: 'utf8'
    });

    expect(output).toContain('No {moduleName}s found');
  });
});
```

### Step 5: Integration Steps

1. **Add to Module Registry**
   ```typescript
   // In src/modules/types/index.ts
   export enum ModuleName {
     // ... existing modules
     {MODULE_NAME} = '{moduleName}',
   }
   ```

2. **Register CLI Command**
   ```typescript
   // In src/modules/core/cli/commands/index.ts
   import { create{ModuleName}Command } from '@/modules/core/{moduleName}/cli/index';
   
   // Add to command registration
   program.addCommand(create{ModuleName}Command());
   ```

3. **Add to Bootstrap**
   ```typescript
   // In src/bootstrap/phases/core-modules-phase.ts
   import { createModule as create{ModuleName}Module } from '@/modules/core/{moduleName}/index';
   
   // Add to core modules list
   const coreModules = [
     // ... existing modules
     { name: ModuleName.{MODULE_NAME}, factory: create{ModuleName}Module },
   ];
   ```

### Step 6: Validation Checklist

The agent will validate:

1. **TypeScript Compilation**
   ```bash
   npm run typecheck
   ```

2. **Linting Compliance**
   ```bash
   npm run lint
   ```

3. **Unit Tests**
   ```bash
   npm test tests/unit/modules/core/{moduleName}
   ```

4. **E2E Tests**
   ```bash
   npm run test:e2e tests/e2e/{moduleName}.e2e.test.ts
   ```

5. **CLI Commands**
   ```bash
   ./systemprompt {moduleName} --help
   ./systemprompt {moduleName} list
   ./systemprompt {moduleName} create "Test"
   ```

## Dev Module Integration

The agent will also create a `create-module` command in the dev module:

```typescript
// src/modules/core/dev/cli/create-module.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import { CliFormatterService } from '@/modules/core/cli/services/cli-formatter.service';
import { ModuleGenerator } from '@/modules/core/dev/services/module-generator.service';

export function createModuleCommand(): Command {
  const formatter = CliFormatterService.getInstance();
  const command = new Command('create-module')
    .description('Create a new SystemPrompt OS module with boilerplate');

  command.action(async () => {
    console.log(formatter.highlight('SystemPrompt OS Module Creator'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Module name (lowercase):',
        validate: (input) => /^[a-z][a-z0-9-]*$/.test(input) || 'Must be lowercase with hyphens only'
      },
      {
        type: 'list',
        name: 'type',
        message: 'Module type:',
        choices: ['service', 'utility', 'integration']
      },
      {
        type: 'input',
        name: 'description',
        message: 'Module description:'
      },
      {
        type: 'confirm',
        name: 'needsDatabase',
        message: 'Does this module need database tables?',
        default: true
      },
      {
        type: 'checkbox',
        name: 'dependencies',
        message: 'Select module dependencies:',
        choices: ['logger', 'database', 'auth', 'config', 'monitor']
      }
    ]);

    const progress = formatter.createMultiStepProgress([
      'Creating module structure',
      'Generating code files',
      'Creating database schema',
      'Setting up CLI commands',
      'Creating tests',
      'Running validation'
    ], 'building');

    try {
      const generator = new ModuleGenerator();
      await generator.createModule(answers, progress);
      
      console.log(formatter.formatSuccess(`Module "${answers.name}" created successfully!`));
      console.log(formatter.formatInfo('Next steps:'));
      console.log('1. Run npm run typecheck');
      console.log('2. Run npm run lint');
      console.log('3. Run npm test');
      console.log('4. Test CLI commands');
    } catch (error) {
      console.error(formatter.formatError(`Failed to create module: ${error.message}`));
      process.exit(1);
    }
  });

  return command;
}
```

## Example Usage

```bash
# Create a new module
./systemprompt dev create-module

# Follow the prompts:
# Module name: notifications
# Module type: service
# Description: Handle system notifications and alerts
# Needs database: yes
# Dependencies: logger, database, auth

# The agent will:
# 1. Create all files and directories
# 2. Generate working code
# 3. Add database schema
# 4. Create CLI commands
# 5. Generate tests
# 6. Validate everything

# Test the new module
./systemprompt notifications --help
./systemprompt notifications list
./systemprompt notifications create "Test notification"

# Run tests
npm test tests/unit/modules/core/notifications
npm run test:e2e tests/e2e/notifications.e2e.test.ts
```

## Best Practices

1. **Always use the CLI formatter** for consistent output
2. **Follow the module pattern** exactly as specified
3. **Include comprehensive error handling**
4. **Write both unit and E2E tests**
5. **Document all public APIs**
6. **Use proper TypeScript types**
7. **Validate against linting rules**
8. **Test in Docker environment**

## Common Issues and Solutions

1. **TypeScript Errors**
   - Ensure all imports are correct
   - Check type definitions match interfaces
   - Verify module exports are properly typed

2. **Linting Failures**
   - Use consistent naming conventions
   - Avoid any types
   - Ensure proper error handling

3. **Test Failures**
   - Check database migrations ran
   - Verify module is properly initialized
   - Ensure clean test state

4. **CLI Not Working**
   - Verify command is registered
   - Check module is in bootstrap
   - Ensure proper error messages