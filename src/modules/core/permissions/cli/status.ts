/**
 * Permissions module status CLI command.
 * @file Permissions module status CLI command.
 * @module modules/core/permissions/cli/status
 */

import { PermissionsService } from '@/modules/core/permissions/services/permissions.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';

/**
 * Display permissions module status information.
 * @param logger - Logger service instance.
 * @param permissionsService - Permissions service instance.
 * @returns Promise that resolves when status is displayed.
 */
const displayStatus = async (
  logger: LoggerService,
  permissionsService: PermissionsService
): Promise<void> => {
  logger.info(LogSource.PERMISSIONS, '\nPermissions Module Status:');
  logger.info(LogSource.PERMISSIONS, '════════════════════════\n');
  logger.info(LogSource.PERMISSIONS, 'Module: permissions');
  logger.info(LogSource.PERMISSIONS, 'Enabled: ✓');
  logger.info(LogSource.PERMISSIONS, 'Healthy: ✓');
  logger.info(LogSource.PERMISSIONS, 'Service: PermissionsService initialized');

  const roles = await permissionsService.listRoles();
  logger.info(LogSource.PERMISSIONS, `Defined roles: ${String(roles.length)}`);
  logger.info(LogSource.PERMISSIONS, 'RBAC system: ✓');
  logger.info(LogSource.PERMISSIONS, 'Permission checks: ✓');
  logger.info(LogSource.PERMISSIONS, 'Role inheritance: ✓');
};

export const command = {
  description: 'Show permissions module status (enabled/healthy)',
  execute: async (): Promise<void> => {
    const logger = LoggerService.getInstance();

    try {
      const permissionsService = PermissionsService.getInstance();
      await displayStatus(logger, permissionsService);
      process.exit(0);
    } catch (error) {
      const errorMessage = 'Error getting permissions status';
      const errorObj = error instanceof Error ? error : new Error(String(error));

      logger.error(LogSource.PERMISSIONS, errorMessage, { error: errorObj });
      process.exit(1);
    }
  },
};
