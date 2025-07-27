/**
 * List modules CLI command.
 * @file List modules CLI command.
 * @module modules/core/modules/cli/list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

const command: ICLICommand = {
  description: 'List installed extensions and modules',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    
    try {
      const moduleManager = ModuleManagerService.getInstance();
      const modules = await moduleManager.getAllModules();
      
      const typeFilter = args.type || 'all';
      const format = args.format || 'text';
      
      let filteredModules = modules;
      if (typeFilter !== 'all') {
        filteredModules = modules.filter(m => m.type === typeFilter);
      }
      
      if (format === 'json') {
        console.log(JSON.stringify(filteredModules, null, 2));
      } else {
        console.log('\nInstalled Modules:');
        console.log('═════════════════\n');
        
        if (filteredModules.length === 0) {
          console.log('No modules found.');
        } else {
          filteredModules.forEach(module => {
            console.log(`Name: ${module.name}`);
            console.log(`Type: ${module.type}`);
            console.log(`Version: ${module.version}`);
            console.log(`Status: ${module.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`Path: ${module.path}`);
            console.log(`─────────────────`);
          });
        }
        
        console.log(`\nTotal: ${filteredModules.length} modules`);
      }
      
      process.exit(0);
    } catch (error) {
      logger.error(LogSource.MODULES, 'Error listing modules', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      console.error('Error listing modules:', error);
      process.exit(1);
    }
  },
};

export { command };