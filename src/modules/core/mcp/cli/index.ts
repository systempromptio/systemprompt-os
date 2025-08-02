/**
 * MCP Module CLI Commands
 */

import type { ICLICommand } from '@/modules/core/cli/types/manual';
import { command as seedCommand } from './seed';
import { command as listCommand } from './list';
import { command as createCommand } from './create';
import { command as validateCommand } from './validate';

export const cliCommands: ICLICommand[] = [
  { name: 'seed', ...seedCommand },
  { name: 'list', ...listCommand },
  { name: 'create', ...createCommand },
  { name: 'validate', ...validateCommand },
];