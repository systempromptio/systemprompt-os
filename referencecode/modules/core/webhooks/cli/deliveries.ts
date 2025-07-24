/**
 * @fileoverview View webhook deliveries command
 * @module modules/core/webhooks/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { args, options = {} } = context;

    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const webhooksModule = moduleLoader.getModule('webhooks');

    if (!webhooksModule) {
      console.error('Webhooks module not found');
      process.exit(1);
    }

    const webhookId = args['id'];
    if (!webhookId) {
      console.error('Webhook ID is required');
      process.exit(1);
    }

    try {
      const webhookService = webhooksModule.exports?.WebhookService;
      if (!webhookService) {
        console.error('Webhook service not available');
        process.exit(1);
      }

      const limit = options['limit'] || 20;
      const deliveries = await webhookService.getWebhookDeliveries(webhookId, limit);

      if (options['format'] === 'json') {
        console.log(JSON.stringify(deliveries, null, 2));
      } else {
        // Table format
        if (deliveries.length === 0) {
          console.log('No deliveries found');
          return;
        }

        // Header
        console.log(`\nWebhook Deliveries (Latest ${limit}):`);
        console.log('─'.repeat(140));
        console.log(
          `${'ID'.padEnd(25) +
            'Event'.padEnd(20) +
            'Status'.padEnd(10) +
            'Code'.padEnd(6) +
            'Attempt'.padEnd(8) +
            'Duration'.padEnd(10) +
            'Delivered At'.padEnd(20) 
            }Error`,
        );
        console.log('─'.repeat(140));

        // Rows
        deliveries.forEach((delivery: any) => {
          const status = delivery.success ? '✓ Success' : '✗ Failed';
          const statusCode = delivery.status_code || '-';
          const duration = delivery.duration ? `${delivery.duration}ms` : '-';
          const error = delivery.error ? delivery.error.slice(0, 40) : '';

          console.log(
            delivery.id.padEnd(25) +
              delivery.event.slice(0, 19).padEnd(20) +
              status.padEnd(10) +
              statusCode.toString().padEnd(6) +
              delivery.attempt.toString().padEnd(8) +
              duration.padEnd(10) +
              delivery.delivered_at.toISOString().slice(0, 19).padEnd(20) +
              error,
          );

          // Show additional error details if needed
          if (delivery.error && delivery.error.length > 40) {
            console.log(`  └─ ${delivery.error.slice(40)}`);
          }
        });

        console.log('─'.repeat(140));

        // Summary
        const successful = deliveries.filter((d: any) => d.success).length;
        const failed = deliveries.filter((d: any) => !d.success).length;
        console.log(`Summary: ${successful} successful, ${failed} failed\n`);
      }
    } catch (error) {
      console.error(
        'Failed to get deliveries:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      process.exit(1);
    }
  },
};
