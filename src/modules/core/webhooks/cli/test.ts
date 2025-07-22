/**
 * @fileoverview Test webhook command
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
    const { args } = context;
    
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

      console.log(`\nTesting webhook ${webhookId}...`);
      console.log('─'.repeat(60));

      const startTime = Date.now();
      const result = await webhookService.testWebhook(webhookId);
      
      console.log(`\nTest completed in ${result.duration}ms`);
      console.log('─'.repeat(60));
      
      if (result.success) {
        console.log('✓ Test PASSED');
        console.log(`\nStatus Code: ${result.status_code}`);
        
        if (result.response_headers) {
          console.log('\nResponse Headers:');
          Object.entries(result.response_headers).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
        
        if (result.response_body) {
          console.log('\nResponse Body:');
          // Pretty print JSON if possible
          try {
            const parsed = JSON.parse(result.response_body);
            console.log(JSON.stringify(parsed, null, 2));
          } catch {
            // Not JSON, print as is (limit to 500 chars)
            console.log(result.response_body.substring(0, 500));
            if (result.response_body.length > 500) {
              console.log('... (truncated)');
            }
          }
        }
      } else {
        console.log('✗ Test FAILED');
        
        if (result.error) {
          console.log(`\nError: ${result.error}`);
        }
        
        if (result.status_code) {
          console.log(`Status Code: ${result.status_code}`);
        }
        
        if (result.response_body) {
          console.log('\nResponse Body:');
          console.log(result.response_body.substring(0, 500));
          if (result.response_body.length > 500) {
            console.log('... (truncated)');
          }
        }
      }

      console.log('\nTest Payload:');
      console.log(JSON.stringify({
        test: true,
        message: 'This is a test webhook delivery'
      }, null, 2));
    } catch (error) {
      console.error('\nTest failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};