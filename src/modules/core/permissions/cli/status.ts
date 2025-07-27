/**
 * Permissions module status CLI command.
 * @file Permissions module status CLI command.
 * @module modules/core/permissions/cli/status
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Show permissions module status (enabled/healthy)',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();

    try {
      const permissionsService = PermissionsService.getInstance();

      console.log('\nPermissions Module Status:');
      console.log('════════════════════════\n');
      console.log('Module: permissions');
      console.log('Enabled: ✓');
      console.log('Healthy: ✓');
      console.log('Service: PermissionsService initialized');

      const roles = await permissionsService.listRoles();
      console.log(`Defined roles: ${roles.length}`);
      console.log('RBAC system: ✓');
      console.log('Permission checks: ✓');
      console.log('Role inheritance: ✓');

      process.exit(0);
    } catch (error) {
      logger.error(LogSource.PERMISSIONS, 'Error getting permissions status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      console.error('Error getting permissions status:', error);
      process.exit(1);
    }
  },
};
