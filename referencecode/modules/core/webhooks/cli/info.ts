/**
 * @fileoverview Get webhook info command
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

      const webhook = await webhookService.getWebhook(webhookId);

      if (!webhook) {
        console.error('Webhook not found');
        process.exit(1);
      }

      if (options['format'] === 'json') {
        console.log(JSON.stringify(webhook, null, 2));
      } else {
        console.log('\nWebhook Information:');
        console.log('═'.repeat(60));
        console.log(`ID:          ${webhook.id}`);
        console.log(`Name:        ${webhook.name}`);
        console.log(`URL:         ${webhook.url}`);
        console.log(`Method:      ${webhook.method}`);
        console.log(`Status:      ${webhook.status}`);
        console.log(`Timeout:     ${webhook.timeout}ms`);
        console.log(`Created:     ${webhook.created_at.toISOString()}`);
        console.log(`Updated:     ${webhook.updated_at.toISOString()}`);

        console.log(`\nEvents (${webhook.events.length}):`);
        webhook.events.forEach((event: string) => {
          console.log(`  - ${event}`);
        });

        if (Object.keys(webhook.headers).length > 0) {
          console.log('\nCustom Headers:');
          Object.entries(webhook.headers).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }

        if (webhook.auth && webhook.auth.type !== 'none') {
          console.log('\nAuthentication:');
          console.log(`  Type: ${webhook.auth.type}`);
          if (webhook.auth.type === 'api-key' && webhook.auth.credentials?.header_name) {
            console.log(`  Header: ${webhook.auth.credentials.header_name}`);
          }
        }

        if (webhook.retry) {
          console.log('\nRetry Configuration:');
          console.log(`  Enabled: ${webhook.retry.enabled}`);
          console.log(`  Max Attempts: ${webhook.retry.max_attempts}`);
          console.log(`  Strategy: ${webhook.retry.strategy}`);
          console.log(`  Initial Delay: ${webhook.retry.initial_delay}ms`);
          if (webhook.retry.max_delay) {
            console.log(`  Max Delay: ${webhook.retry.max_delay}ms`);
          }
        }

        // Get and show statistics
        try {
          const stats = await webhookService.getWebhookStats(webhookId);
          console.log('\nDelivery Statistics:');
          console.log('─'.repeat(60));
          console.log(`Total Deliveries:    ${stats.total_deliveries}`);
          console.log(`Successful:          ${stats.successful_deliveries}`);
          console.log(`Failed:              ${stats.failed_deliveries}`);
          if (stats.total_deliveries > 0) {
            console.log(
              `Success Rate:        ${((stats.successful_deliveries / stats.total_deliveries) * 100).toFixed(1)}%`,
            );
            console.log(`Avg Response Time:   ${stats.average_duration}ms`);
          }
          if (stats.last_delivery) {
            console.log(`Last Delivery:       ${stats.last_delivery.toISOString()}`);
          }
          if (stats.last_success) {
            console.log(`Last Success:        ${stats.last_success.toISOString()}`);
          }
          if (stats.last_failure) {
            console.log(`Last Failure:        ${stats.last_failure.toISOString()}`);
          }
        } catch (error) {
          // Stats fetch failed, but don't fail the whole command
        }
      }
    } catch (error) {
      console.error(
        'Failed to get webhook info:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      process.exit(1);
    }
  },
};
