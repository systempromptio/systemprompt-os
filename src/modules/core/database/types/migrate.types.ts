/**
 * Type definitions for database migrate CLI command.
 * @file Type definitions for database migrate CLI command.
 * @module modules/core/database/types
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';

/**
 * Options for the migrate command.
 */
export interface IMigrateOptions {
  'dry-run'?: boolean;
  module?: string;
}

/**
 * Context for the migrate command execution.
 */
export interface IMigrateContext extends ICLIContext {
  args: Record<string, unknown> & {
    'dry-run'?: boolean;
    module?: string;
  };
}
