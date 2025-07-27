import { getAuthModule } from '@/modules/core/auth/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { ITunnelStatus } from '@/modules/core/auth/types/tunnel.types';
import { ONE, TWO } from '@/constants/numbers';

/**
 * Type guard to check if unknown value is ITunnelStatus.
 * @param value - Value to check.
 * @returns True if value is ITunnelStatus.
 */
const isTunnelStatus = (value: unknown): value is ITunnelStatus => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const hasActiveProperty = 'active' in value;
  const hasTypeProperty = 'type' in value;

  if (!hasActiveProperty || !hasTypeProperty) {
    return false;
  }

  const valueObj = value as { active: unknown; type: unknown };
  return typeof valueObj.active === 'boolean' && typeof valueObj.type === 'string';
};

/**
 * Display tunnel status information.
 * @param logger - Logger service instance.
 * @param status - Tunnel status object.
 */
const displayTunnelStatus = (logger: LoggerService, status: ITunnelStatus): void => {
  logger.info(LogSource.AUTH, '\n🚇 OAuth Tunnel Status\n');
  logger.info(LogSource.AUTH, `Status: ${status.active ? '✅ Active' : '❌ Inactive'}`);
  logger.info(LogSource.AUTH, `Type: ${status.type}`);

  if (status.url !== undefined) {
    logger.info(LogSource.AUTH, `Public URL: ${status.url}`);
  }

  if (status.error !== undefined) {
    logger.info(LogSource.AUTH, `Error: ${status.error}`);
  }
};

/**
 * Display OAuth configuration information.
 * @param logger - Logger service instance.
 * @param publicUrl - Public URL string.
 */
const displayOAuthConfig = (logger: LoggerService, publicUrl: string): void => {
  logger.info(LogSource.AUTH, '\n📝 OAuth Configuration\n');
  logger.info(LogSource.AUTH, `Base URL: ${publicUrl}`);
  logger.info(LogSource.AUTH, `OAuth Redirect URI: ${publicUrl}/oauth2/callback`);
};

/**
 * Display provider configuration for cloudflared tunnels.
 * @param logger - Logger service instance.
 * @param publicUrl - Public URL string.
 */
const displayProviderConfig = (logger: LoggerService, publicUrl: string): void => {
  logger.info(LogSource.AUTH, '\n🔧 Provider Configuration\n');
  logger.info(LogSource.AUTH, 'Add these URLs to your OAuth providers:\n');
  logger.info(LogSource.AUTH, `Google: ${publicUrl}/oauth2/callback/google`);
  logger.info(LogSource.AUTH, `GitHub: ${publicUrl}/oauth2/callback/github`);

  logger.info(
    LogSource.AUTH,
    '\n⚠️  Note: For Google OAuth, you may need to add the domain to authorized domains.',
  );
  logger.info(LogSource.AUTH, 'The domain would be the part after https:// (e.g., xxx.trycloudflare.com)');
};

/**
 * Display helpful tips.
 * @param logger - Logger service instance.
 */
const displayTips = (logger: LoggerService): void => {
  logger.info(LogSource.AUTH, '\n💡 Tips\n');
  logger.info(LogSource.AUTH, '- Set ENABLE_OAUTH_TUNNEL=true to auto-start tunnel');
  logger.info(LogSource.AUTH, '- Set OAUTH_DOMAIN for a permanent domain');
  logger.info(LogSource.AUTH, '- Use CLOUDFLARE_TUNNEL_TOKEN for persistent tunnels');
};

/**
 * TunnelStatus function.
 */
export const tunnelStatus = (): void => {
  const logger = LoggerService.getInstance();
  const authModule = getAuthModule();
  const tunnelStatusData = authModule.exports.getTunnelStatus();

  if (!isTunnelStatus(tunnelStatusData)) {
    logger.error(LogSource.AUTH, 'Invalid tunnel status data received');
    return;
  }

  const tunnelService = authModule.exports.getTunnelService();
  const publicUrl = tunnelService?.getPublicUrl() ?? 'http://localhost:3000';

  displayTunnelStatus(logger, tunnelStatusData);
  displayOAuthConfig(logger, publicUrl);

  if (tunnelStatusData.active && tunnelStatusData.type === 'cloudflared') {
    displayProviderConfig(logger, publicUrl);
  }

  displayTips(logger);
};

/**
 * Display successful tunnel start information.
 * @param logger - Logger service instance.
 * @param url - Tunnel URL string.
 */
const displayTunnelSuccess = (logger: LoggerService, url: string): void => {
  logger.info(LogSource.AUTH, '✅ Tunnel started successfully!');
  logger.info(LogSource.AUTH, `Public URL: ${url}`);
  logger.info(LogSource.AUTH, '\n📋 Next steps:');
  logger.info(LogSource.AUTH, 'ONE. Update your OAuth provider settings with these URLs:');
  logger.info(LogSource.AUTH, `   - Google: ${url}/oauth2/callback/google`);
  logger.info(LogSource.AUTH, `   - GitHub: ${url}/oauth2/callback/github`);
  logger.info(LogSource.AUTH, 'TWO. Restart your application to use the new URLs');
};

