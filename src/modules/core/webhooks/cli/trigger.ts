/**
 * @fileoverview Manually trigger webhook event command
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

    if (!options.event || !options.data) {
      console.error('Missing required options: --event and --data');
      process.exit(1);
    }

    try {
      const triggerWebhook = webhooksModule.exports?.triggerWebhook;
      if (!triggerWebhook) {
        console.error('Webhook trigger function not available');
        process.exit(1);
      }

      // Parse data
      let data;
      try {
        data = JSON.parse(options.data);
      } catch (error) {
        console.error('Invalid data JSON format');
        process.exit(1);
      }

      // Parse metadata if provided
      let metadata;
      if (options.metadata) {
        try {
          metadata = JSON.parse(options.metadata);
        } catch (error) {
          console.error('Invalid metadata JSON format');
          process.exit(1);
        }
      }

      console.log(`\nTriggering webhooks for event: ${options.event}`);
      console.log('─'.repeat(60));

      await triggerWebhook(options.event, data, metadata);

      console.log('\n✓ Webhook event triggered successfully');
      console.log('\nEvent details:');
      console.log(`  Event: ${options.event}`);
      console.log(`  Data: ${JSON.stringify(data, null, 2)}`);
      if (metadata) {
        console.log(`  Metadata: ${JSON.stringify(metadata, null, 2)}`);
      }
      
      console.log('\nNote: Webhook deliveries are processed asynchronously.');
      console.log('Use "prompt webhooks:deliveries <webhook-id>" to check delivery status.');
    } catch (error) {
      console.error('Failed to trigger webhook:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};