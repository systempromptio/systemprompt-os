/* eslint-disable max-statements */
/* eslint-disable no-underscore-dangle */

/**
 *  *  * @file Provider management CLI commands.
 * @module modules/core/auth/cli/providers
 */

import { getAuthModule } from '@/modules/core/auth/index';
import type { IAuthCliTypes } from '@/modules/core/auth/types/manual';

export const command = {
  description: 'List configured OAuth2/OIDC providers',
  subcommands: {
    list: {
      execute: async (_context: IAuthCliTypes): Promise<void> => {
        try {
          const authModule = getAuthModule();
          const providersService = authModule.exports.providersService();
          const providers = await providersService.getAllProviders();

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
            console.log(`    Enabled: ${provider.enabled}`);
            console.log(`    Status: ${provider.enabled ? 'Enabled' : 'Disabled'}`);
            console.log();
          }
        } catch (error) {
          console.error('Error listing providers:', error);
          process.exit(1);
        }
      },
    },

    reload: {
      execute: async (_context: IAuthCliTypes): Promise<void> => {
        try {
          const authModule = getAuthModule();

          console.log('Reloading provider configurations...');
          const providersService = authModule.exports.providersService();
        await providersService.reloadProviders();
        console.log('\n✓ Providers reloaded successfully!');
        const providers = await providersService.getAllProviders();
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
      },
    },
  },
};
