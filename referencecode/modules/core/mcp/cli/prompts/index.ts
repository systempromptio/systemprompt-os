/**
 * @fileoverview MCP prompts CLI commands
 * @module modules/core/mcp/cli/prompts
 */

import { Command } from 'commander';
import type { MCPModule } from '../../index.js';
import { createPromptsListCommand } from './list.js';
import { createPromptsSearchCommand } from './search.js';
import { createPromptsGetCommand } from './get.js';
import { createPromptsCreateCommand } from './create.js';
import { createPromptsUpdateCommand } from './update.js';
import { createPromptsDeleteCommand } from './delete.js';

export function createPromptsCommand(module: MCPModule): Command {
  const cmd = new Command('prompts')
    .description('Manage MCP prompts');

  // Add subcommands
  cmd.addCommand(createPromptsListCommand(module));
  cmd.addCommand(createPromptsSearchCommand(module));
  cmd.addCommand(createPromptsGetCommand(module));
  cmd.addCommand(createPromptsCreateCommand(module));
  cmd.addCommand(createPromptsUpdateCommand(module));
  cmd.addCommand(createPromptsDeleteCommand(module));

  return cmd;
}