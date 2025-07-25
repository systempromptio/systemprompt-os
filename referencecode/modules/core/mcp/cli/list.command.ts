/**
 * @fileoverview MCP list commands
 * @module modules/core/mcp/cli
 */

import { Command } from 'commander';
import Table from 'cli-table3';
import type { MCPModule } from '../index.js';

export function createListCommand(module: MCPModule): Command {
  const cmd = new Command('list')
    .description('List MCP components');

  // List tools
  cmd.command('tools')
    .description('List all available tools')
    .option('-c, --category <category>', 'Filter by category')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const tools = await module.listTools();

        // Filter by category if specified
        let filteredTools = tools;
        if (options.category) {
          filteredTools = tools.filter(tool =>
            tool.metadata?.category === options.category,
          );
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(filteredTools, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(filteredTools));
        } else {
          // Table format
          const table = new Table({
            head: ['Name', 'Description', 'Category', 'Auth Required'],
            colWidths: [30, 50, 20, 15],
          });

          for (const tool of filteredTools) {
            table.push([
              tool.name,
              tool.description || '-',
              tool.metadata?.category || 'default',
              tool.metadata?.requiresAuth ? 'Yes' : 'No',
            ]);
          }

          console.log(table.toString());
          console.log(`\nTotal: ${filteredTools.length} tool(s)`);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  // List prompts
  cmd.command('prompts')
    .description('List all available prompts')
    .option('-c, --category <category>', 'Filter by category')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const prompts = await module.listPrompts();

        // Filter by category if specified
        let filteredPrompts = prompts;
        if (options.category) {
          filteredPrompts = prompts.filter(prompt =>
            prompt.metadata?.category === options.category,
          );
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(filteredPrompts, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(filteredPrompts));
        } else {
          // Table format
          const table = new Table({
            head: ['Name', 'Description', 'Arguments', 'Category'],
            colWidths: [30, 50, 30, 20],
          });

          for (const prompt of filteredPrompts) {
            const args = prompt.arguments?.map((a: any) => a.name).join(', ') || '-';
            table.push([
              prompt.name,
              prompt.description || '-',
              args,
              prompt.metadata?.category || 'default',
            ]);
          }

          console.log(table.toString());
          console.log(`\nTotal: ${filteredPrompts.length} prompt(s)`);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  // List resources
  cmd.command('resources')
    .description('List all available resources')
    .option('-t, --type <type>', 'Filter by resource type')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const resources = await module.listResources();

        // Filter by type if specified
        let filteredResources = resources;
        if (options.type) {
          filteredResources = resources.filter(resource =>
            resource.mimeType === options.type,
          );
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(filteredResources, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = await import('js-yaml');
          console.log(yaml.dump(filteredResources));
        } else {
          // Table format
          const table = new Table({
            head: ['URI', 'Name', 'Type', 'Description'],
            colWidths: [40, 30, 20, 40],
          });

          for (const resource of filteredResources) {
            table.push([
              resource.uri,
              resource.name,
              resource.mimeType || 'text/plain',
              resource.description || '-',
            ]);
          }

          console.log(table.toString());
          console.log(`\nTotal: ${filteredResources.length} resource(s)`);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}