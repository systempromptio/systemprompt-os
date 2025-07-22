/**
 * @fileoverview Call an MCP tool
 * @module modules/core/cli/cli/mcp:call
 */

import { CLIContext, CLICommand } from '@/modules/core/cli/types';
import { CommandExecutionError, InvalidArgumentsError } from '@/modules/core/cli/utils/errors';
import { MCPClient } from './client.js';

interface ToolResult {
  message?: string;
  result?: Record<string, any>;
  status?: string;
  error?: {
    message?: string;
    details?: any;
  };
}

export const command: CLICommand = {
  description: 'Call an MCP tool',
  positionals: [
    {
      name: 'tool',
      type: 'string',
      description: 'Tool name to call',
      required: true
    }
  ],
  options: [
    {
      name: 'args',
      alias: 'a',
      type: 'string',
      description: 'Tool arguments as JSON string',
      default: '{}'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (json, pretty)',
      default: 'pretty',
      choices: ['json', 'pretty']
    }
  ],
  examples: [
    'systemprompt cli:mcp:call check_status',
    'systemprompt cli:mcp:call whoami --args \'{"detail": true}\'',
    'systemprompt cli:mcp:call list_files --args \'{"path": "/home"}\' --format json'
  ],
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    const toolName = args.tool as string;
    const format = args.format as string;
    const argsJson = args.args as string;
    
    let toolArgs: unknown = {};
    try {
      toolArgs = JSON.parse(argsJson);
    } catch (error) {
      throw new InvalidArgumentsError(
        'cli:mcp:call',
        `Invalid JSON for tool arguments: ${argsJson}`
      );
    }
    
    const client = new MCPClient();
    
    try {
      await client.connect();
      const result = await client.callTool(toolName, toolArgs) as ToolResult;
      
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        // Pretty print the result
        if (typeof result === 'object' && result !== null) {
          if (result.message) {
            console.log(result.message);
          }
          
          if (result.result) {
            console.log('\nResult:');
            console.log('═══════\n');
            
            for (const [key, value] of Object.entries(result.result)) {
              if (Array.isArray(value)) {
                console.log(`${key}:`);
                value.forEach(item => console.log(`  - ${item}`));
              } else if (typeof value === 'object' && value !== null) {
                console.log(`${key}:`);
                for (const [subKey, subValue] of Object.entries(value)) {
                  console.log(`  ${subKey}: ${subValue}`);
                }
              } else {
                console.log(`${key}: ${value}`);
              }
            }
          }
          
          if (result.status === 'error' && result.error) {
            console.error('\nError:', result.error.message || result.message);
            if (result.error.details) {
              console.error('Details:', result.error.details);
            }
          }
        } else {
          console.log(result);
        }
      }
    } catch (error) {
      throw new CommandExecutionError('cli:mcp:call', error as Error);
    } finally {
      client.disconnect();
    }
  }
};