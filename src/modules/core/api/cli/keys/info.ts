/**
 * @fileoverview Get API key information command
 * @module modules/core/api/cli/keys
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

    const keyId = args.id || options.id;
    if (!keyId) {
      console.error('API key ID is required');
      process.exit(1);
    }

    try {
      const apiKeyService = apiModule.exports?.ApiKeyService;
      if (!apiKeyService) {
        console.error('API key service not available');
        process.exit(1);
      }

      const keyInfo = await apiKeyService.getApiKey(keyId);
      
      if (!keyInfo) {
        console.error('API key not found');
        process.exit(1);
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(keyInfo, null, 2));
      } else {
        console.log('\nAPI Key Information:');
        console.log('═'.repeat(60));
        console.log(`ID:          ${keyInfo.id}`);
        console.log(`Name:        ${keyInfo.name}`);
        console.log(`User:        ${keyInfo.user_id}`);
        console.log(`Status:      ${keyInfo.is_active ? '✓ Active' : '✗ Inactive'}`);
        console.log(`Prefix:      ${keyInfo.key_prefix}...`);
        console.log(`Rate Limit:  ${keyInfo.rate_limit} requests/hour`);
        console.log(`Created:     ${keyInfo.created_at.toISOString()}`);
        
        if (keyInfo.last_used_at) {
          console.log(`Last Used:   ${keyInfo.last_used_at.toISOString()}`);
        } else {
          console.log(`Last Used:   Never`);
        }
        
        if (keyInfo.expires_at) {
          const isExpired = keyInfo.expires_at < new Date();
          console.log(`Expires:     ${keyInfo.expires_at.toISOString()} ${isExpired ? '(EXPIRED)' : ''}`);
        }
        
        if (keyInfo.scopes.length > 0) {
          console.log(`\nScopes:`);
          keyInfo.scopes.forEach(scope => {
            console.log(`  - ${scope}`);
          });
        }

        // Get usage statistics
        if (!options['no-stats']) {
          console.log('\nUsage Statistics (last 24h):');
          console.log('─'.repeat(60));
          
          try {
            const usage = await apiKeyService.getApiKeyUsage(keyId, '24h');
            console.log(`Total Requests:    ${usage.total_requests}`);
            console.log(`Success Rate:      ${(100 - usage.error_rate).toFixed(1)}%`);
            console.log(`Avg Response Time: ${usage.average_response_time}ms`);
            
            if (usage.top_endpoints.length > 0) {
              console.log(`\nTop Endpoints:`);
              usage.top_endpoints.slice(0, 5).forEach(endpoint => {
                console.log(`  ${endpoint.method} ${endpoint.endpoint}: ${endpoint.request_count} requests`);
              });
            }
          } catch (error) {
            console.log('Unable to fetch usage statistics');
          }
        }

        // Check current rate limit status
        if (!options['no-ratelimit']) {
          console.log('\nRate Limit Status:');
          console.log('─'.repeat(60));
          
          try {
            const rateLimitService = apiModule.exports?.RateLimitService;
            if (rateLimitService) {
              const status = await rateLimitService.getRateLimitStatus(keyId);
              console.log(`Current Usage:     ${status.requests_used}/${status.rate_limit} requests`);
              console.log(`Window Resets:     ${new Date(status.window_start.getTime() + status.window_size).toISOString()}`);
              console.log(`Remaining:         ${status.requests_remaining} requests`);
            }
          } catch (error) {
            console.log('Unable to fetch rate limit status');
          }
        }
      }
    } catch (error) {
      console.error('Failed to get API key info:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};