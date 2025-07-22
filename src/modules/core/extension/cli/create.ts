/**
 * @fileoverview Module generator CLI command
 * Creates a new module with the proper structure
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// Local interface definition
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

const MODULE_TEMPLATE = `name: {name}
type: {type}
version: 1.0.0
description: {description}
author: {author}
dependencies:
  - logger
  - database
config:
  # Add module configuration here
cli:
  commands:
    - name: status
      description: Show {name} module status
`;

const INDEX_CLASS_TEMPLATE = `/**
 * @fileoverview {name} module implementation
 */

import { ModuleInterface, ModuleContext } from '../../types';

export class {className} implements ModuleInterface {
  name = '{name}';
  version = '1.0.0';
  type: '{type}' = '{type}';
  
  private config: any;
  private logger?: any;
  
  async initialize(context: ModuleContext): Promise<void> {
    this.config = context.config || {};
    this.logger = context.logger;
    
    if (this.logger) {
      this.logger.info(\`Initializing \${this.name} module\`);
    }
    
    // Initialize module resources
  }
  
  async start(): Promise<void> {
    if (this.logger) {
      this.logger.info(\`Starting \${this.name} module\`);
    }
    
    // Start module services
  }
  
  async stop(): Promise<void> {
    if (this.logger) {
      this.logger.info(\`Stopping \${this.name} module\`);
    }
    
    // Cleanup resources
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    // Implement health check logic
    return { 
      healthy: true,
      message: \`\${this.name} module is healthy\`
    };
  }
  
  get exports() {
    return {
      // Export module functionality
    };
  }
}

export default {className};
`;

const INDEX_FUNCTION_TEMPLATE = `/**
 * @fileoverview {name} module implementation
 */

import { ModuleContext } from '../../types';

export const name = '{name}';
export const version = '1.0.0';
export const type = '{type}';

let config: any;
let logger: any;

export async function initialize(context: ModuleContext): Promise<void> {
  config = context.config || {};
  logger = context.logger;
  
  if (logger) {
    logger.info(\`Initializing \${name} module\`);
  }
  
  // Initialize module resources
}

export async function start(): Promise<void> {
  if (logger) {
    logger.info(\`Starting \${name} module\`);
  }
  
  // Start module services
}

export async function stop(): Promise<void> {
  if (logger) {
    logger.info(\`Stopping \${name} module\`);
  }
  
  // Cleanup resources
}

export async function healthCheck(): Promise<{ healthy: boolean; message?: string }> {
  // Implement health check logic
  return { 
    healthy: true,
    message: \`\${name} module is healthy\`
  };
}
`;

const README_TEMPLATE = `# {name} Module

## Overview

{description}

## Configuration

\`\`\`yaml
{name}:
  # Add configuration options here
\`\`\`

## CLI Commands

### Status Command

Show the current status of the {name} module:

\`\`\`bash
systemprompt {name}:status
\`\`\`

## API

This module exports the following functionality:

- TODO: Document exported APIs

## Development

### Directory Structure

\`\`\`
{name}/
├── module.yaml      # Module manifest
├── index.ts        # Module entry point
├── README.md       # This file
├── cli/            # CLI commands
├── services/       # Business logic
├── types/          # TypeScript definitions
└── tests/          # Unit tests
\`\`\`

### Testing

Run tests with:

\`\`\`bash
npm test -- src/modules/core/{name}
\`\`\`

## License

{license}
`;

const CLI_STATUS_TEMPLATE = `/**
 * @fileoverview Status command for {name} module
 */

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    try {
      // TODO: Implement status check
      console.log('{name} module status:');
      console.log('- Status: Active');
      console.log('- Health: Healthy');
    } catch (error) {
      console.error('Error checking {name} status:', error);
      process.exit(1);
    }
  }
};
`;

const TYPE_INDEX_TEMPLATE = `/**
 * @fileoverview Type definitions for {name} module
 */

// Add your type definitions here
export interface {className}Config {
  // Configuration options
}

export interface {className}State {
  // Module state
}
`;

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    try {
      const name = context.args.name as string;
      const type = context.args.type as string || 'service';
      const description = context.args.description as string || 'A new SystemPrompt OS module';
      const author = context.args.author as string || 'SystemPrompt Team';
      const style = context.args.style as string || 'class';
      const basePath = context.args.path as string || './src/modules/core';
      
      // Validate module name
      if (!name) {
        console.error('Error: Module name is required');
        console.error('Usage: systemprompt extension:create --name <name> [options]');
        process.exit(1);
      }
      
      if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        console.error('Error: Module name must be lowercase alphanumeric with hyphens');
        process.exit(1);
      }
      
      // Create module directory
      const modulePath = resolve(context.cwd, basePath, name);
      if (existsSync(modulePath)) {
        console.error(`Error: Module directory already exists: ${modulePath}`);
        process.exit(1);
      }
      
      console.log(`Creating module '${name}' at ${modulePath}...`);
      
      // Create directory structure
      mkdirSync(modulePath, { recursive: true });
      mkdirSync(join(modulePath, 'cli'));
      mkdirSync(join(modulePath, 'services'));
      mkdirSync(join(modulePath, 'types'));
      mkdirSync(join(modulePath, 'tests'));
      mkdirSync(join(modulePath, 'utils'));
      
      if (type === 'service' || type === 'daemon') {
        mkdirSync(join(modulePath, 'database'));
        mkdirSync(join(modulePath, 'database', 'migrations'));
      }
      
      // Generate files
      const className = toPascalCase(name) + 'Module';
      const replacements = {
        '{name}': name,
        '{type}': type,
        '{description}': description,
        '{author}': author,
        '{className}': className,
        '{license}': 'MIT'
      };
      
      // Write module.yaml
      const moduleYaml = MODULE_TEMPLATE.replace(/{(\w+)}/g, (_, key) => replacements[`{${key}}` as keyof typeof replacements] || '');
      writeFileSync(join(modulePath, 'module.yaml'), moduleYaml);
      
      // Write index.ts
      const indexTemplate = style === 'class' ? INDEX_CLASS_TEMPLATE : INDEX_FUNCTION_TEMPLATE;
      const indexContent = indexTemplate.replace(/{(\w+)}/g, (_, key) => replacements[`{${key}}` as keyof typeof replacements] || '');
      writeFileSync(join(modulePath, 'index.ts'), indexContent);
      
      // Write README.md
      const readmeContent = README_TEMPLATE.replace(/{(\w+)}/g, (_, key) => replacements[`{${key}}` as keyof typeof replacements] || '');
      writeFileSync(join(modulePath, 'README.md'), readmeContent);
      
      // Write CLI status command
      const cliContent = CLI_STATUS_TEMPLATE.replace(/{(\w+)}/g, (_, key) => replacements[`{${key}}` as keyof typeof replacements] || '');
      writeFileSync(join(modulePath, 'cli', 'status.ts'), cliContent);
      
      // Write type definitions
      const typeContent = TYPE_INDEX_TEMPLATE.replace(/{(\w+)}/g, (_, key) => replacements[`{${key}}` as keyof typeof replacements] || '');
      writeFileSync(join(modulePath, 'types', 'index.ts'), typeContent);
      
      // Create empty service file
      writeFileSync(join(modulePath, 'services', `.gitkeep`), '');
      writeFileSync(join(modulePath, 'tests', `.gitkeep`), '');
      writeFileSync(join(modulePath, 'utils', `.gitkeep`), '');
      
      // Create database files if needed
      if (type === 'service' || type === 'daemon') {
        const schemaContent = `-- Schema for ${name} module\n\n-- TODO: Define your tables here\n`;
        writeFileSync(join(modulePath, 'database', 'schema.sql'), schemaContent);
        writeFileSync(join(modulePath, 'database', 'init.sql'), schemaContent);
        writeFileSync(join(modulePath, 'database', 'migrations', '.gitkeep'), '');
      }
      
      console.log(`\n✓ Module '${name}' created successfully!`);
      console.log(`\nNext steps:`);
      console.log(`1. cd ${modulePath}`);
      console.log(`2. Implement your module logic in index.ts`);
      console.log(`3. Add services to the services/ directory`);
      console.log(`4. Define types in types/index.ts`);
      console.log(`5. Add tests to the tests/ directory`);
      console.log(`6. Update the README.md with detailed documentation`);
      console.log(`\nTo validate your module:`);
      console.log(`   systemprompt extension:validate --path ${join(basePath, name)}`);
      console.log(`\nTo enable your module, add it to the module loader configuration.`);
      
    } catch (error) {
      console.error('Error creating module:', error);
      process.exit(1);
    }
  }
};