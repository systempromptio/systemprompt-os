#!/usr/bin/env node

/**
 * Simple script to check tunnel token and provide instructions
 */

const fs = require('fs');
const path = require('path');

// Extract tunnel ID from token
function getTunnelIdFromToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const tokenData = JSON.parse(decoded);
    return tokenData.t || null;
  } catch (error) {
    return null;
  }
}

function main() {
  const tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
  const tunnelUrl = process.env.CLOUDFLARE_TUNNEL_URL;
  
  if (!tunnelToken) {
    console.log('No CLOUDFLARE_TUNNEL_TOKEN found');
    return;
  }
  
  if (tunnelUrl) {
    console.log(`Tunnel URL already configured: ${tunnelUrl}`);
    return;
  }
  
  // Get tunnel ID for reference
  const tunnelId = getTunnelIdFromToken(tunnelToken);
  
  console.log('\n========================================');
  console.log('CLOUDFLARE TUNNEL CONFIGURATION REQUIRED');
  console.log('========================================\n');
  
  if (tunnelId) {
    console.log(`Tunnel ID: ${tunnelId}`);
  }
  
  console.log('\nYour Cloudflare tunnel is connected but the URL is not configured.');
  console.log('Token-based tunnels require a public hostname to be configured.\n');
  
  console.log('To configure your tunnel:');
  console.log('1. Go to https://one.dash.cloudflare.com/');
  console.log('2. Navigate to Zero Trust → Access → Tunnels');
  console.log(`3. Find the tunnel with ID: ${tunnelId || 'check your token'}`);
  console.log('4. Click on the tunnel name to open configuration');
  console.log('5. Go to the "Public Hostname" tab');
  console.log('6. Click "Add a public hostname"');
  console.log('7. Configure:');
  console.log('   - Subdomain: Choose a name (e.g., "my-app")');
  console.log('   - Domain: Select from your Cloudflare domains');
  console.log('   - Service: HTTP://localhost:3000');
  console.log('8. Save the configuration\n');
  
  console.log('The URL will be: https://[subdomain].[your-domain].com\n');
  
  console.log('Then add to your .env file:');
  console.log('CLOUDFLARE_TUNNEL_URL=https://your-tunnel-hostname.com\n');
  
  console.log('For now, the tunnel is using a placeholder URL.');
  console.log('OAuth callbacks will not work until you configure the actual URL.\n');
  
  // Create a marker file to indicate this has been shown
  const markerFile = path.join('/app', '.tunnel-url-needed');
  fs.writeFileSync(markerFile, tunnelId || 'unknown');
}

main();