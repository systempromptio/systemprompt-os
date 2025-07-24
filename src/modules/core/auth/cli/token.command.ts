/* eslint-disable no-console */
/**
 *  *  * Token management CLI commands.
 */

import { Command } from 'commander';
import type { AuthModule } from '@/modules/core/auth/index.js';
import { ZERO, ONE, TWO, THREE, TEN } from '@/modules/core/auth/constants';

const TEN = TEN;

const TWO = TWO;
const THREE = THREE;

/**
 *  *
 * createTokenCommand function

 */

export function createTokenCommand(module: AuthModule): Command {
  const cmd = new Command('token')
    .description('Token management commands');

  /** Create token */
  cmd.command('create')
    .description('Create a new token')
    .requiredOption('-u, --user <userId>', 'User ID')
    .requiredOption('-t, --type <type>', 'Token type (api, personal, service)')
    .option('-s, --scope <scopes...>', 'Token scopes', ['read'])
    .option('-e, --expires <seconds>', 'Token expiration in seconds')
    .option('-m, --metadata <json>', 'Token metadata as JSON')
    .action(async (options) : void => {
      try {
        let metadata;
        if (options.metadata) {
          try {
            metadata = JSON.parse(options.metadata);
          } catch {
            logger.error('Error: Invalid JSON for metadata');
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

        logger.log('\n✓ Token created successfully!');
        logger.log(`Token: ${token.token}`);
        logger.log(`Type: ${token.type}`);
        logger.log(`Scopes: ${token.scope.join(', ')}`);
        logger.log(`Expires: ${token.expiresAt.toISOString()}`);
        logger.log('\nStore this token securely - it cannot be retrieved again.');
      } catch (error) {
        logger.error('Error creating token:', error.message);
        process.exit(ONE);
      }
    });

  cmd.command('list <userId>')
    .description('List user tokens')
    .option('--json', 'Output as JSON')
    .action(async (userId, options) : void => {
      try {
        const tokens = await module.listUserTokens(userId);

        if (options.json) {
          logger.log(JSON.stringify(tokens, null, TWO));
        } else {
          if (tokens.length === ZERO) {
            logger.log('No tokens found');
            return;
          }

          logger.log('\nTokens:');
          logger.log('ID                                Type        Scopes              Expires                   Last Used');
          logger.log('--------------------------------  ----------  ------------------  ------------------------  ------------------------');

          tokens.forEach((token) => {
            const id = token.id.substring(ZERO, 32);
            const type = token.type.padEnd(TEN);
            const scopes = token.scope.join(',').substring(ZERO, 18)
.padEnd(18);
            const expires = token.expiresAt ? token.expiresAt.toISOString() : 'Never'.padEnd(24);
            const lastUsed = token.lastUsedAt ? token.lastUsedAt.toISOString() : 'Never'.padEnd(24);

            logger.log(`${id}  ${type}  ${scopes}  ${expires}  ${lastUsed}`);
          });

          logger.log(`\nTotal: ${tokens.length} token(s)`);
        }
      } catch (error) {
        logger.error('Error listing tokens:', error.message);
        process.exit(ONE);
      }
    });

  cmd.command('revoke <tokenId>')
    .description('Revoke a token')
    .action(async (tokenId) : void => {
      try {
        await module.revokeToken(tokenId);
        logger.log('✓ Token revoked successfully');
      } catch (error) {
        logger.error('Error revoking token:', error.message);
        process.exit(ONE);
      }
    });

  cmd.command('revoke-all <userId>')
    .description('Revoke all tokens for a user')
    .option('-t, --type <type>', 'Only revoke tokens of specific type')
    .action(async (userId, options) : void => {
      try {
        await module.revokeUserTokens(userId, options.type);
        logger.log(`✓ All ${options.type || ''} tokens revoked for user ${userId}`);
      } catch (error) {
        logger.error('Error revoking tokens:', error.message);
        process.exit(ONE);
      }
    });

  cmd.command('cleanup')
    .description('Clean up expired tokens')
    .action(async () : void => {
      try {
        const count = await module.cleanupExpiredTokens();
        logger.log(`✓ Cleaned up ${count} expired token(s)`);
      } catch (error) {
        logger.error('Error cleaning up tokens:', error.message);
        process.exit(ONE);
      }
    });

  return cmd;
}
