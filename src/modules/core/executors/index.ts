/* eslint-disable systemprompt-os/enforce-file-naming, systemprompt-os/no-block-comments */
/**
 * Executors module exports.
 * This is a bare-bones template module for future executor functionality.
 */

import { getCommands } from '@/modules/core/executors/cli/index.js';
import { ExecutorService } from '@/modules/core/executors/services/executor.service.js';

/**
 * Initialize function for core module pattern.
 * @returns Promise that resolves when initialized.
 */
export const initialize = async (): Promise<void> => {
  const service = ExecutorService.getInstance();
  await service.initialize();
};

/**
 * Export CLI commands for module loader.
 */
export { getCommands };

/**
 * Export service for external use.
 */
export { ExecutorService };

/**
 * Re-export enums for convenience.
 */
export {
  ExecutorTypeEnum,
  ExecutorStatusEnum,
  ExecutorRunStatusEnum
} from '@/modules/core/executors/types/index.js';
