/**
 * @fileoverview Create webhook command
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

    if (!options.name || !options.url || !options.events) {
      console.error('Missing required options: --name, --url, and --events');
      process.exit(1);
    }

    try {
      const webhookService = webhooksModule.exports?.WebhookService;
      if (!webhookService) {
        console.error('Webhook service not available');
        process.exit(1);
      }

      // Parse events
      const events = options.events.split(',').map((e: string) => e.trim());

      // Parse headers if provided
      let headers = {};
      if (options.headers) {
        try {
          headers = JSON.parse(options.headers);
        } catch (error) {
          console.error('Invalid headers JSON format');
          process.exit(1);
        }
      }

      // Parse auth if provided
      let auth;
      if (options['auth-type'] && options['auth-type'] !== 'none') {
        auth = {
          type: options['auth-type'],
          credentials: {}
        };

        if (options['auth-credentials']) {
          try {
            auth.credentials = JSON.parse(options['auth-credentials']);
          } catch (error) {
            console.error('Invalid auth credentials JSON format');
            process.exit(1);
          }
        }
      }

      const webhook = await webhookService.createWebhook({
        name: options.name,
        url: options.url,
        method: options.method || 'POST',
        events,
        headers,
        auth
      });

      console.log('\n✓ Webhook created successfully!\n');
      console.log('Details:');
      console.log(`  ID: ${webhook.id}`);
      console.log(`  Name: ${webhook.name}`);
      console.log(`  URL: ${webhook.url}`);
      console.log(`  Method: ${webhook.method}`);
      console.log(`  Status: ${webhook.status}`);
      console.log(`  Events: ${webhook.events.join(', ')}`);
      
      if (webhook.auth?.type && webhook.auth.type !== 'none') {
        console.log(`  Auth: ${webhook.auth.type}`);
      }

      console.log('\nUse the following command to test your webhook:');
      console.log(`  prompt webhooks:test ${webhook.id}`);
    } catch (error) {
      console.error('Failed to create webhook:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};