/**
 * @fileoverview MCP CLI commands
 * @module modules/core/mcp/cli
 */

import { Command } from 'commander';
import type { MCPModule } from '../index.js';
import { createInfoCommand } from './info.command.js';
import { createListCommand } from './list.command.js';
import { createExecuteCommand } from './execute.command.js';
import { createStatsCommand } from './stats.command.js';
import { createDiscoverCommand } from './discover.command.js';
import { createCacheCommand } from './cache.command.js';
import { createTestCommand } from './test.command.js';

export function createMCPCommand(module: MCPModule): Command {
  const cmd = new Command('mcp')
    .description('Model Context Protocol integration');
  
  // Add subcommands
  cmd.addCommand(createInfoCommand(module));
  cmd.addCommand(createListCommand(module));
  cmd.addCommand(createExecuteCommand(module));
  cmd.addCommand(createStatsCommand(module));
  cmd.addCommand(createDiscoverCommand(module));
  cmd.addCommand(createCacheCommand(module));
  cmd.addCommand(createTestCommand(module));
  
  return cmd;
}