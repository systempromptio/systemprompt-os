/**
 * @fileoverview MCP prompts get command
 * @module modules/core/mcp/cli/prompts
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';

export function createPromptsGetCommand(module: MCPModule): Command {
  return new Command('get')
    .description('Get a specific MCP prompt')
    .argument('<name>', 'Name of the prompt to get')
    .option('-f, --format <format>', 'Output format (json, yaml, text)', 'text')
    .action(async (name, options) => {
      try {
        const prompt = await module.getPrompt(name);

        if (!prompt) {
          console.error(`Prompt '${name}' not found`);
          process.exit(1);
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(prompt, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(prompt));
        } else {
          // Text format
          console.log(`Name: ${prompt.name}`);
          console.log(`Description: ${prompt.description || '-'}`);

          if (prompt.arguments && prompt.arguments.length > 0) {
            console.log('\nArguments:');
            for (const arg of prompt.arguments) {
              console.log(`  - ${arg.name}${arg.required ? ' (required)' : ''}: ${arg.description || '-'}`);
            }
          }

          if (prompt.messages && prompt.messages.length > 0) {
            console.log('\nMessages:');
            for (const msg of prompt.messages) {
              console.log(`  - Role: ${msg.role}`);
              if (typeof msg.content === 'string') {
                console.log(`    Content: ${msg.content}`);
              } else {
                console.log(`    Content: ${JSON.stringify(msg.content)}`);
              }
            }
          }
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}