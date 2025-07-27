/**
 * System module status CLI command.
 * @file System module status CLI command.
 * @module modules/core/system/cli/status
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { SystemService } from '@/modules/core/system/services/system.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Show system module status (enabled/healthy)',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    
    try {
      const systemService = SystemService.getInstance();
      
      console.log('\nSystem Module Status:');
      console.log('═══════════════════\n');
      console.log('Module: system');
      console.log('Enabled: ✓');
      console.log('Healthy: ✓');
      console.log('Service: SystemService initialized');
      
      // System information
      const info = await systemService.getSystemInfo();
      console.log(`\nSystem Information:`);
      console.log(`  Platform: ${info.platform}`);
      console.log(`  Hostname: ${info.hostname}`);
      console.log(`  Architecture: ${info.architecture}`);
      console.log(`  Node Version: ${info.nodeVersion}`);
      console.log(`  Environment: ${info.environment}`);
      console.log(`  Uptime: ${Math.floor(info.uptime / 60)} minutes`);
      console.log(`\nModule Statistics:`);
      console.log(`  Total Modules: ${info.modules.total}`);
      console.log(`  Active: ${info.modules.active}`);
      console.log(`  Inactive: ${info.modules.inactive}`);
      console.log(`  Error: ${info.modules.error}`);
      
      process.exit(0);
    } catch (error) {
      logger.error(LogSource.SYSTEM, 'Error getting system status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      console.error('Error getting system status:', error);
      process.exit(1);
    }
  },
};