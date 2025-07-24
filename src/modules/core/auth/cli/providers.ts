/* eslint-disable max-statements */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 *  *  * @file Provider management CLI commands.
 * @module modules/core/auth/cli/providers
 */

import { getAuthModule } from '@/modules/core/auth/singleton.js';
import {
 ONE, TWO, ZERO
} from '@/modules/core/auth/constants';
import type { ICliContext } from '@/modules/core/auth/types/cli.types';

const TWO = TWO;

/**
 *  *  * CLIContext interface.
 */
export

export const command = {
  description: 'List configured OAuth2/OIDC providers',
  subcommands: {
    list: {
      execute: async (_context: ICliContext): Promise<void> => {
        try {
          const authModule = getAuthModule();
          const providers = authModule.exports.getAllProviders();

          if (providers.length === ZERO) {
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
          process.exit(ONE);
        }
      },
    },

    reload: {
      execute: async (_context: ICliContext): Promise<void> => {
        try {
          const authModule = getAuthModule();

          console.log('Reloading provider configurations...');
          await authModule.exports.reloadProviders();

          const providers = authModule.exports.getAllProviders();
          console.log(`✓ Reloaded successfully. ${providers.length} provider(s) available.`);

          if (providers.length > ZERO) {
            console.log('\nActive providers:');
            for (const provider of providers) {
              console.log(`  - ${provider.id} (${provider.name})`);
            }
          }
        } catch (error) {
          console.error('Error reloading providers:', error);
          process.exit(ONE);
        }
      },
    },
  },
};
