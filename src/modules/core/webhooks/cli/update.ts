/**
 * @fileoverview Update webhook command
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

      // Build update object
      const updates: any = {};

      if (options.name) updates.name = options.name;
      if (options.url) updates.url = options.url;
      if (options.status) updates.status = options.status;

      if (options.events) {
        updates.events = options.events.split(',').map((e: string) => e.trim());
      }

      if (options.headers) {
        try {
          updates.headers = JSON.parse(options.headers);
        } catch (error) {
          console.error('Invalid headers JSON format');
          process.exit(1);
        }
      }

      if (Object.keys(updates).length === 0) {
        console.error('No updates specified');
        process.exit(1);
      }

      const webhook = await webhookService.updateWebhook(webhookId, updates);
      
      if (!webhook) {
        console.error('Webhook not found');
        process.exit(1);
      }

      console.log('\n✓ Webhook updated successfully');
      console.log('\nUpdated fields:');
      Object.keys(updates).forEach(field => {
        console.log(`  ${field}: ${JSON.stringify(updates[field])}`);
      });

      console.log('\nCurrent configuration:');
      console.log(`  ID: ${webhook.id}`);
      console.log(`  Name: ${webhook.name}`);
      console.log(`  URL: ${webhook.url}`);
      console.log(`  Status: ${webhook.status}`);
      console.log(`  Events: ${webhook.events.join(', ')}`);
    } catch (error) {
      console.error('Failed to update webhook:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};