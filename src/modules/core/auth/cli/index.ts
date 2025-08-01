/**
 * Auth module CLI command registration.
 * @file CLI command exports for auth module.
 * @module modules/core/auth/cli/index
 */

import type { ICLICommand } from '@/modules/core/cli/types/manual';

// Import all commands
import { command as statusCommand } from '@/modules/core/auth/cli/status';
import { command as sessionCreateCommand } from '@/modules/core/auth/cli/session-create';
import { command as sessionListCommand } from '@/modules/core/auth/cli/session-list';
import { command as sessionValidateCommand } from '@/modules/core/auth/cli/session-validate';
import { command as sessionRevokeCommand } from '@/modules/core/auth/cli/session-revoke';
import { command as authenticateCommand } from '@/modules/core/auth/cli/authenticate';
import { command as providersListCommand } from '@/modules/core/auth/cli/providers-list';

export const commands: Record<string, ICLICommand> = {
  "status": statusCommand,
  'session:create': sessionCreateCommand,
  'session:list': sessionListCommand,
  'session:validate': sessionValidateCommand,
  'session:revoke': sessionRevokeCommand,
  "authenticate": authenticateCommand,
  'providers:list': providersListCommand,
};

export const commandMetadata = {
  module: 'auth',
  description: 'Authentication and session management commands',
  commands: Object.keys(commands),
};
