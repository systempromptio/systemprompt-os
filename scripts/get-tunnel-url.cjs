#!/usr/bin/env node

/**
 * Script to fetch Cloudflare tunnel URL from tunnel token
 * The tunnel token contains the tunnel ID which we can use to get the configured URL
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Parse tunnel token to extract tunnel ID
function parseTunnelToken(token) {
  try {
    // Cloudflare tunnel tokens are base64 encoded JSON
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const tokenData = JSON.parse(decoded);
    return {
      tunnelId: tokenData.t,
      accountId: tokenData.a,
      secret: tokenData.s
    };
  } catch (error) {
    console.error('Failed to parse tunnel token:', error.message);
    return null;
  }
}

// Get tunnel hostname from Cloudflare API
async function getTunnelHostname(tunnelId, accountId, apiToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${accountId}/tunnels/${tunnelId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success && response.result) {
            // Get the first ingress rule hostname
            const config = response.result.config;
            if (config && config.ingress && config.ingress.length > 0) {
              const hostname = config.ingress[0].hostname;
              resolve(hostname ? `https://${hostname}` : null);
            } else {
              resolve(null);
            }
          } else {
            reject(new Error(`API Error: ${response.errors?.[0]?.message || 'Unknown error'}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Try to get tunnel URL using tunnel info command
async function getTunnelUrlFromCommand(tunnelToken) {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
    // Try to run cloudflared tunnel info
    const proc = spawn('cloudflared', ['tunnel', 'info', '--output', 'json'], {
      env: { ...process.env, TUNNEL_TOKEN: tunnelToken }
    });
    
    let output = '';
    let error = '';
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0 && output) {
        try {
          const info = JSON.parse(output);
          // Extract URL from tunnel info
          if (info && info.ingress && info.ingress.length > 0) {
            const hostname = info.ingress[0].hostname;
            resolve(hostname ? `https://${hostname}` : null);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

// Main function
async function main() {
  const tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
  
  if (!tunnelToken) {
    console.log('No CLOUDFLARE_TUNNEL_TOKEN found in environment');
    return;
  }
  
  console.log('Attempting to retrieve tunnel URL...');
  
  // First, try to parse the token
  const tokenInfo = parseTunnelToken(tunnelToken);
  if (tokenInfo && tokenInfo.tunnelId) {
    console.log(`Found tunnel ID: ${tokenInfo.tunnelId}`);
    
    // Try to get URL using cloudflared command
    const urlFromCommand = await getTunnelUrlFromCommand(tunnelToken);
    if (urlFromCommand) {
      console.log(`Tunnel URL: ${urlFromCommand}`);
      
      // Write to .env file if not already present
      updateEnvFile(urlFromCommand);
      return;
    }
    
    // If we have a Cloudflare API token, try the API
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (apiToken && tokenInfo.accountId) {
      try {
        const url = await getTunnelHostname(tokenInfo.tunnelId, tokenInfo.accountId, apiToken);
        if (url) {
          console.log(`Tunnel URL: ${url}`);
          updateEnvFile(url);
        } else {
          console.log('No hostname configured for this tunnel');
          console.log('Please configure a hostname in Cloudflare dashboard');
        }
      } catch (error) {
        console.error('Failed to fetch tunnel info from API:', error.message);
      }
    } else {
      console.log('No CLOUDFLARE_API_TOKEN found, cannot query API');
      console.log('Please either:');
      console.log('1. Set CLOUDFLARE_API_TOKEN environment variable');
      console.log('2. Manually set CLOUDFLARE_TUNNEL_URL in .env file');
    }
  } else {
    console.error('Invalid tunnel token format');
  }
}

// Update .env file with tunnel URL
function updateEnvFile(url) {
  const envPath = path.join(process.cwd(), '.env');
  
  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Check if CLOUDFLARE_TUNNEL_URL already exists
    if (envContent.includes('CLOUDFLARE_TUNNEL_URL=')) {
      console.log('CLOUDFLARE_TUNNEL_URL already set in .env file');
      return;
    }
    
    // Add the URL to .env file
    const lines = envContent.split('\n');
    let added = false;
    
    // Find the line after CLOUDFLARE_TUNNEL_TOKEN to insert the URL
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('CLOUDFLARE_TUNNEL_TOKEN=')) {
        lines.splice(i + 1, 0, `CLOUDFLARE_TUNNEL_URL=${url}`);
        added = true;
        break;
      }
    }
    
    // If not added, append to end
    if (!added) {
      lines.push(`CLOUDFLARE_TUNNEL_URL=${url}`);
    }
    
    fs.writeFileSync(envPath, lines.join('\n'));
    console.log('Updated .env file with CLOUDFLARE_TUNNEL_URL');
  } catch (error) {
    console.error('Failed to update .env file:', error.message);
  }
}

// Run the script
main().catch(console.error);