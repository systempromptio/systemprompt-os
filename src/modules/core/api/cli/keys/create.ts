/**
 * @fileoverview Create API key command
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

    if (!options.name || !options.user) {
      console.error('Missing required options: --name and --user');
      process.exit(1);
    }

    try {
      const apiKeyService = apiModule.exports?.ApiKeyService;
      if (!apiKeyService) {
        console.error('API key service not available');
        process.exit(1);
      }

      // Parse scopes
      const scopes = options.scopes ? options.scopes.split(',').map((s: string) => s.trim()) : [];

      // Parse expiry
      let expiresIn: number | undefined;
      if (options.expires) {
        const match = options.expires.match(/^(\d+)([hdmy])$/);
        if (!match) {
          console.error('Invalid expiry format. Use format like "30d", "1y"');
          process.exit(1);
        }
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
          case 'h': expiresIn = value * 60 * 60 * 1000; break;
          case 'd': expiresIn = value * 24 * 60 * 60 * 1000; break;
          case 'm': expiresIn = value * 30 * 24 * 60 * 60 * 1000; break;
          case 'y': expiresIn = value * 365 * 24 * 60 * 60 * 1000; break;
        }
      }

      const keyInfo = await apiKeyService.createApiKey({
        user_id: options.user,
        name: options.name,
        scopes,
        rate_limit: options.limit,
        expires_in: expiresIn
      });

      console.log('\n✓ API key created successfully!\n');
      console.log('╔════════════════════════════════════════════════════════════════════╗');
      console.log('║                    SAVE THIS KEY - IT WON\'T BE SHOWN AGAIN         ║');
      console.log('╚════════════════════════════════════════════════════════════════════╝');
      console.log();
      console.log(`Key: ${keyInfo.key}`);
      console.log();
      console.log('Details:');
      console.log(`  ID: ${keyInfo.id}`);
      console.log(`  Name: ${keyInfo.name}`);
      console.log(`  User: ${keyInfo.user_id}`);
      console.log(`  Rate Limit: ${keyInfo.rate_limit} requests/hour`);
      
      if (keyInfo.scopes.length > 0) {
        console.log(`  Scopes: ${keyInfo.scopes.join(', ')}`);
      }
      
      if (keyInfo.expires_at) {
        console.log(`  Expires: ${keyInfo.expires_at.toISOString()}`);
      }
    } catch (error) {
      console.error('Failed to create API key:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};