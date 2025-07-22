/**
 * @fileoverview MCP execute commands
 * @module modules/core/mcp/cli
 */

import { Command } from 'commander';
import type { MCPModule } from '../index.js';

export function createExecuteCommand(module: MCPModule): Command {
  const cmd = new Command('execute')
    .description('Execute MCP components');
  
  // Execute tool
  cmd.command('tool')
    .description('Execute a tool')
    .requiredOption('-n, --name <name>', 'Tool name')
    .requiredOption('-a, --args <args>', 'Tool arguments (JSON string)')
    .option('-c, --context <context>', 'Execution context (JSON string)')
    .action(async (options) => {
      try {
        // Parse arguments
        let args: any;
        try {
          args = JSON.parse(options.args);
        } catch (error) {
          console.error('Error: Invalid JSON for arguments');
          process.exit(1);
        }
        
        // Parse context if provided
        let context: any = undefined;
        if (options.context) {
          try {
            context = JSON.parse(options.context);
          } catch (error) {
            console.error('Error: Invalid JSON for context');
            process.exit(1);
          }
        }
        
        console.log(`\nExecuting tool: ${options.name}`);
        console.log('Arguments:', JSON.stringify(args, null, 2));
        if (context) {
          console.log('Context:', JSON.stringify(context, null, 2));
        }
        console.log();
        
        // Execute tool
        const result = await module.executeTool(options.name, args, context);
        
        if (result.success) {
          console.log('✓ Success\n');
          console.log('Result:', JSON.stringify(result.data, null, 2));
          if (result.metadata) {
            console.log('\nMetadata:', JSON.stringify(result.metadata, null, 2));
          }
        } else {
          console.error('✗ Failed\n');
          console.error('Error:', result.error?.message);
          if (result.error?.details) {
            console.error('Details:', JSON.stringify(result.error.details, null, 2));
          }
          process.exit(1);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
  
  // Execute prompt
  cmd.command('prompt')
    .description('Execute a prompt')
    .requiredOption('-n, --name <name>', 'Prompt name')
    .option('-a, --args <args>', 'Prompt arguments (JSON string)')
    .action(async (options) => {
      try {
        // Parse arguments if provided
        let args: any = {};
        if (options.args) {
          try {
            args = JSON.parse(options.args);
          } catch (error) {
            console.error('Error: Invalid JSON for arguments');
            process.exit(1);
          }
        }
        
        console.log(`\nExecuting prompt: ${options.name}`);
        if (Object.keys(args).length > 0) {
          console.log('Arguments:', JSON.stringify(args, null, 2));
        }
        console.log();
        
        // Get prompt
        const result = await module.getPrompt(options.name, args);
        
        console.log('Result:');
        console.log(JSON.stringify(result, null, 2));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}