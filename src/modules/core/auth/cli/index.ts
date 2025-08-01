/**
 * Auth module CLI command registration.
 * @file CLI command exports for auth module.
 * @module modules/core/auth/cli/index
 */

import type { ICLICommand } from '@/modules/core/cli/types/index';

// Import all commands
import { command as statusCommand } from './status';
import { command as sessionCreateCommand } from './session-create';
import { command as sessionListCommand } from './session-list';
import { command as sessionValidateCommand } from './session-validate';
import { command as sessionRevokeCommand } from './session-revoke';
import { command as authenticateCommand } from './authenticate';
import { command as providersListCommand } from './providers-list';

export const commands: Record<string, ICLICommand> = {
  status: statusCommand,
  'session:create': sessionCreateCommand,
  'session:list': sessionListCommand,
  'session:validate': sessionValidateCommand,
  'session:revoke': sessionRevokeCommand,
  authenticate: authenticateCommand,
  'providers:list': providersListCommand,
};

export const commandMetadata = {
  module: 'auth',
  description: 'Authentication and session management commands',
  commands: Object.keys(commands),
};