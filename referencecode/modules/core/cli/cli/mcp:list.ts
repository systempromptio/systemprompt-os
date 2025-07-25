/**
 * @fileoverview List available MCP tools
 * @module modules/core/cli/cli/mcp:list
 */

import type { CLIContext, CLICommand } from '@/modules/core/cli/types/index.js';
import { CommandExecutionError } from '@/modules/core/cli/utils/errors.js';
import { MCPClient } from './client.js';

interface ToolParameter {
  type: string;
  description?: string;
  default?: any;
  enum?: string[];
}

interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, ToolParameter>;
    required?: string[];
  };
}

export const command: CLICommand = {
  description: 'List available MCP tools',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (json, table)',
      default: 'table',
      choices: ['json', 'table'],
    },
  ],
  examples: ['systemprompt cli:mcp:list', 'systemprompt cli:mcp:list --format json'],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    const format = args['format'] as string;
    const client = new MCPClient();

    try {
      await client.connect();
      const tools = (await client.listTools()) as ToolSchema[];

      if (format === 'json') {
        console.log(JSON.stringify(tools, null, 2));
      } else {
        console.log('Available MCP Tools:');
        console.log('═══════════════════\n');

        for (const tool of tools) {
          console.log(`${tool.name}`);
          console.log(`  ${tool.description}`);

          if (tool.inputSchema.properties && Object.keys(tool.inputSchema.properties).length > 0) {
            console.log('  Parameters:');
            for (const [param, schema] of Object.entries(tool.inputSchema.properties)) {
              const required = tool.inputSchema.required?.includes(param) ? ' (required)' : '';
              console.log(`    - ${param}: ${schema.type}${required}`);
              if (schema.description) {
                console.log(`      ${schema.description}`);
              }
            }
          } else {
            console.log('  No parameters required');
          }
          console.log();
        }
      }
    } catch (error) {
      throw new CommandExecutionError('cli:mcp:list', error as Error);
    } finally {
      client.disconnect();
    }
  },
};
