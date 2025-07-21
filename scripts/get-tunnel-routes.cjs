#!/usr/bin/env node

/**
 * Script to get Cloudflare tunnel routes by running the tunnel briefly
 * and capturing the route information from the output
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function getTunnelRoutes() {
  return new Promise((resolve) => {
    const tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
    
    if (!tunnelToken) {
      console.log('No CLOUDFLARE_TUNNEL_TOKEN found');
      resolve(null);
      return;
    }
    
    console.log('Starting tunnel to retrieve route information...');
    
    // Start cloudflared tunnel
    const proc = spawn('cloudflared', [
      'tunnel', 
      '--no-autoupdate', 
      'run',
      '--token',
      tunnelToken
    ], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    let foundUrl = false;
    let tunnelUrl = null;
    
    // Capture stdout and stderr
    const captureOutput = (data) => {
      const text = data.toString();
      output += text;
      
      // Look for route information in the output
      // Cloudflared often logs the hostname when establishing routes
      const hostnameMatch = text.match(/(?:route|hostname|ingress).*?(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (hostnameMatch && !foundUrl) {
        foundUrl = true;
        tunnelUrl = hostnameMatch[1];
        console.log(`Found tunnel URL: ${tunnelUrl}`);
        
        // Kill the process once we have the URL
        proc.kill('SIGTERM');
      }
      
      // Also look for public hostname patterns
      const publicHostnameMatch = text.match(/(?:public hostname|accessible via|ingress.*?hostname).*?(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (publicHostnameMatch && !foundUrl) {
        foundUrl = true;
        tunnelUrl = publicHostnameMatch[1];
        console.log(`Found tunnel URL: ${tunnelUrl}`);
        proc.kill('SIGTERM');
      }
      
      // Look for tunnel route configuration
      const routeMatch = text.match(/(?:hostname|route).*?([a-zA-Z0-9.-]+\.(?:cloudflareaccess|trycloudflare|[a-zA-Z]{2,})\.com)/i);
      if (routeMatch && !foundUrl) {
        foundUrl = true;
        tunnelUrl = `https://${routeMatch[1]}`;
        console.log(`Found tunnel URL: ${tunnelUrl}`);
        proc.kill('SIGTERM');
      }
    };
    
    proc.stdout.on('data', captureOutput);
    proc.stderr.on('data', captureOutput);
    
    // Set a timeout to stop the process
    const timeout = setTimeout(() => {
      if (!foundUrl) {
        console.log('Timeout reached, stopping tunnel...');
        proc.kill('SIGTERM');
      }
    }, 15000); // 15 seconds timeout
    
    proc.on('exit', () => {
      clearTimeout(timeout);
      
      if (!tunnelUrl) {
        // Try one more time to find URL in the output
        const allUrlMatches = output.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (allUrlMatches) {
          // Filter out localhost and internal URLs
          const publicUrls = allUrlMatches.filter(url => 
            !url.includes('localhost') && 
            !url.includes('127.0.0.1') &&
            !url.includes('cloudflare.com/api') &&
            !url.includes('dash.cloudflare') &&
            !url.includes('github.com') &&
            !url.includes('quic-go') &&
            (url.includes('.trycloudflare.com') || 
             url.includes('.cloudflareaccess.com') ||
             url.match(/https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
            )
          );
          
          if (publicUrls.length > 0) {
            tunnelUrl = publicUrls[0];
            console.log(`Found tunnel URL from output: ${tunnelUrl}`);
          }
        }
      }
      
      resolve(tunnelUrl);
    });
  });
}

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

async function main() {
  const tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
  
  if (!tunnelToken) {
    console.log('No CLOUDFLARE_TUNNEL_TOKEN found');
    process.exit(0);
  }
  
  // Get tunnel ID for reference
  const tunnelId = getTunnelIdFromToken(tunnelToken);
  if (tunnelId) {
    console.log(`Tunnel ID: ${tunnelId}`);
  }
  
  // Try to get the tunnel URL
  const tunnelUrl = await getTunnelRoutes();
  
  if (tunnelUrl) {
    console.log(`\nTunnel URL discovered: ${tunnelUrl}`);
    
    // Write to environment file
    const envFile = path.join('/app', '.tunnel-env');
    fs.writeFileSync(envFile, `export CLOUDFLARE_TUNNEL_URL="${tunnelUrl}"\n`);
    console.log(`Saved tunnel URL to ${envFile}`);
    
    // Also output for immediate use
    console.log(`\nExport this environment variable:`);
    console.log(`export CLOUDFLARE_TUNNEL_URL="${tunnelUrl}"`);
  } else {
    console.log('\nCould not determine tunnel URL automatically');
    console.log('The tunnel is working but the public URL could not be detected');
    console.log(`Please check your Cloudflare dashboard for tunnel: ${tunnelId}`);
  }
  
  process.exit(0);
}

// Handle signals gracefully
process.on('SIGINT', () => {
  console.log('\nInterrupted');
  process.exit(0);
});

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});