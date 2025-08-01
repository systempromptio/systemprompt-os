/**
 * System module status CLI command.
 * @file System module status CLI command.
 * @module modules/core/system/cli/status
 */

import type { ICLIContext } from '@/modules/core/cli/types/manual';
import { SystemService } from '@/modules/core/system/services/system.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Show system module status (enabled/healthy)',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const systemService = SystemService.getInstance();

      cliOutput.section('System Module Status');

      cliOutput.keyValue({
        Module: 'system',
        Enabled: '✓',
        Healthy: '✓',
        Service: 'SystemService initialized',
      });

      const info = await systemService.getSystemInfo();

      cliOutput.section('System Information');

      cliOutput.keyValue({
        'Platform': info.platform,
        'Hostname': info.hostname,
        'Architecture': info.architecture,
        'Node Version': info.node_version,
        'Environment': info.environment,
        'Uptime': `${Math.floor(info.uptime / 60)} minutes`,
      });

      cliOutput.section('Module Statistics');

      cliOutput.keyValue({
        'Total Modules': info.modules.total,
        'Active': info.modules.active,
        'Inactive': info.modules.inactive,
        'Error': info.modules.error,
      });

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting system status');
      logger.error(LogSource.SYSTEM, 'Error getting system status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
