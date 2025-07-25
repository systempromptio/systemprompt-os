/* eslint-disable systemprompt-os/no-block-comments */
/**
 * Development tools module exports.
 * Provides development utilities for the SystemPrompt OS.
 */

import { getCommands } from '@/modules/core/dev/cli/index';
import { DevService } from '@/modules/core/dev/services/dev.service';

/**
 * Initialize function for core module pattern.
 * @returns Promise that resolves when initialized.
 */
export const initialize = async (): Promise<void> => {
  const service = DevService.getInstance();
  await service.initialize();
};

/**
 * Export CLI commands for module loader.
 */
export { getCommands };

/**
 * Export service for external use.
 */
export { DevService };
