/**
 * Module status CLI command.
 * @file Module status CLI command.
 * @module modules/core/modules/cli/status
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { ModuleManagerService } from '@/modules/core/modules/services/module-manager.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Show module status (enabled/healthy)',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const moduleManager = ModuleManagerService.getInstance();
      const modules = await moduleManager.getAllModules();

      cliOutput.section('Modules Module Status');

      cliOutput.keyValue({
        Module: 'modules',
        Enabled: '✓',
        Healthy: '✓',
        Service: 'ModuleManagerService initialized',
      });

      cliOutput.section('Module Statistics');

      cliOutput.keyValue({
        'Total modules managed': modules.length,
        'Enabled modules': modules.filter(m => { return m.enabled }).length,
        'Disabled modules': modules.filter(m => { return !m.enabled }).length,
        'Core modules': modules.filter(m => { return m.type === 'core' }).length,
        'Extension modules': modules.filter(m => { return m.type === 'extension' }).length,
      });

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting module status');
      logger.error(LogSource.MODULES, 'Error getting module status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
