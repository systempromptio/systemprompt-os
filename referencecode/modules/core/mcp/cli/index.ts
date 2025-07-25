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
import { createCapabilitiesCommand } from './capabilities.js';
import { createServersCommand } from './servers/index.js';
import { createToolsCommand } from './tools/index.js';
import { createPromptsCommand } from './prompts/index.js';
import { createResourcesCommand } from './resources/index.js';

export function createMCPCommand(module: MCPModule): Command {
  const cmd = new Command('mcp')
    .description('Model Context Protocol integration');

  // Add domain-specific subcommands (new structure)
  cmd.addCommand(createServersCommand(module));
  cmd.addCommand(createToolsCommand(module));
  cmd.addCommand(createPromptsCommand(module));
  cmd.addCommand(createResourcesCommand(module));
  cmd.addCommand(createCapabilitiesCommand(module));

  // Add general commands
  cmd.addCommand(createInfoCommand(module));
  cmd.addCommand(createStatsCommand(module));
  cmd.addCommand(createDiscoverCommand(module));
  cmd.addCommand(createCacheCommand(module));

  // Keep legacy commands for backward compatibility (will be deprecated)
  cmd.addCommand(createListCommand(module));
  cmd.addCommand(createExecuteCommand(module));
  cmd.addCommand(createTestCommand(module));

  return cmd;
}