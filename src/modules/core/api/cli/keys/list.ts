/**
 * @fileoverview List API keys command
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
    const { options = {} } = context;
    
    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const apiModule = moduleLoader.getModule('api');

    if (!apiModule) {
      console.error('API module not found');
      process.exit(1);
    }

    try {
      const apiKeyService = apiModule.exports?.ApiKeyService;
      if (!apiKeyService) {
        console.error('API key service not available');
        process.exit(1);
      }

      const keys = await apiKeyService.listApiKeys(options.user, options.active);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(keys, null, 2));
      } else {
        // Table format
        if (keys.length === 0) {
          console.log('No API keys found');
          return;
        }

        // Header
        console.log('\nAPI Keys:');
        console.log('─'.repeat(120));
        console.log(
          'ID'.padEnd(38) +
          'Name'.padEnd(25) +
          'User'.padEnd(20) +
          'Status'.padEnd(10) +
          'Rate Limit'.padEnd(12) +
          'Last Used'.padEnd(20) +
          'Created'
        );
        console.log('─'.repeat(120));

        // Rows
        keys.forEach(key => {
          const status = key.is_active ? 'Active' : 'Inactive';
          const lastUsed = key.last_used_at ? 
            key.last_used_at.toISOString().slice(0, 19) : 
            'Never';
          
          console.log(
            key.id.padEnd(38) +
            key.name.slice(0, 24).padEnd(25) +
            key.user_id.slice(0, 19).padEnd(20) +
            status.padEnd(10) +
            `${key.rate_limit}/hr`.padEnd(12) +
            lastUsed.padEnd(20) +
            key.created_at.toISOString().slice(0, 19)
          );

          // Show prefix
          console.log(`  └─ Prefix: ${key.key_prefix}...`);
          
          // Show scopes if any
          if (key.scopes.length > 0) {
            console.log(`     Scopes: ${key.scopes.join(', ')}`);
          }
          
          // Show expiry if set
          if (key.expires_at) {
            const isExpired = key.expires_at < new Date();
            const expiryStr = isExpired ? 'EXPIRED' : key.expires_at.toISOString().slice(0, 19);
            console.log(`     Expires: ${expiryStr}`);
          }
        });

        console.log('─'.repeat(120));
        console.log(`Total: ${keys.length} keys\n`);
      }
    } catch (error) {
      console.error('Failed to list API keys:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};