import { getAuthModule } from '@/modules/core/auth/singleton';
import { ONE, TWO } from '@/const/numbers';

/**
 *  *  * TunnelStatus function.
 */
export async function tunnelStatus(): Promise<void> {
  const authModule = getAuthModule();
  const status = authModule.getTunnelStatus() as any;
  const publicUrl = authModule.getPublicUrl() as string;

  console.log('\n🚇 OAuth Tunnel Status\n');
  console.log(`Status: ${status.active ? '✅ Active' : '❌ Inactive'}`);
  console.log(`Type: ${status.type}`);

  if (status.url) {
    console.log(`Public URL: ${status.url}`);
  }

  if (status.error) {
    console.log(`Error: ${status.error}`);
  }

  console.log('\n📝 OAuth Configuration\n');
  console.log(`Base URL: ${publicUrl}`);
  console.log(`OAuth Redirect URI: ${publicUrl}/oauth2/callback`);

  if (status.active && status.type === 'cloudflared') {
    console.log('\n🔧 Provider Configuration\n');
    console.log('Add these URLs to your OAuth providers:\n');
    console.log(`Google: ${publicUrl}/oauth2/callback/google`);
    console.log(`GitHub: ${publicUrl}/oauth2/callback/github`);

    console.log(
      '\n⚠️  Note: For Google OAuth, you may need to add the domain to authorized domains.',
    );
    console.log('The domain would be the part after https:// (e.g., xxx.trycloudflare.com)');
  }

  console.log('\n💡 Tips\n');
  console.log('- Set ENABLE_OAUTH_TUNNEL=true to auto-start tunnel');
  console.log('- Set OAUTH_DOMAIN for a permanent domain');
  console.log('- Use CLOUDFLARE_TUNNEL_TOKEN for persistent tunnels');
}

/**
 *  *  * StartTunnel function.
 */
export async function startTunnel(): Promise<void> {
  console.log('🚀 Starting OAuth tunnel...\n');

  try {
    const authModule = getAuthModule();
    await authModule.start();

    const status = authModule.getTunnelStatus() as any;

    if (status.active) {
      console.log(`✅ Tunnel started successfully!`);
      console.log(`Public URL: ${status.url}`);

      console.log('\n📋 Next steps:');
      console.log('ONE. Update your OAuth provider settings with these URLs:');
      console.log(`   - Google: ${status.url}/oauth2/callback/google`);
      console.log(`   - GitHub: ${status.url}/oauth2/callback/github`);
      console.log('TWO. Restart your application to use the new URLs');
    } else {
      console.log('❌ Tunnel did not start');
      if (status.error) {
        console.log(`Error: ${status.error}`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to start tunnel:', error);
    process.exit(ONE);
  }
}

/**
 *  *  * SetupDomain function.
 */
export async function setupDomain(): Promise<void> {
  console.log('\n🌐 Setting Up a Permanent Domain for OAuth\n');

  console.log('Option ONE: Use Cloudflare Tunnel (Recommended)\n');
  console.log('ONE. Install cloudflared and login:');
  console.log('   cloudflared tunnel login\n');

  console.log('TWO. Create a tunnel:');
  console.log('   cloudflared tunnel create systemprompt-oauth\n');

  console.log('THREE. Create a config file (~/.cloudflared/config.yml):');
  console.log(`   url: http://localhost:3000
   tunnel: <TUNNEL_ID>
   credentials-file: /home/user/.cloudflared/<TUNNEL_ID>.json\n`);

  console.log('FOUR. Route traffic to your tunnel:');
  console.log('   cloudflared tunnel route dns systemprompt-oauth oauth.yourdomain.com\n');

  console.log('FIVE. Add to your .env:');
  console.log('   OAUTH_DOMAIN=https://oauth.yourdomain.com');
  console.log('   CLOUDFLARE_TUNNEL_TOKEN=<YOUR_TOKEN>\n');

  console.log('\nOption TWO: Use a Reverse Proxy\n');
  console.log('ONE. Set up nginx/caddy on a server with a domain');
  console.log("TWO. Configure SSL with Let's Encrypt");
  console.log('THREE. Proxy to your application');
  console.log('FOUR. Add to .env: OAUTH_DOMAIN=https://oauth.yourdomain.com');
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
    command().catch?.(console.error);
  }
}
