/* eslint-disable no-underscore-dangle */

/**
 *  *  * @file Provider management CLI commands.
 * @module modules/core/auth/cli/providers
 */

import type { IAuthCliTypes } from '@/modules/core/auth/types/manual';

export const command = {
  description: 'List configured OAuth2/OIDC providers',
  subcommands: {
    list: {
      execute: async (_context: IAuthCliTypes): Promise<void> => {
        console.log('Provider listing is not available in the current implementation.');
        console.log('OAuth providers are managed internally by the auth module.');
      },
    },

    reload: {
      execute: async (_context: IAuthCliTypes): Promise<void> => {
        console.log('Provider reloading is not available in the current implementation.');
        console.log('OAuth providers are managed internally by the auth module.');
      },
    },
  },
};
