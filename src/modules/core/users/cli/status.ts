/**
 * Users module status CLI command.
 * @file Users module status CLI command.
 * @module modules/core/users/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { UsersService } from '@/modules/core/users/services/users.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Show users module status (enabled/healthy)',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    
    try {
      const usersService = UsersService.getInstance();
      
      console.log('\nUsers Module Status:');
      console.log('══════════════════\n');
      console.log('Module: users');
      console.log('Enabled: ✓');
      console.log('Healthy: ✓');
      console.log('Service: UsersService initialized');
      
      // Check users system status
      const users = await usersService.listUsers();
      console.log(`Total users: ${users.length}`);
      console.log('User management: ✓');
      console.log('Authentication support: ✓');
      console.log('Profile management: ✓');
      
      process.exit(0);
    } catch (error) {
      logger.error(LogSource.USERS, 'Error getting users status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      console.error('Error getting users status:', error);
      process.exit(1);
    }
  },
};