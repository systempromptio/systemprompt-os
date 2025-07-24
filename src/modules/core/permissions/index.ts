/* eslint-disable systemprompt-os/enforce-file-naming, systemprompt-os/no-block-comments */
/**
 * Permissions module exports.
 * Role-based access control and permissions management.
 */

import { getCommands } from '@/modules/core/permissions/cli/index.js';
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service.js';

/**
 * Initialize function for core module pattern.
 * @returns Promise that resolves when initialized.
 */
export const initialize = async (): Promise<void> => {
  const service = PermissionsService.getInstance();
  await service.initialize();
};

/**
 * Export CLI commands for module loader.
 */
export { getCommands };

/**
 * Export service for external use.
 */
export { PermissionsService };

/**
 * Re-export enums for convenience.
 */
export {
  PermissionActionEnum
} from '@/modules/core/permissions/types/index.js';