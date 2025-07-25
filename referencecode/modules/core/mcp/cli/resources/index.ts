/**
 * @fileoverview MCP resources CLI commands
 * @module modules/core/mcp/cli/resources
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';
import { createResourcesListCommand } from './list.js';
import { createResourcesSearchCommand } from './search.js';
import { createResourcesGetCommand } from './get.js';
import { createResourcesCreateCommand } from './create.js';
import { createResourcesUpdateCommand } from './update.js';
import { createResourcesDeleteCommand } from './delete.js';

export function createResourcesCommand(module: MCPModule): Command {
  const cmd = new Command('resources')
    .description('Manage MCP resources');

  // Add subcommands
  cmd.addCommand(createResourcesListCommand(module));
  cmd.addCommand(createResourcesSearchCommand(module));
  cmd.addCommand(createResourcesGetCommand(module));
  cmd.addCommand(createResourcesCreateCommand(module));
  cmd.addCommand(createResourcesUpdateCommand(module));
  cmd.addCommand(createResourcesDeleteCommand(module));

  return cmd;
}