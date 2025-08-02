/**
 * MCP Module CLI Commands
 */

import type { ICliCommand } from '@/modules/core/cli/types/manual';
import { seedCommand } from './seed';
import { listCommand } from './list';
import { createCommand } from './create';

export const cliCommands: ICliCommand[] = [
  seedCommand,
  listCommand,
  createCommand,
];