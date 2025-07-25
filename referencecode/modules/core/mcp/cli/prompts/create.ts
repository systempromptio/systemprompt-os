/**
 * @fileoverview MCP prompts create command
 * @module modules/core/mcp/cli/prompts
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import type { MCPModule } from '../../index.js';
// Removed unused import

export function createPromptsCreateCommand(module: MCPModule): Command {
  return new Command('create')
    .description('Create a new MCP prompt')
    .option('-n, --name <name>', 'Prompt name (required)')
    .option('-d, --description <description>', 'Prompt description')
    .option('-a, --arguments <arguments>', 'Arguments as JSON array')
    .option('-m, --messages <messages>', 'Messages as JSON array')
    .option('-f, --file <file>', 'Read prompt data from JSON/YAML file')
    .option('--dry-run', 'Validate without creating')
    .action(async (options) => {
      try {
        let promptData: any = {};

        // Read from file if specified
        if (options.file) {
          const content = await fs.readFile(options.file, 'utf-8');
          if (options.file.endsWith('.yaml') || options.file.endsWith('.yml')) {
            const yaml = await import('js-yaml');
            promptData = yaml.load(content) as any;
          } else {
            promptData = JSON.parse(content);
          }
        }

        // Override with command line options
        if (options.name) {promptData.name = options.name;}
        if (options.description) {promptData.description = options.description;}
        if (options.arguments) {
          promptData.arguments = JSON.parse(options.arguments);
        }
        if (options.messages) {
          promptData.messages = JSON.parse(options.messages);
        }

        // Validate required fields
        if (!promptData.name) {
          console.error('Error: Prompt name is required');
          process.exit(1);
        }

        if (!promptData.messages || !Array.isArray(promptData.messages) || promptData.messages.length === 0) {
          console.error('Error: At least one message is required');
          process.exit(1);
        }

        // Validate messages
        for (const msg of promptData.messages) {
          if (!msg.role || !msg.content) {
            console.error('Error: Each message must have role and content');
            process.exit(1);
          }
          if (!['system', 'user', 'assistant'].includes(msg.role)) {
            console.error(`Error: Invalid role '${msg.role}'. Must be system, user, or assistant`);
            process.exit(1);
          }
        }

        // Validate arguments if provided
        if (promptData.arguments) {
          if (!Array.isArray(promptData.arguments)) {
            console.error('Error: Arguments must be an array');
            process.exit(1);
          }
          for (const arg of promptData.arguments) {
            if (!arg.name) {
              console.error('Error: Each argument must have a name');
              process.exit(1);
            }
          }
        }

        if (options.dryRun) {
          console.log('Validation passed. Prompt data:');
          console.log(JSON.stringify(promptData, null, 2));
          return;
        }

        // Create the prompt
        const created = await module.createPrompt(promptData);
        console.log(`Prompt '${created.name}' created successfully`);

      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}