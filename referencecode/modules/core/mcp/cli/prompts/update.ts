/**
 * @fileoverview MCP prompts update command
 * @module modules/core/mcp/cli/prompts
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import type { MCPModule } from '../../index.js';

export function createPromptsUpdateCommand(module: MCPModule): Command {
  return new Command('update')
    .description('Update an existing MCP prompt')
    .argument('<name>', 'Name of the prompt to update')
    .option('-d, --description <description>', 'New description')
    .option('-a, --arguments <arguments>', 'New arguments as JSON array')
    .option('-m, --messages <messages>', 'New messages as JSON array')
    .option('-f, --file <file>', 'Read update data from JSON/YAML file')
    .option('--dry-run', 'Show what would be updated without making changes')
    .action(async (name, options) => {
      try {
        // First check if prompt exists
        const existing = await module.getPrompt(name);
        if (!existing) {
          console.error(`Prompt '${name}' not found`);
          process.exit(1);
        }
        
        let updateData: any = {};
        
        // Read from file if specified
        if (options.file) {
          const content = await fs.readFile(options.file, 'utf-8');
          if (options.file.endsWith('.yaml') || options.file.endsWith('.yml')) {
            const yaml = await import('js-yaml');
            updateData = yaml.load(content) as any;
          } else {
            updateData = JSON.parse(content);
          }
        }
        
        // Override with command line options
        if (options.description !== undefined) {updateData.description = options.description;}
        if (options.arguments) {
          updateData.arguments = JSON.parse(options.arguments);
        }
        if (options.messages) {
          updateData.messages = JSON.parse(options.messages);
        }
        
        // Validate messages if provided
        if (updateData.messages) {
          if (!Array.isArray(updateData.messages) || updateData.messages.length === 0) {
            console.error('Error: Messages must be a non-empty array');
            process.exit(1);
          }
          for (const msg of updateData.messages) {
            if (!msg.role || !msg.content) {
              console.error('Error: Each message must have role and content');
              process.exit(1);
            }
            if (!['system', 'user', 'assistant'].includes(msg.role)) {
              console.error(`Error: Invalid role '${msg.role}'. Must be system, user, or assistant`);
              process.exit(1);
            }
          }
        }
        
        // Validate arguments if provided
        if (updateData.arguments) {
          if (!Array.isArray(updateData.arguments)) {
            console.error('Error: Arguments must be an array');
            process.exit(1);
          }
          for (const arg of updateData.arguments) {
            if (!arg.name) {
              console.error('Error: Each argument must have a name');
              process.exit(1);
            }
          }
        }
        
        if (options.dryRun) {
          console.log(`Would update prompt '${name}' with:`);
          console.log(JSON.stringify(updateData, null, 2));
          return;
        }
        
        // Update the prompt
        const updated = await module.updatePrompt(name, updateData);
        if (!updated) {
          console.error(`Failed to update prompt '${name}'`);
          process.exit(1);
        }
        
        console.log(`Prompt '${name}' updated successfully`);
        
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}