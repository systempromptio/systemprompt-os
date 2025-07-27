/**
 * Token management CLI commands.
 * @module modules/core/auth/cli/token.command
 */

import { Command } from 'commander';
import type { AuthModule } from '@/modules/core/auth/index';
import type { TokenType } from '@/modules/core/auth/types/index';
import {
 ONE, TEN, TWO, ZERO
} from '@/constants/numbers';
import { LogSource, getLoggerService } from '@/modules/core/logger/index';

/**
 * Create token management CLI commands.
 * @param authModule - Auth module instance.
 * @returns Command instance with token subcommands.
 */
export function createTokenCommand(authModule: AuthModule): Command {
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
        if (options.metadata !== undefined && options.metadata !== null && options.metadata !== '') {
          try {
            metadata = JSON.parse(options.metadata as string);
          } catch {
            const logger = getLoggerService();
            logger.error(LogSource.AUTH, 'Error: Invalid JSON for metadata', {});
            process.exit(ONE);
          }
        }

        const token = await authModule.createToken({
          userId: options.user as string,
          type: options.type as TokenType,
          scope: options.scope as string[],
          ...options.expires !== undefined && options.expires !== null && options.expires !== '' ? { expiresIn: parseInt(options.expires as string, TEN) } : {},
          ...metadata !== undefined ? { metadata } : {}
        });

        const logger = getLoggerService();
        logger.info(LogSource.AUTH, '\n✓ Token created successfully!', {});
        logger.info(LogSource.AUTH, `Token: ${token.token}`, {});
        logger.info(LogSource.AUTH, `Type: ${token.type}`, {});
        logger.info(LogSource.AUTH, `Scopes: ${token.scope.join(', ')}`, {});
        logger.info(LogSource.AUTH, `Expires: ${token.expiresAt.toISOString()}`, {});
        logger.info(LogSource.AUTH, '\nStore this token securely - it cannot be retrieved again.', {});
      } catch (error) {
        const logger = getLoggerService();
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(LogSource.AUTH, 'Error creating token:', { error: errorMessage });
        process.exit(ONE);
      }
    });

  cmd.command('list <userId>')
    .description('List user tokens')
    .option('--json', 'Output as JSON')
    .action(async (userId, options) : Promise<void> => {
      try {
        const tokens = await authModule.listUserTokens(userId);
        const logger = getLoggerService();

        if (options.json === true) {
          logger.info(LogSource.AUTH, JSON.stringify(tokens, null, TWO), {});
        } else {
          if (tokens.length === ZERO) {
            logger.info(LogSource.AUTH, 'No tokens found', {});
            return;
          }

          logger.info(LogSource.AUTH, '\nTokens:', {});
          logger.info(LogSource.AUTH, 'ID                                Type        Scopes              Expires                   Last Used', {});
          logger.info(LogSource.AUTH, '--------------------------------  ----------  ------------------  ------------------------  ------------------------', {});

          tokens.forEach((token): void => {
            const id = token.id.substring(ZERO, 32);
            const type = token.type.padEnd(TEN);
            const scopes = token.scope.join(',').substring(ZERO, 18)
.padEnd(18);
            const expires = token.expiresAt !== null ? token.expiresAt.toISOString() : 'Never'.padEnd(24);
            const lastUsed = token.lastUsedAt !== null && token.lastUsedAt !== undefined ? token.lastUsedAt.toISOString() : 'Never'.padEnd(24);

            logger.info(LogSource.AUTH, `${id}  ${type}  ${scopes}  ${expires}  ${lastUsed}`, {});
          });

          logger.info(LogSource.AUTH, `\nTotal: ${String(tokens.length)} token(s)`, {});
        }
      } catch (error) {
        const logger = getLoggerService();
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(LogSource.AUTH, 'Error listing tokens:', { error: errorMessage });
        process.exit(ONE);
      }
    });

  cmd.command('revoke <tokenId>')
    .description('Revoke a token')
    .action(async (tokenId) : Promise<void> => {
      try {
        await authModule.revokeToken(tokenId);
        const logger = getLoggerService();
        logger.info(LogSource.AUTH, '✓ Token revoked successfully', {});
      } catch (error) {
        const logger = getLoggerService();
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(LogSource.AUTH, 'Error revoking token:', { error: errorMessage });
        process.exit(ONE);
      }
    });

  cmd.command('revoke-all <userId>')
    .description('Revoke all tokens for a user')
    .option('-t, --type <type>', 'Only revoke tokens of specific type')
    .action(async (userId, options) : Promise<void> => {
      try {
        await authModule.revokeUserTokens(userId, options.type as string | undefined);
        const logger = getLoggerService();
        const tokenType = options.type !== undefined && options.type !== null && options.type !== '' ? String(options.type) : '';
        logger.info(LogSource.AUTH, `✓ All ${tokenType} tokens revoked for user ${String(userId)}`, {});
      } catch (error) {
        const logger = getLoggerService();
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(LogSource.AUTH, 'Error revoking tokens:', { error: errorMessage });
        process.exit(ONE);
      }
    });

  cmd.command('cleanup')
    .description('Clean up expired tokens')
    .action(async () : Promise<void> => {
      try {
        const count = await authModule.cleanupExpiredTokens();
        const logger = getLoggerService();
        logger.info(LogSource.AUTH, `✓ Cleaned up ${String(count)} expired token(s)`, {});
      } catch (error) {
        const logger = getLoggerService();
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(LogSource.AUTH, 'Error cleaning up tokens:', { error: errorMessage });
        process.exit(ONE);
      }
    });

  return cmd;
}
