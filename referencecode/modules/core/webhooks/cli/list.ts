/**
 * @fileoverview List webhooks command
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
    const { options = {} } = context;

    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const webhooksModule = moduleLoader.getModule('webhooks');

    if (!webhooksModule) {
      console.error('Webhooks module not found');
      process.exit(1);
    }

    try {
      const webhookService = webhooksModule.exports?.WebhookService;
      if (!webhookService) {
        console.error('Webhook service not available');
        process.exit(1);
      }

      // Build filter
      const filter: any = {};
      if (options['status']) {
        filter['status'] = options['status'];
      }

      const webhooks = await webhookService.listWebhooks(filter);

      if (options['format'] === 'json') {
        console.log(JSON.stringify(webhooks, null, 2));
      } else {
        // Table format
        if (webhooks.length === 0) {
          console.log('No webhooks found');
          return;
        }

        // Filter by event if specified
        let filteredWebhooks = webhooks;
        if (options['event']) {
          filteredWebhooks = webhooks.filter((w: any) => w.events.includes(options['event']));
        }

        if (filteredWebhooks.length === 0) {
          console.log(`No webhooks found for event: ${options['event']}`);
          return;
        }

        // Header
        console.log('\nWebhooks:');
        console.log('─'.repeat(120));
        console.log(
          'ID'.padEnd(25) +
            'Name'.padEnd(25) +
            'URL'.padEnd(40) +
            'Status'.padEnd(10) +
            'Events'.padEnd(20),
        );
        console.log('─'.repeat(120));

        // Rows
        filteredWebhooks.forEach((webhook: any) => {
          console.log(
            webhook.id.padEnd(25) +
              webhook.name.slice(0, 24).padEnd(25) +
              webhook.url.slice(0, 39).padEnd(40) +
              webhook.status.padEnd(10) +
              webhook.events.slice(0, 3).join(', ').slice(0, 19).padEnd(20),
          );

          // Show additional info
          if (webhook.events.length > 3) {
            console.log(`  └─ +${webhook.events.length - 3} more events`);
          }

          if (webhook.auth?.type && webhook.auth.type !== 'none') {
            console.log(`  └─ Auth: ${webhook.auth.type}`);
          }
        });

        console.log('─'.repeat(120));
        console.log(`Total: ${filteredWebhooks.length} webhooks\n`);
      }
    } catch (error) {
      console.error(
        'Failed to list webhooks:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      process.exit(1);
    }
  },
};
