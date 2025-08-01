/**
 * Modules CLI Commands Index
 * Central registration for all modules CLI commands.
 * @file Modules/core/modules/cli/index.ts.
 */

import type { ICLICommand } from '@/modules/core/cli/types/manual';

// Import all commands
import { command as statusCommand } from '@/modules/core/modules/cli/status';
import { command as listCommand } from '@/modules/core/modules/cli/list';
import { command as setupCommand } from '@/modules/core/modules/cli/setup';

export const commands: Record<string, ICLICommand> = {
  status: statusCommand,
  list: listCommand,
  setup: setupCommand,
};

export const commandMetadata = {
  module: 'modules',
  description: 'Module lifecycle management commands',
  commands: Object.keys(commands),
};

// Export individual commands for direct import
export { command as status } from '@/modules/core/modules/cli/status';
export { command as list } from '@/modules/core/modules/cli/list';
export { command as setup } from '@/modules/core/modules/cli/setup';

export default commandMetadata;
