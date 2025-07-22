/**
 * @fileoverview Revoke API key command
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

    const key = args.key || options.key;
    if (!key) {
      console.error('API key is required');
      process.exit(1);
    }

    try {
      const apiKeyService = apiModule.exports?.ApiKeyService;
      if (!apiKeyService) {
        console.error('API key service not available');
        process.exit(1);
      }

      // Confirm revocation
      if (!options.force) {
        console.log(`\nWARNING: This will permanently revoke the API key.`);
        console.log('Use --force to skip this confirmation.\n');
        
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        await new Promise<void>((resolve) => {
          rl.question('Type "revoke" to confirm: ', (answer: string) => {
            rl.close();
            if (answer.toLowerCase() !== 'revoke') {
              console.log('Revocation cancelled');
              process.exit(0);
            }
            resolve();
          });
        });
      }

      await apiKeyService.revokeApiKey(key, options.reason);
      
      console.log('\n✓ API key revoked successfully');
      
      if (options.reason) {
        console.log(`  Reason: ${options.reason}`);
      }
    } catch (error) {
      console.error('Failed to revoke API key:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};