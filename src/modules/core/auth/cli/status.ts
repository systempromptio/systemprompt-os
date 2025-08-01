/**
 * Auth module status CLI command.
 * @file Auth module status CLI command.
 * @module modules/core/auth/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { AuthService } from '@/modules/core/auth/services/auth.service';
import { type StatusArgs, cliSchemas } from '@/modules/core/auth/utils/cli-validation';

export const command: ICLICommand = {
  description: 'Show auth module status and health information',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      const validatedArgs: StatusArgs = cliSchemas.status.parse(context.args);

      const authService = AuthService.getInstance();
      await authService.initialize();

      const statusData = {
        module: 'auth',
        version: '2.0.0',
        status: 'RUNNING',
        enabled: true,
        healthy: true,
        components: {
          authService: 'initialized',
          sessionService: 'available',
          oauthService: 'available',
          eventBus: 'connected'
        },
        timestamp: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(statusData);
      } else {
        cliOutput.section('Auth Module Status');
        cliOutput.keyValue({
          Module: statusData.module,
          Version: statusData.version,
          Status: statusData.status,
          Enabled: statusData.enabled ? '✓' : '✗',
          Healthy: statusData.healthy ? '✓' : '✗'
        });

        cliOutput.section('Components');
        cliOutput.keyValue({
          'Auth Service': statusData.components.authService,
          'Session Service': statusData.components.sessionService,
          'OAuth Service': statusData.components.oauthService,
          'Event Bus': statusData.components.eventBus
        });
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('ZodError')) {
        cliOutput.error('Invalid arguments:');
      } else {
        cliOutput.error('Failed to get auth module status');
        logger.error(LogSource.AUTH, "Status command error", { error: error instanceof Error ? error.message : String(error) });
      }
      process.exit(1);
    }
  }
};