/**
 * Display tunnel failure information.
 * @param logger - Logger service instance.
 * @param status - Tunnel status object.
 */
const displayTunnelFailure = (logger: LoggerService, status: ITunnelStatus): void => {
  logger.info(LogSource.AUTH, '❌ Tunnel did not start');
  if (status.error !== undefined) {
    logger.info(LogSource.AUTH, `Error: ${status.error}`);
  }
};

/**
 * StartTunnel function.
 */
export const startTunnel = async (): Promise<void> => {
  const logger = LoggerService.getInstance();
  logger.info(LogSource.AUTH, '🚀 Starting OAuth tunnel...\n');

  try {
    const authModule = getAuthModule();
    const tunnelStatusData = authModule.exports.getTunnelStatus();

    if (!isTunnelStatus(tunnelStatusData)) {
      logger.error(LogSource.AUTH, 'Invalid tunnel status data received');
      return;
    }

    if (tunnelStatusData.active && tunnelStatusData.url !== undefined) {
      displayTunnelSuccess(logger, tunnelStatusData.url);
    } else {
      displayTunnelFailure(logger, tunnelStatusData);
    }
  } catch (error) {
    logger.error(LogSource.AUTH, '❌ Failed to start tunnel:', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(ONE);
  }
};

/**
 * Display Cloudflare Tunnel setup instructions.
 * @param logger - Logger service instance.
 */
const displayCloudflareSetup = (logger: LoggerService): void => {
  logger.info(LogSource.AUTH, 'Option ONE: Use Cloudflare Tunnel (Recommended)\n');
  logger.info(LogSource.AUTH, 'ONE. Install cloudflared and login:');
  logger.info(LogSource.AUTH, '   cloudflared tunnel login\n');
  logger.info(LogSource.AUTH, 'TWO. Create a tunnel:');
  logger.info(LogSource.AUTH, '   cloudflared tunnel create systemprompt-oauth\n');
  logger.info(LogSource.AUTH, 'THREE. Create a config file (~/.cloudflared/config.yml):');
  logger.info(LogSource.AUTH, `   url: http://localhost:3000
   tunnel: <TUNNEL_ID>
   credentials-file: /home/user/.cloudflared/<TUNNEL_ID>.json\n`);
};

/**
 * Display DNS and environment setup instructions.
 * @param logger - Logger service instance.
 */
const displayDnsAndEnvSetup = (logger: LoggerService): void => {
  logger.info(LogSource.AUTH, 'FOUR. Route traffic to your tunnel:');
  logger.info(LogSource.AUTH, '   cloudflared tunnel route dns systemprompt-oauth oauth.yourdomain.com\n');
  logger.info(LogSource.AUTH, 'FIVE. Add to your .env:');
  logger.info(LogSource.AUTH, '   OAUTH_DOMAIN=https://oauth.yourdomain.com');
  logger.info(LogSource.AUTH, '   CLOUDFLARE_TUNNEL_TOKEN=<YOUR_TOKEN>\n');
};

/**
 * Display reverse proxy setup instructions.
 * @param logger - Logger service instance.
 */
const displayReverseProxySetup = (logger: LoggerService): void => {
  logger.info(LogSource.AUTH, '\nOption TWO: Use a Reverse Proxy\n');
  logger.info(LogSource.AUTH, 'ONE. Set up nginx/caddy on a server with a domain');
  logger.info(LogSource.AUTH, "TWO. Configure SSL with Let's Encrypt");
  logger.info(LogSource.AUTH, 'THREE. Proxy to your application');
  logger.info(LogSource.AUTH, 'FOUR. Add to .env: OAUTH_DOMAIN=https://oauth.yourdomain.com');
};

/**
 * SetupDomain function.
 */
export const setupDomain = (): void => {
  const logger = LoggerService.getInstance();
  logger.info(LogSource.AUTH, '\n🌐 Setting Up a Permanent Domain for OAuth\n');

  displayCloudflareSetup(logger);
  displayDnsAndEnvSetup(logger);
  displayReverseProxySetup(logger);
};

/**
 * CLI command handlers.
 */
const commands: Record<string, () => Promise<void> | void> = {
  tunnelStatus,
  tunnelStart: startTunnel,
  tunnelSetup: setupDomain,
};

/**
 * Execute if called directly.
 */
if (process.argv[TWO] !== undefined && process.argv[TWO] !== '') {
  const { [TWO]: commandArg } = process.argv;
  if (commandArg && commandArg in commands) {
    const command = commands[commandArg];
    if (command !== undefined) {
      const result = command();
      if (result instanceof Promise) {
        result.catch((error: unknown): void => {
          const logger = LoggerService.getInstance();
          logger.error(LogSource.AUTH, 'Command failed:', { error: error instanceof Error ? error : new Error(String(error)) });
        });
      }
    }
  }
}
