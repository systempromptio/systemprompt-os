/**
 * @fileoverview MCP tools test command
 * @module modules/core/mcp/cli/tools
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';

export function createToolsTestCommand(module: MCPModule): Command {
  return new Command('test')
    .description('Test an MCP tool')
    .argument('<name>', 'Tool name')
    .option('-a, --args <args>', 'Tool arguments as JSON string', '{}')
    .option('-c, --context <context>', 'Execution context as JSON string')
    .option('-f, --format <format>', 'Output format (json, yaml, pretty)', 'pretty')
    .action(async (name: string, options) => {
      try {
        // Parse arguments
        let args: any = {};
        try {
          args = JSON.parse(options.args);
        } catch {
          console.error('Invalid JSON for arguments:', options.args);
          process.exit(1);
        }

        // Parse context if provided
        let context: any = undefined;
        if (options.context) {
          try {
            context = JSON.parse(options.context);
          } catch {
            console.error('Invalid JSON for context:', options.context);
            process.exit(1);
          }
        }

        console.log(`Testing tool: ${name}`);
        console.log('Arguments:', JSON.stringify(args, null, 2));
        if (context) {
          console.log('Context:', JSON.stringify(context, null, 2));
        }
        console.log('\nExecuting...\n');

        // Execute tool
        const result = await module.executeTool(name, args, context);

        // Format output
        if (options.format === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(result));
        } else {
          // Pretty format
          if (result.success) {
            console.log('✓ Tool executed successfully');
            console.log('\nResult:');
            console.log(JSON.stringify(result.data, null, 2));

            if (result.metadata) {
              console.log('\nMetadata:');
              console.log(`  Execution time: ${result.metadata.executionTimeMs}ms`);
            }
          } else {
            console.log('✗ Tool execution failed');
            console.log('\nError:');
            console.log(`  Code: ${result.error?.code}`);
            console.log(`  Message: ${result.error?.message}`);
            if (result.error?.details) {
              console.log(`  Details: ${JSON.stringify(result.error.details, null, 2)}`);
            }
          }
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}
