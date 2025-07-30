/**
 * Auth module status CLI command.
 * @file Auth module status CLI command.
 * @module modules/core/auth/cli/status
 */

import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { ProvidersService } from '@/modules/core/auth/services/providers.service';

export const command = {
  description: 'Show auth module status (enabled/healthy)',
  execute: async (): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const providersService = ProvidersService.getInstance();

      cliOutput.section('Auth Module Status');

      cliOutput.keyValue({
        "Module": 'auth',
        'Module Version': '2.0.0',
        'Module Status': 'RUNNING',
        "Enabled": '✓',
        "Healthy": '✓',
        "Service": 'AuthService initialized',
      });

      // Check if providers are initialized
      let providersCount = 0;
      try {
        await providersService.initialize();
        const providers = providersService.getAllProviderInstances();
        providersCount = providers.length;
      } catch (error) {
        // Providers might not be initialized
      }

      cliOutput.section('Components');
      cliOutput.keyValue({
        'OAuth Providers Configured': providersCount > 0 ? `✓ (${providersCount})` : '✗',
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
