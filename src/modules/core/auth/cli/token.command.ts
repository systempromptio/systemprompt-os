/* eslint-disable func-style */
/* eslint-disable max-lines-per-function */
/* eslint-disable max-statements */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 *  *  * Token management CLI commands.
 */

import { Command } from 'commander';
import type { AuthModule } from '@/modules/core/auth/index';
import {
 ONE, TEN, TWO, ZERO
} from '@/const/numbers';

/**
 *  *
 * CreateTokenCommand function.
 *
 */

export function createTokenCommand(module: AuthModule): Command {
  const cmd = new Command('token')
    .description('Token management commands');

  cmd.command('create')
    .description('Create a new token')
    .requiredOption('-u, --user <userId>', 'User ID')
    .requiredOption('-t, --type <type>', 'Token type (api, personal, service)')
    .option('-s, --scope <scopes...>', 'Token scopes', ['read'])
    .option('-e, --expires <seconds>', 'Token expiration in seconds')
    .option('-m, --metadata <json>', 'Token metadata as JSON')
    .action(async (options): Promise<void> => {
      try {
        let metadata;
        if (options.metadata) {
          try {
            metadata = JSON.parse(options.metadata);
          } catch {
            console.error('Error: Invalid JSON for metadata');
            process.exit(ONE);
          }
        }

        const token = await module.createToken({
          userId: options.user,
          type: options.type,
          scope: options.scope,
          ...options.expires && { expiresIn: parseInt(options.expires, TEN) },
          ...metadata && { metadata }
        });

        console.log('\n✓ Token created successfully!');
        console.log(`Token: ${token.token}`);
        console.log(`Type: ${token.type}`);
        console.log(`Scopes: ${token.scope.join(', ')}`);
        console.log(`Expires: ${token.expiresAt.toISOString()}`);
        console.log('\nStore this token securely - it cannot be retrieved again.');
      } catch (error) {
        console.error('Error creating token:', (error as Error).message);
        process.exit(ONE);
      }
    });

  cmd.command('list <userId>')
    .description('List user tokens')
    .option('--json', 'Output as JSON')
    .action(async (userId, options) : Promise<void> => {
      try {
        const tokens = await module.listUserTokens(userId);

        if (options.json) {
          console.log(JSON.stringify(tokens, null, TWO));
        } else {
          if (tokens.length === ZERO) {
            console.log('No tokens found');
            return;
          }

          console.log('\nTokens:');
          console.log('ID                                Type        Scopes              Expires                   Last Used');
          console.log('--------------------------------  ----------  ------------------  ------------------------  ------------------------');

          tokens.forEach((token) => {
            const id = token.id.substring(ZERO, 32);
            const type = token.type.padEnd(TEN);
            const scopes = token.scope.join(',').substring(ZERO, 18)
.padEnd(18);
            const expires = token.expiresAt ? token.expiresAt.toISOString() : 'Never'.padEnd(24);
            const lastUsed = token.lastUsedAt ? token.lastUsedAt.toISOString() : 'Never'.padEnd(24);

            console.log(`${id}  ${type}  ${scopes}  ${expires}  ${lastUsed}`);
          });

          console.log(`\nTotal: ${tokens.length} token(s)`);
        }
      } catch (error) {
        console.error('Error listing tokens:', (error as Error).message);
        process.exit(ONE);
      }
    });

  cmd.command('revoke <tokenId>')
    .description('Revoke a token')
    .action(async (tokenId) : Promise<void> => {
      try {
        await module.revokeToken(tokenId);
        console.log('✓ Token revoked successfully');
      } catch (error) {
        console.error('Error revoking token:', (error as Error).message);
        process.exit(ONE);
      }
    });

  cmd.command('revoke-all <userId>')
    .description('Revoke all tokens for a user')
    .option('-t, --type <type>', 'Only revoke tokens of specific type')
    .action(async (userId, options) : Promise<void> => {
      try {
        await module.revokeUserTokens(userId, options.type);
        console.log(`✓ All ${options.type || ''} tokens revoked for user ${userId}`);
      } catch (error) {
        console.error('Error revoking tokens:', (error as Error).message);
        process.exit(ONE);
      }
    });

  cmd.command('cleanup')
    .description('Clean up expired tokens')
    .action(async () : Promise<void> => {
      try {
        const count = await module.cleanupExpiredTokens();
        console.log(`✓ Cleaned up ${count} expired token(s)`);
      } catch (error) {
        console.error('Error cleaning up tokens:', (error as Error).message);
        process.exit(ONE);
      }
    });

  return cmd;
}
