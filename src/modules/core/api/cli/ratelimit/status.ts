/**
 * @fileoverview Check rate limit status command
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

      const status = await rateLimitService.getRateLimitStatus(keyId);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log('\nRate Limit Status:');
        console.log('═'.repeat(60));
        console.log(`Key ID:            ${keyId}`);
        console.log(`Rate Limit:        ${status.rate_limit} requests/hour`);
        console.log(`Window Size:       ${status.window_size / 1000}s`);
        console.log(`Window Started:    ${status.window_start.toISOString()}`);
        console.log(`Window Ends:       ${new Date(status.window_start.getTime() + status.window_size).toISOString()}`);
        console.log();
        console.log(`Requests Used:     ${status.requests_used}/${status.rate_limit}`);
        console.log(`Requests Remaining: ${status.requests_remaining}`);
        
        // Visual progress bar
        const percentage = (status.requests_used / status.rate_limit) * 100;
        const barLength = 40;
        const filledLength = Math.round((percentage / 100) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        console.log();
        console.log(`Usage: [${bar}] ${percentage.toFixed(1)}%`);
        
        if (percentage >= 90) {
          console.log('\n⚠️  WARNING: Rate limit is nearly exhausted!');
        }
        
        // Time until reset
        const now = new Date();
        const resetTime = new Date(status.window_start.getTime() + status.window_size);
        const timeRemaining = resetTime.getTime() - now.getTime();
        
        if (timeRemaining > 0) {
          const minutes = Math.floor(timeRemaining / 60000);
          const seconds = Math.floor((timeRemaining % 60000) / 1000);
          console.log(`\nWindow resets in: ${minutes}m ${seconds}s`);
        }
      }
    } catch (error) {
      console.error('Failed to get rate limit status:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};