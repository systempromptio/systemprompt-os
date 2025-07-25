/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * Create MCP context CLI command.
 */

import { Command } from 'commander';
import { MCPService } from '@/modules/core/mcp/services/mcp.service.js';

const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for creating MCP contexts.
 * @returns The configured Commander command.
 */
export const createCreateCommand = (): Command => {
  return new Command('mcp:create')
    .description('Create a new MCP context')
    .requiredOption('-n, --name <name>', 'Context name')
    .requiredOption('-m, --model <model>', 'Model identifier')
    .option('--max-tokens <number>', 'Maximum tokens', '4096')
    .option('--temperature <number>', 'Temperature', '0.7')
    .action(async (options): Promise<void> => {
      try {
        const service = MCPService.getInstance();
        await service.initialize();

        const config = {
          maxTokens: parseInt(options.maxTokens, 10),
          temperature: parseFloat(options.temperature)
        };

        const context = await service.createContext(
          options.name,
          options.model,
          config
        );

        console.log(`Created MCP context: ${context.name}`);
        console.log(`ID: ${context.id}`);
        console.log(`Model: ${context.model}`);
        console.log(`Max Tokens: ${context.maxTokens}`);
        console.log(`Temperature: ${context.temperature}`);
      } catch (error) {
        console.error('Error creating MCP context:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
