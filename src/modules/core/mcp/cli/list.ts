/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * List MCP contexts CLI command.
 */

import { Command } from 'commander';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';

const NO_CONTEXTS = 0;
const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for listing MCP contexts.
 * @returns The configured Commander command.
 */
export const createListCommand = (): Command => {
  return new Command('mcp:list')
    .description('List all configured MCP contexts')
    .option('-f, --format <format>', 'Output format', 'table')
    .action(async (options): Promise<void> => {
      try {
        const service = MCPService.getInstance();
        await service.initialize();

        const contexts = await service.listContexts();

        if (contexts.length === NO_CONTEXTS) {
          console.log('No MCP contexts found.');
          return;
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(contexts, null, 2));
          return;
        }

        console.log('MCP Contexts:');
        contexts.forEach((context): void => {
          console.log(`- ${context.name} (${context.model})`);
          console.log(`  ID: ${context.id}`);
          console.log(`  Max Tokens: ${context.maxTokens}`);
          console.log(`  Temperature: ${context.temperature}`);
        });
      } catch (error) {
        console.error('Error listing MCP contexts:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
