/**
 * @fileoverview Update rate limit command
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
    const newLimit = args.limit || options.limit;

    if (!keyId) {
      console.error('API key ID is required');
      process.exit(1);
    }

    if (!newLimit || isNaN(parseInt(newLimit))) {
      console.error('Valid rate limit number is required');
      process.exit(1);
    }

    const limit = parseInt(newLimit);
    if (limit < 1 || limit > 1000000) {
      console.error('Rate limit must be between 1 and 1,000,000');
      process.exit(1);
    }

    try {
      const apiKeyService = apiModule.exports?.ApiKeyService;
      if (!apiKeyService) {
        console.error('API key service not available');
        process.exit(1);
      }

      // Get current key info
      const keyInfo = await apiKeyService.getApiKey(keyId);
      if (!keyInfo) {
        console.error('API key not found');
        process.exit(1);
      }

      const oldLimit = keyInfo.rate_limit;

      // Update the rate limit
      await apiKeyService.updateRateLimit(keyId, limit);
      
      console.log('\n✓ Rate limit updated successfully');
      console.log(`\nAPI Key: ${keyInfo.name}`);
      console.log(`Old Limit: ${oldLimit} requests/hour`);
      console.log(`New Limit: ${limit} requests/hour`);
      
      // Show current rate limit status
      const rateLimitService = apiModule.exports?.RateLimitService;
      if (rateLimitService) {
        const status = await rateLimitService.getRateLimitStatus(keyId);
        console.log(`\nCurrent usage: ${status.requests_used}/${limit} requests`);
        
        if (status.requests_used > limit) {
          console.log('\n⚠️  WARNING: Current usage exceeds new limit!');
          console.log('The key will be rate limited until the window resets.');
        }
      }
    } catch (error) {
      console.error('Failed to update rate limit:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};