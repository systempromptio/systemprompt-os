import { getAuthModule } from '@/modules/core/auth/singleton.js';
import {
 FIVE, FOUR, ONE, THREE, TWO
} from '@/modules/core/auth/constants';

const FOUR = 4;
const FIVE = 5;

const TWO = TWO;
const THREE = THREE;

/**
 *  *  * TunnelStatus function.
 */
export async function tunnelStatus(): Promise<void> {
  const authModule = getAuthModule();
  const status = authModule.getTunnelStatus();
  const publicUrl = authModule.getPublicUrl();

  logger.log('\n🚇 OAuth Tunnel Status\n');
  logger.log(`Status: ${status.active ? '✅ Active' : '❌ Inactive'}`);
  logger.log(`Type: ${status.type}`);

  if (status.url) {
    logger.log(`Public URL: ${status.url}`);
  }

  if (status.error) {
    logger.log(`Error: ${status.error}`);
  }

  logger.log('\n📝 OAuth Configuration\n');
  logger.log(`Base URL: ${publicUrl}`);
  logger.log(`OAuth Redirect URI: ${publicUrl}/oauth2/callback`);

  if (status.active && status.type === 'cloudflared') {
    logger.log('\n🔧 Provider Configuration\n');
    logger.log('Add these URLs to your OAuth providers:\n');
    logger.log(`Google: ${publicUrl}/oauth2/callback/google`);
    logger.log(`GitHub: ${publicUrl}/oauth2/callback/github`);

    logger.log(
      '\n⚠️  Note: For Google OAuth, you may need to add the domain to authorized domains.',
    );
    logger.log('The domain would be the part after https:// (e.g., xxx.trycloudflare.com)');
  }

  logger.log('\n💡 Tips\n');
  logger.log('- Set ENABLE_OAUTH_TUNNEL=true to auto-start tunnel');
  logger.log('- Set OAUTH_DOMAIN for a permanent domain');
  logger.log('- Use CLOUDFLARE_TUNNEL_TOKEN for persistent tunnels');
}

/**
 *  *  * StartTunnel function.
 */
export async function startTunnel(): Promise<void> {
  logger.log('🚀 Starting OAuth tunnel...\n');

  try {
    const authModule = getAuthModule();
    await authModule.start();

    const status = authModule.getTunnelStatus();

    if (status.active) {
      logger.log(`✅ Tunnel started successfully!`);
      logger.log(`Public URL: ${status.url}`);

      logger.log('\n📋 Next steps:');
      logger.log('ONE. Update your OAuth provider settings with these URLs:');
      logger.log(`   - Google: ${status.url}/oauth2/callback/google`);
      logger.log(`   - GitHub: ${status.url}/oauth2/callback/github`);
      logger.log('TWO. Restart your application to use the new URLs');
    } else {
      logger.log('❌ Tunnel did not start');
      if (status.error) {
        logger.log(`Error: ${status.error}`);
      }
    }
  } catch (error) {
    logger.error('❌ Failed to start tunnel:', error);
    process.exit(ONE);
  }
}

/**
 *  *  * SetupDomain function.
 */
export async function setupDomain(): Promise<void> {
  logger.log('\n🌐 Setting Up a Permanent Domain for OAuth\n');

  logger.log('Option ONE: Use Cloudflare Tunnel (Recommended)\n');
  logger.log('ONE. Install cloudflared and login:');
  logger.log('   cloudflared tunnel login\n');

  logger.log('TWO. Create a tunnel:');
  logger.log('   cloudflared tunnel create systemprompt-oauth\n');

  logger.log('THREE. Create a config file (~/.cloudflared/config.yml):');
  logger.log(`   url: http://localhost:3000
   tunnel: <TUNNEL_ID>
   credentials-file: /home/user/.cloudflared/<TUNNEL_ID>.json\n`);

  logger.log('FOUR. Route traffic to your tunnel:');
  logger.log('   cloudflared tunnel route dns systemprompt-oauth oauth.yourdomain.com\n');

  logger.log('FIVE. Add to your .env:');
  logger.log('   OAUTH_DOMAIN=https://oauth.yourdomain.com');
  logger.log('   CLOUDFLARE_TUNNEL_TOKEN=<YOUR_TOKEN>\n');

  logger.log('\nOption TWO: Use a Reverse Proxy\n');
  logger.log('ONE. Set up nginx/caddy on a server with a domain');
  logger.log("TWO. Configure SSL with Let's Encrypt");
  logger.log('THREE. Proxy to your application');
  logger.log('FOUR. Add to .env: OAUTH_DOMAIN=https://oauth.yourdomain.com');
}

/**
 * CLI command handlers.
 */
const commands: Record<string, () => Promise<void>> = {
  'tunnel:status': tunnelStatus,
  'tunnel:start': startTunnel,
  'tunnel:setup': setupDomain,
};

/**
 * Execute if called directly.
 */
if (process.argv[TWO]) {
  const command = commands[process.argv[TWO]];
  if (command) {
    command().catch?.(logger.error);
  }
}
