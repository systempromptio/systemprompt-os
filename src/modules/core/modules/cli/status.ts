/**
 * Module status CLI command.
 * @file Module status CLI command.
 * @module modules/core/modules/cli/status
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Show module status (enabled/healthy)',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    
    try {
      const moduleManager = ModuleManagerService.getInstance();
      const modules = await moduleManager.getAllModules();
      
      console.log('\nModules Module Status:');
      console.log('═════════════════════\n');
      console.log('Module: modules');
      console.log('Enabled: ✓');
      console.log('Healthy: ✓');
      console.log('Service: ModuleManagerService initialized');
      console.log(`Total modules managed: ${modules.length}`);
      console.log(`Enabled modules: ${modules.filter(m => m.enabled).length}`);
      console.log(`Disabled modules: ${modules.filter(m => !m.enabled).length}`);
      console.log(`Core modules: ${modules.filter(m => m.type === 'core').length}`);
      console.log(`Extension modules: ${modules.filter(m => m.type === 'extension').length}`);
      
      process.exit(0);
    } catch (error) {
      logger.error(LogSource.MODULES, 'Error getting module status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      console.error('Error getting module status:', error);
      process.exit(1);
    }
  },
};