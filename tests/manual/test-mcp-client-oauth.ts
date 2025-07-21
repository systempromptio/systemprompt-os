#!/usr/bin/env node
/**
 * @fileoverview Test MCP client OAuth discovery
 * Simulates what the MCP Inspector does
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';

const SERVER_URL = 'https://democontainer.systemprompt.io/mcp';

async function testMCPClient() {
  console.log(chalk.blue('\n🔐 Testing MCP Client OAuth Discovery\n'));
  console.log(chalk.gray(`Server URL: ${SERVER_URL}\n`));

  try {
    // First, let's manually test the discovery flow
    console.log(chalk.yellow('1️⃣  Making initial request without auth...'));
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      })
    });

    console.log(chalk.gray(`   Status: ${response.status}`));
    console.log(chalk.gray(`   Headers:`));
    
    const headers = Array.from(response.headers.entries());
    headers.forEach(([key, value]) => {
      if (key.toLowerCase() === 'www-authenticate') {
        console.log(chalk.green(`     ${key}: ${value}`));
      } else {
        console.log(chalk.gray(`     ${key}: ${value}`));
      }
    });

    const body = await response.json();
    console.log(chalk.gray(`\n   Response body:`));
    console.log(chalk.gray(JSON.stringify(body, null, 2)));

    if (response.status === 401) {
      const wwwAuth = response.headers.get('www-authenticate');
      if (wwwAuth) {
        console.log(chalk.green('\n✅ OAuth discovery headers present!'));
        
        // Parse as_uri
        const asUriMatch = wwwAuth.match(/as_uri="([^"]+)"/);
        if (asUriMatch) {
          const asUri = asUriMatch[1];
          console.log(chalk.blue(`\n2️⃣  Fetching protected resource metadata from: ${asUri}`));
          
          const metadataResponse = await fetch(asUri);
          const metadata = await metadataResponse.json();
          
          console.log(chalk.green('   ✓ Protected resource metadata retrieved:'));
          console.log(chalk.gray(JSON.stringify(metadata, null, 2)));
          
          // Fetch auth server metadata
          const authServer = metadata.authorization_servers[0];
          console.log(chalk.blue(`\n3️⃣  Fetching auth server metadata from: ${authServer}`));
          
          const authServerUrl = `${authServer}/.well-known/oauth-authorization-server`;
          const authServerResponse = await fetch(authServerUrl);
          
          if (authServerResponse.ok) {
            const authServerMetadata = await authServerResponse.json();
            console.log(chalk.green('   ✓ Authorization server metadata retrieved:'));
            console.log(chalk.gray(JSON.stringify(authServerMetadata, null, 2)));
            
            console.log(chalk.green('\n✅ OAuth discovery completed successfully!'));
            console.log(chalk.blue('\nThe MCP client can now:'));
            console.log(chalk.gray('1. Redirect user to:', authServerMetadata.authorization_endpoint));
            console.log(chalk.gray('2. Exchange code at:', authServerMetadata.token_endpoint));
            console.log(chalk.gray('3. Use supported scopes:', metadata.scopes_supported?.join(', ')));
          }
        }
      } else {
        console.log(chalk.red('\n❌ No WWW-Authenticate header found!'));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error);
  }
}

testMCPClient().catch(console.error);