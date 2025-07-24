/* eslint-disable systemprompt-os/enforce-file-naming, systemprompt-os/no-block-comments */
/**
 * System module exports.
 * Core system management and configuration functionality.
 */

import { getCommands } from '@/modules/core/system/cli/index.js';
import { SystemService } from '@/modules/core/system/services/system.service.js';

/**
 * Initialize function for core module pattern.
 * @returns Promise that resolves when initialized.
 */
export const initialize = async (): Promise<void> => {
  const service = SystemService.getInstance();
  await service.initialize();
};

/**
 * Export CLI commands for module loader.
 */
export { getCommands };

/**
 * Export service for external use.
 */
export { SystemService };

/**
 * Re-export enums for convenience.
 */
export {
  ConfigTypeEnum,
  ModuleStatusEnum,
  EventSeverityEnum,
  MaintenanceTypeEnum
} from '@/modules/core/system/types/index.js';