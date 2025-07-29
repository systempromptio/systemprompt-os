/**
 * Webhooks module status CLI command.
 * @file Webhooks module status CLI command.
 * @module modules/core/webhooks/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { WebhookService } from '@/modules/core/webhooks/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Show webhooks module status (enabled/healthy)',
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();

    try {
      WebhookService.getInstance();

      logger.info(LogSource.WEBHOOK, `\nWebhooks Module Status (CWD: ${context.cwd}):`);
      logger.info(LogSource.WEBHOOK, '═════════════════════\n');
      logger.info(LogSource.WEBHOOK, 'Module: webhooks');
      logger.info(LogSource.WEBHOOK, 'Enabled: ✓');
      logger.info(LogSource.WEBHOOK, 'Service: WebhookService initialized');

      process.exit(0);
    } catch (error) {
      logger.error(LogSource.WEBHOOK, 'Error getting webhooks status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};
