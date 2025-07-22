/**
 * @fileoverview Reset rate limit command
 * @module modules/core/api/cli/ratelimit
 */

import { getModuleLoader } from '../../../../loader.js';

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
    const apiModule = moduleLoader.getModule('api');

    if (!apiModule) {
      console.error('API module not found');
      process.exit(1);
    }

    const keyId = args.key || options.key;
    if (!keyId) {
      console.error('API key ID is required');
      process.exit(1);
    }

    try {
      const rateLimitService = apiModule.exports?.RateLimitService;
      if (!rateLimitService) {
        console.error('Rate limit service not available');
        process.exit(1);
      }

      // Confirm reset
      if (!options.force) {
        console.log(`\nWARNING: This will reset the rate limit counter for key ${keyId}.`);
        console.log('Use --force to skip this confirmation.\n');
        
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        await new Promise<void>((resolve) => {
          rl.question('Type "reset" to confirm: ', (answer: string) => {
            rl.close();
            if (answer.toLowerCase() !== 'reset') {
              console.log('Reset cancelled');
              process.exit(0);
            }
            resolve();
          });
        });
      }

      await rateLimitService.resetRateLimit(keyId);
      
      console.log('\n✓ Rate limit reset successfully');
      
      // Show new status
      const status = await rateLimitService.getRateLimitStatus(keyId);
      console.log(`\nNew status:`);
      console.log(`  Requests Used: ${status.requests_used}/${status.rate_limit}`);
      console.log(`  Window Ends:   ${new Date(status.window_start.getTime() + status.window_size).toISOString()}`);
    } catch (error) {
      console.error('Failed to reset rate limit:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};