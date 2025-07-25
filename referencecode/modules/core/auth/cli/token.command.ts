/**
 * Token management CLI commands
 */

import { Command } from 'commander';
import type { AuthModule } from '../index.js';

export function createTokenCommand(module: AuthModule): Command {
  const cmd = new Command('token')
    .description('Token management commands');

  // Create token
  cmd.command('create')
    .description('Create a new token')
    .requiredOption('-u, --user <userId>', 'User ID')
    .requiredOption('-t, --type <type>', 'Token type (api, personal, service)')
    .option('-s, --scope <scopes...>', 'Token scopes', ['read'])
    .option('-e, --expires <seconds>', 'Token expiration in seconds')
    .option('-m, --metadata <json>', 'Token metadata as JSON')
    .action(async (options) => {
      try {
        let metadata;
        if (options.metadata) {
          try {
            metadata = JSON.parse(options.metadata);
          } catch {
            console.error('Error: Invalid JSON for metadata');
            process.exit(1);
          }
        }

        const token = await module.createToken({
          userId: options.user,
          type: options.type,
          scope: options.scope,
          ...(options.expires && { expiresIn: parseInt(options.expires, 10) }),
          ...(metadata && { metadata }),
        });

        console.log('\n✓ Token created successfully!');
        console.log(`Token: ${token.token}`);
        console.log(`Type: ${token.type}`);
        console.log(`Scopes: ${token.scope.join(', ')}`);
        console.log(`Expires: ${token.expiresAt.toISOString()}`);
        console.log('\nStore this token securely - it cannot be retrieved again.');
      } catch (error: any) {
        console.error('Error creating token:', error.message);
        process.exit(1);
      }
    });

  // List tokens
  cmd.command('list <userId>')
    .description('List user tokens')
    .option('--json', 'Output as JSON')
    .action(async (userId, options) => {
      try {
        const tokens = await module.listUserTokens(userId);

        if (options.json) {
          console.log(JSON.stringify(tokens, null, 2));
        } else {
          if (tokens.length === 0) {
            console.log('No tokens found');
            return;
          }

          console.log('\nTokens:');
          console.log('ID                                Type        Scopes              Expires                   Last Used');
          console.log('--------------------------------  ----------  ------------------  ------------------------  ------------------------');

          tokens.forEach(token => {
            const id = token.id.substring(0, 32);
            const type = token.type.padEnd(10);
            const scopes = token.scope.join(',').substring(0, 18).padEnd(18);
            const expires = token.expiresAt ? token.expiresAt.toISOString() : 'Never'.padEnd(24);
            const lastUsed = token.lastUsedAt ? token.lastUsedAt.toISOString() : 'Never'.padEnd(24);

            console.log(`${id}  ${type}  ${scopes}  ${expires}  ${lastUsed}`);
          });

          console.log(`\nTotal: ${tokens.length} token(s)`);
        }
      } catch (error: any) {
        console.error('Error listing tokens:', error.message);
        process.exit(1);
      }
    });

  // Revoke token
  cmd.command('revoke <tokenId>')
    .description('Revoke a token')
    .action(async (tokenId) => {
      try {
        await module.revokeToken(tokenId);
        console.log('✓ Token revoked successfully');
      } catch (error: any) {
        console.error('Error revoking token:', error.message);
        process.exit(1);
      }
    });

  // Revoke all user tokens
  cmd.command('revoke-all <userId>')
    .description('Revoke all tokens for a user')
    .option('-t, --type <type>', 'Only revoke tokens of specific type')
    .action(async (userId, options) => {
      try {
        await module.revokeUserTokens(userId, options.type);
        console.log(`✓ All ${options.type || ''} tokens revoked for user ${userId}`);
      } catch (error: any) {
        console.error('Error revoking tokens:', error.message);
        process.exit(1);
      }
    });

  // Cleanup expired tokens
  cmd.command('cleanup')
    .description('Clean up expired tokens')
    .action(async () => {
      try {
        const count = await module.cleanupExpiredTokens();
        console.log(`✓ Cleaned up ${count} expired token(s)`);
      } catch (error: any) {
        console.error('Error cleaning up tokens:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}