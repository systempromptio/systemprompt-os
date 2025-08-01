/**
 * Logger module CLI command registration.
 * @file CLI command exports for logger module.
 * @module modules/core/logger/cli/index
 */

import type { ICLICommand } from '@/modules/core/cli/types/manual';

// Import all commands
import { command as statusCommand } from '@/modules/core/logger/cli/status';
import { command as showCommand } from '@/modules/core/logger/cli/show';
import { command as clearCommand } from '@/modules/core/logger/cli/clear';

export const commands: Record<string, ICLICommand> = {
  status: statusCommand,
  show: showCommand,
  clear: clearCommand,
};

export const commandMetadata = {
  module: 'logger',
  description: 'Logger management and log viewing commands',
  commands: Object.keys(commands),
};
