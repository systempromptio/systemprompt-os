/**
 * @fileoverview View webhook statistics command
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

    const webhookId = args.id;
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

      const stats = await webhookService.getWebhookStats(webhookId);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(`\nWebhook Statistics: ${webhook.name}`);
        console.log('═'.repeat(60));
        console.log(`Webhook ID:          ${webhookId}`);
        console.log(`Total Deliveries:    ${stats.total_deliveries}`);
        console.log(`Successful:          ${stats.successful_deliveries}`);
        console.log(`Failed:              ${stats.failed_deliveries}`);
        
        if (stats.total_deliveries > 0) {
          const successRate = ((stats.successful_deliveries / stats.total_deliveries) * 100).toFixed(1);
          console.log(`Success Rate:        ${successRate}%`);
          console.log(`Failure Rate:        ${stats.failure_rate.toFixed(1)}%`);
          console.log(`Avg Response Time:   ${stats.average_duration}ms`);
          
          // Visual success rate bar
          const barLength = 40;
          const filledLength = Math.round((parseFloat(successRate) / 100) * barLength);
          const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
          
          console.log('\nSuccess Rate:');
          console.log(`[${bar}] ${successRate}%`);
        }
        
        if (stats.last_delivery) {
          console.log(`\nLast Delivery:       ${stats.last_delivery.toISOString()}`);
        }
        if (stats.last_success) {
          console.log(`Last Success:        ${stats.last_success.toISOString()}`);
        }
        if (stats.last_failure) {
          console.log(`Last Failure:        ${stats.last_failure.toISOString()}`);
        }

        // Show recent deliveries summary if there are any
        if (stats.total_deliveries > 0) {
          console.log('\nDelivery Trend:');
          console.log('Use "prompt webhooks:deliveries ' + webhookId + '" to see detailed history');
        }
      }
    } catch (error) {
      console.error('Failed to get webhook stats:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};