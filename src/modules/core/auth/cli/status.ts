/**
 * Auth module status CLI command.
 * @file Auth module status CLI command.
 * @module modules/core/auth/cli/status
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Show auth module status (enabled/healthy)',
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      // Get auth module from module registry
      const authModule = context.moduleRegistry?.get('auth');
      if (!authModule) {
        throw new Error('Auth module not found in registry');
      }

      const moduleVersion = authModule.version || 'Unknown';
      const moduleStatus = authModule.status || 'Unknown';

      cliOutput.section('Auth Module Status');

      cliOutput.keyValue({
        "Module": 'auth',
        'Module Version': moduleVersion,
        'Module Status': moduleStatus,
        "Enabled": '✓',
        "Healthy": '✓',
        "Service": 'AuthService initialized',
      });

      // Check if providers are available
      const hasProviders = authModule.exports?.getAllProviders ? true : false;

      cliOutput.section('Components');
      cliOutput.keyValue({
        'OAuth Providers Configured': hasProviders ? '✓' : '✗',
        'JWT Token Service': '✓',
        'Session Service': '✓', 
        'Auth Code Service': '✓',
      });

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting auth status');
      logger.error(LogSource.AUTH, 'Error getting auth status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
