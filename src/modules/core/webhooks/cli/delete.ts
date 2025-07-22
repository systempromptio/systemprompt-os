/**
 * @fileoverview Delete webhook command
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

      // Get webhook info first
      const webhook = await webhookService.getWebhook(webhookId);
      if (!webhook) {
        console.error('Webhook not found');
        process.exit(1);
      }

      // Confirm deletion
      if (!options.force) {
        console.log(`\nWARNING: This will permanently delete the webhook "${webhook.name}".`);
        console.log('All delivery history will also be deleted.');
        console.log('Use --force to skip this confirmation.\n');
        
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        await new Promise<void>((resolve) => {
          rl.question('Type "delete" to confirm: ', (answer: string) => {
            rl.close();
            if (answer.toLowerCase() !== 'delete') {
              console.log('Deletion cancelled');
              process.exit(0);
            }
            resolve();
          });
        });
      }

      const deleted = await webhookService.deleteWebhook(webhookId);
      
      if (deleted) {
        console.log('\n✓ Webhook deleted successfully');
      } else {
        console.error('Failed to delete webhook');
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};