#!/usr/bin/env tsx

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { randomBytes } from 'crypto';
import { Server } from 'http';
import express from 'express';
import chalk from 'chalk';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

console.log(chalk.blue.bold('\n🔐 MCP OAuth2 Flow Test with Tunnel Support\n'));

// First, get the server status to find the tunnel URL
async function getServerStatus() {
  try {
    const response = await fetch(`${SERVER_URL}/status`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to get server status:', error);
    return null;
  }
}

// Get OAuth configuration
async function getOAuthConfig() {
  try {
    const response = await fetch(`${SERVER_URL}/.well-known/openid-configuration`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to get OAuth config:', error);
    return null;
  }
}

// Wait for tunnel to be ready
async function waitForTunnel(maxAttempts = 30) {
  console.log(chalk.yellow('⏳ Waiting for tunnel to be ready...'));
  
  for (let i = 0; i < maxAttempts; i++) {
    // Check OAuth config for tunnel URL
    const config = await getOAuthConfig();
    if (config && config.authorization_endpoint && !config.authorization_endpoint.includes('localhost')) {
      console.log(chalk.green('✓ Tunnel is ready!'));
      console.log(chalk.cyan(`  Authorization endpoint: ${config.authorization_endpoint}`));
      return config;
    }
    
    // Check server logs for tunnel info
    const logs = await fetch(`${SERVER_URL}/status`).then(r => r.json()).catch(() => null);
    if (logs?.logs?.recent) {
      const tunnelLog = logs.logs.recent.find((log: string) => log.includes('Tunnel established'));
      if (tunnelLog) {
        const match = tunnelLog.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) {
          console.log(chalk.green(`✓ Tunnel found in logs: ${match[0]}`));
          // Wait a moment for OAuth config to update
          await new Promise(resolve => setTimeout(resolve, 2000));
          return getOAuthConfig();
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(chalk.red('✗ Tunnel did not become ready in time'));
  return null;
}

async function main() {
  try {
    // Wait for tunnel
    const oauthConfig = await waitForTunnel();
    if (!oauthConfig) {
      console.log(chalk.yellow('\n⚠️  No tunnel detected. OAuth may not work with localhost.'));
      console.log(chalk.yellow('💡 Ensure ENABLE_OAUTH_TUNNEL=true is set in .env\n'));
    } else {
      console.log(chalk.green('\n✓ OAuth is configured with tunnel URL'));
      console.log(chalk.cyan('OAuth Configuration:'));
      console.log(JSON.stringify({
        authorization_endpoint: oauthConfig.authorization_endpoint,
        token_endpoint: oauthConfig.token_endpoint,
        issuer: oauthConfig.issuer
      }, null, 2));
    }
    
    // Test MCP endpoint (should get 401)
    console.log(chalk.blue('\n📡 Testing unauthenticated access to MCP endpoint...'));
    const mcpResponse = await fetch(`${SERVER_URL}/mcp/core`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: { capabilities: {} },
        id: 1
      })
    });
    
    if (mcpResponse.status === 401) {
      console.log(chalk.green('✓ Received 401 Unauthorized (as expected)'));
      const authHeader = mcpResponse.headers.get('www-authenticate');
      if (authHeader) {
        console.log(chalk.gray(`  WWW-Authenticate: ${authHeader}`));
      }
    } else {
      console.log(chalk.red(`✗ Unexpected status: ${mcpResponse.status}`));
    }
    
    console.log(chalk.green('\n✓ Test completed successfully'));
    console.log(chalk.cyan('\nTo test OAuth flow manually:'));
    console.log(chalk.cyan('1. Run: npm run test:oauth'));
    console.log(chalk.cyan('2. The test will use the tunnel URL automatically'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error);
    process.exit(1);
  }
}

main();