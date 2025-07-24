/**
 * @fileoverview MCP tools CLI commands
 * @module modules/core/mcp/cli/tools
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';
import { createToolsListCommand } from './list.js';
import { createToolsSearchCommand } from './search.js';
import { createToolsTestCommand } from './test.js';
import { createToolsInfoCommand } from './info.js';
import { createToolsEnableCommand } from './enable.js';
import { createToolsDisableCommand } from './disable.js';
import { createToolsRefreshCommand } from './refresh.js';

export function createToolsCommand(module: MCPModule): Command {
  const cmd = new Command('tools')
    .description('Manage MCP tools');
  
  // Add subcommands
  cmd.addCommand(createToolsListCommand(module));
  cmd.addCommand(createToolsSearchCommand(module));
  cmd.addCommand(createToolsTestCommand(module));
  cmd.addCommand(createToolsInfoCommand(module));
  cmd.addCommand(createToolsEnableCommand(module));
  cmd.addCommand(createToolsDisableCommand(module));
  cmd.addCommand(createToolsRefreshCommand(module));
  
  return cmd;
}