#!/usr/bin/env node
/**
 * @fileoverview Test complete MCP OAuth flow with dynamic client registration
 * Simulates what the MCP Inspector does
 */

import chalk from 'chalk';

const BASE_URL = 'https://democontainer.systemprompt.io';

interface ClientRegistration {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

async function testCompleteOAuthFlow() {
  console.log(chalk.blue('\n🔐 Testing Complete MCP OAuth Flow\n'));
  console.log(chalk.gray(`Server URL: ${BASE_URL}\n`));

  try {
    // Step 1: Make unauthenticated request
    console.log(chalk.yellow('1️⃣  Making unauthenticated request to MCP endpoint...'));
    const unauthResponse = await fetch(`${BASE_URL}/mcp`, {
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

    if (unauthResponse.status !== 401) {
      throw new Error(`Expected 401, got ${unauthResponse.status}`);
    }

    const wwwAuth = unauthResponse.headers.get('www-authenticate');
    console.log(chalk.green('   ✓ Received 401 with WWW-Authenticate header'));

    // Step 2: Parse and fetch protected resource metadata
    console.log(chalk.yellow('\n2️⃣  Fetching protected resource metadata...'));
    const asUriMatch = wwwAuth?.match(/as_uri="([^"]+)"/);
    if (!asUriMatch) {
      throw new Error('Failed to parse as_uri from WWW-Authenticate header');
    }

    const protectedResourceResponse = await fetch(asUriMatch[1]);
    const protectedResource = await protectedResourceResponse.json();
    console.log(chalk.green('   ✓ Protected resource metadata retrieved'));

    // Step 3: Fetch authorization server metadata
    console.log(chalk.yellow('\n3️⃣  Fetching authorization server metadata...'));
    const authServerUrl = `${protectedResource.authorization_servers[0]}/.well-known/oauth-authorization-server`;
    const authServerResponse = await fetch(authServerUrl);
    const authServer = await authServerResponse.json();
    console.log(chalk.green('   ✓ Authorization server metadata retrieved'));

    // Step 4: Register client dynamically
    console.log(chalk.yellow('\n4️⃣  Registering client dynamically...'));
    const registrationResponse = await fetch(authServer.registration_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'MCP Test Client',
        redirect_uris: ['http://localhost:5173/callback', 'http://localhost:3000/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'openid profile email',
        token_endpoint_auth_method: 'client_secret_basic'
      })
    });

    if (!registrationResponse.ok) {
      const error = await registrationResponse.text();
      throw new Error(`Client registration failed: ${error}`);
    }

    const client = await registrationResponse.json() as ClientRegistration;
    console.log(chalk.green('   ✓ Client registered successfully'));
    console.log(chalk.gray(`     Client ID: ${client.client_id}`));
    console.log(chalk.gray(`     Client Secret: ${client.client_secret?.substring(0, 8)}...`));

    // Step 5: Build authorization URL
    console.log(chalk.yellow('\n5️⃣  Building authorization URL...'));
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      scope: 'openid email profile',
      state: `test-${Date.now()}`,
      // Optional: specify provider
      provider: 'google'
    });

    const authUrl = `${authServer.authorization_endpoint}?${authParams}`;
    console.log(chalk.green('   ✓ Authorization URL ready'));
    console.log(chalk.gray(`     ${authUrl}`));

    // Summary
    console.log(chalk.green('\n✅ OAuth flow setup completed successfully!\n'));
    console.log(chalk.blue('📋 Summary:'));
    console.log(chalk.gray('   1. Client discovered OAuth metadata via WWW-Authenticate header'));
    console.log(chalk.gray('   2. Client fetched protected resource metadata'));
    console.log(chalk.gray('   3. Client fetched authorization server metadata'));
    console.log(chalk.gray('   4. Client registered dynamically and received credentials'));
    console.log(chalk.gray('   5. Client can now redirect user to authorization URL'));
    console.log(chalk.gray('\n   The MCP Inspector should now be able to connect!'));

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error);
    process.exit(1);
  }
}

testCompleteOAuthFlow().catch(console.error);