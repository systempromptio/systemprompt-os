/**
 * @fileoverview Provider management CLI commands
 * @module modules/core/auth/cli/providers
 */

import { getAuthModule } from '../singleton.js';

// Local interface definition
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  subcommands: {
    list: {
      execute: async (_context: CLIContext): Promise<void> => {
        try {
          const authModule = getAuthModule();
          const providers = authModule.getAllProviders();
          
          if (providers.length === 0) {
            console.log('No OAuth2/OIDC providers are currently configured.');
            console.log('\nTo enable providers, set the following environment variables:');
            console.log('  - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for Google');
            console.log('  - GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET for GitHub');
            console.log('\nOr add custom providers in src/modules/core/auth/providers/custom/');
            return;
          }
          
          console.log(`Found ${providers.length} configured provider(s):\n`);
          
          for (const provider of providers) {
            console.log(`  ${provider.id}:`);
            console.log(`    Name: ${provider.name}`);
            console.log(`    Type: ${provider.type}`);
            console.log(`    Status: Enabled`);
            console.log();
          }
        } catch (error) {
          console.error('Error listing providers:', error);
          process.exit(1);
        }
      }
    },
    
    reload: {
      execute: async (_context: CLIContext): Promise<void> => {
        try {
          const authModule = getAuthModule();
          
          console.log('Reloading provider configurations...');
          await authModule.reloadProviders();
          
          const providers = authModule.getAllProviders();
          console.log(`✓ Reloaded successfully. ${providers.length} provider(s) available.`);
          
          if (providers.length > 0) {
            console.log('\nActive providers:');
            for (const provider of providers) {
              console.log(`  - ${provider.id} (${provider.name})`);
            }
          }
        } catch (error) {
          console.error('Error reloading providers:', error);
          process.exit(1);
        }
      }
    }
  }
};