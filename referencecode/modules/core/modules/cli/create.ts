/**
 * @fileoverview Create new module CLI command
 * @module modules/core/modules/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { ModuleManagerService } from '../services/module-manager.service.js';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export function createCreateCommand(_service: ModuleManagerService, _logger?: Logger): Command {
  return new Command('create')
    .description('Create a new module with proper structure')
    .requiredOption('-n, --name <name>', 'Module name (lowercase, alphanumeric with hyphens)')
    .option(
      '-t, --type <type>',
      'Module type (service, daemon, plugin, core, extension)',
      'service',
    )
    .option('-d, --description <desc>', 'Module description', 'A new SystemPrompt OS module')
    .option('-a, --author <author>', 'Module author', 'SystemPrompt Team')
    .option('-s, --style <style>', 'Implementation style (class, function)', 'class')
    .option('-p, --path <path>', 'Path to create module in', './src/modules/core')
    .action(async (options) => {
      try {
        // Validate module name
        if (!/^[a-z0-9-]+$/.test(options.name)) {
          console.error('❌ Module name must be lowercase alphanumeric with hyphens only');
          process.exit(1);
        }

        // Check if module already exists
        const modulePath = resolve(options.path, options.name);
        if (existsSync(modulePath)) {
          console.error(`❌ Module directory already exists: ${modulePath}`);
          process.exit(1);
        }

        console.log(`Creating module '${options.name}'...`);

        // Create module directory structure
        createModuleStructure(modulePath, options);

        console.log(`\n✅ Module '${options.name}' created successfully at:`);
        console.log(`   ${modulePath}`);
        console.log('\nNext steps:');
        console.log(`  1. cd ${modulePath}`);
        console.log('  2. Implement your module logic in index.ts');
        console.log('  3. Add CLI commands in the cli/ directory');
        console.log(`  4. Run 'systemprompt modules:validate -p ${modulePath}' to verify`);

        process.exit(0);
      } catch (error) {
        console.error(`❌ Error creating module: ${error}`);
        process.exit(1);
      }
    });
}

function createModuleStructure(modulePath: string, options: any): void {
  // Create directory structure
  mkdirSync(modulePath, { recursive: true });
  mkdirSync(join(modulePath, 'cli'));
  mkdirSync(join(modulePath, 'services'));
  mkdirSync(join(modulePath, 'repositories'));
  mkdirSync(join(modulePath, 'types'));
  mkdirSync(join(modulePath, 'database'));
  mkdirSync(join(modulePath, 'database', 'migrations'));

  // Create module.yaml
  const moduleYaml = `name: ${options.name}
type: ${options.type}
version: 1.0.0
description: ${options.description}
author: ${options.author}
dependencies:
  - logger
  - database
config:
  # Add module configuration here
cli:
  commands:
    - name: status
      description: Show ${options.name} module status
`;
  writeFileSync(join(modulePath, 'module.yaml'), moduleYaml);

  // Create index.ts
  const indexContent =
    options.style === 'class'
      ? createClassTemplate(options.name, options.type)
      : createFunctionTemplate(options.name, options.type);
  writeFileSync(join(modulePath, 'index.ts'), indexContent);

  // Create README.md
  const readmeContent = `# ${options.name} Module

${options.description}

## Overview

This module provides...

## Features

- Feature 1
- Feature 2

## Configuration

\`\`\`yaml
${options.name}:
  enabled: true
  # Add configuration options
\`\`\`

## CLI Commands

- \`systemprompt ${options.name}:status\` - Show module status

## API

### Services

- \`${options.name}Service\` - Main service class

### Types

- \`${options.name}Config\` - Configuration interface
`;
  writeFileSync(join(modulePath, 'README.md'), readmeContent);

  // Create types/index.ts
  const typesContent = `/**
 * @fileoverview ${options.name} module types
 */

export interface ${capitalizeFirst(options.name)}Config {
  enabled: boolean;
  // Add configuration properties
}

export interface ${capitalizeFirst(options.name)}Status {
  healthy: boolean;
  message?: string;
  // Add status properties
}
`;
  writeFileSync(join(modulePath, 'types', 'index.ts'), typesContent);

  // Create database/schema.sql
  const schemaContent = `-- ${options.name} module database schema

CREATE TABLE IF NOT EXISTS ${options.name}_data (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
  writeFileSync(join(modulePath, 'database', 'schema.sql'), schemaContent);

  // Create a sample CLI command
  const cliCommandContent = `/**
 * @fileoverview ${options.name} status CLI command
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';

export function createStatusCommand(logger?: Logger): Command {
  return new Command('status')
    .description('Show ${options.name} module status')
    .action(async () => {
      try {
        console.log('${options.name} module status:');
        console.log('  Status: ✅ Healthy');
        console.log('  Version: 1.0.0');
        process.exit(0);
      } catch (error) {
        console.error(\`❌ Error: \${error}\`);
        process.exit(1);
      }
    });
}
`;
  writeFileSync(join(modulePath, 'cli', 'status.ts'), cliCommandContent);
}

function createClassTemplate(name: string, type: string): string {
  const className = `${capitalizeFirst(name)  }Module`;
  return `/**
 * @fileoverview ${name} module implementation
 */

import { ModuleInterface, ModuleContext }
import type { Logger } from '@/modules/types';
import { ${capitalizeFirst(name)}Config } from './types.js';

export class ${className} implements ModuleInterface {
  name = '${name}';
  version = '1.0.0';
  type = '${type}' as const;
  
  private config?: ${capitalizeFirst(name)}Config;
  private logger?: Logger;
  
  async initialize(context: ModuleContext): Promise<void> {
    this.config = context.config as ${capitalizeFirst(name)}Config;
    this.logger = context.logger;
    
    this.logger?.info('${name} module initialized');
  }
  
  async start(): Promise<void> {
    this.logger?.info('${name} module started');
  }
  
  async stop(): Promise<void> {
    this.logger?.info('${name} module stopped');
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return {
      healthy: true,
      message: '${name} module is healthy'
    };
  }
  
  async getCommand(): Promise<any> {
    const { createStatusCommand } = await import('./cli/status.js');
    return createStatusCommand(this.logger);
  }
}

export default new ${className}();
`;
}

function createFunctionTemplate(name: string, type: string): string {
  return `/**
 * @fileoverview ${name} module implementation
 */

import { ModuleInterface, ModuleContext }
import type { Logger } from '@/modules/types';
import { ${capitalizeFirst(name)}Config } from './types.js';

let config: ${capitalizeFirst(name)}Config | undefined;
let logger: Logger | undefined;

export const ${name}Module: ModuleInterface = {
  name: '${name}',
  version: '1.0.0',
  type: '${type}',
  
  async initialize(context: ModuleContext): Promise<void> {
    config = context.config as ${capitalizeFirst(name)}Config;
    logger = context.logger;
    
    logger?.info('${name} module initialized');
  },
  
  async start(): Promise<void> {
    logger?.info('${name} module started');
  },
  
  async stop(): Promise<void> {
    logger?.info('${name} module stopped');
  },
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return {
      healthy: true,
      message: '${name} module is healthy'
    };
  },
  
  async getCommand(): Promise<any> {
    const { createStatusCommand } = await import('./cli/status.js');
    return createStatusCommand(logger);
  }
};

export default ${name}Module;
`;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
