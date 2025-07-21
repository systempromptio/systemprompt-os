#!/usr/bin/env node
/**
 * @fileoverview Test OAuth flow with provider selection
 */

import chalk from 'chalk';
import open from 'open';

const BASE_URL = 'https://democontainer.systemprompt.io';

async function testOAuthWithProviders() {
  console.log(chalk.blue('\n🔐 Testing OAuth Flow with Identity Providers\n'));

  try {
    // Step 1: Register a client
    console.log(chalk.yellow('1️⃣  Registering client...'));
    const registrationResponse = await fetch(`${BASE_URL}/oauth2/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'OAuth Test Client',
        redirect_uris: ['http://localhost:5173/callback', 'http://localhost:3000/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'openid profile email',
        token_endpoint_auth_method: 'client_secret_basic'
      })
    });

    const client = await registrationResponse.json();
    console.log(chalk.green('   ✓ Client registered'));
    console.log(chalk.gray(`     Client ID: ${client.client_id}`));

    // Step 2: Build authorization URL without provider (should show selection)
    console.log(chalk.yellow('\n2️⃣  Building authorization URL (no provider specified)...'));
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      scope: 'openid email profile',
      state: `test-${Date.now()}`,
      code_challenge: 'test-challenge',
      code_challenge_method: 'S256'
    });

    const authUrl = `${BASE_URL}/oauth2/authorize?${authParams}`;
    console.log(chalk.green('   ✓ Authorization URL ready (will show provider selection)'));
    console.log(chalk.gray(`     ${authUrl}`));

    // Step 3: Test direct provider URL
    console.log(chalk.yellow('\n3️⃣  Building authorization URL with Google provider...'));
    authParams.append('provider', 'google');
    const googleAuthUrl = `${BASE_URL}/oauth2/authorize?${authParams}`;
    console.log(chalk.green('   ✓ Google authorization URL ready (will redirect to Google)'));
    console.log(chalk.gray(`     ${googleAuthUrl}`));

    console.log(chalk.blue('\n📋 Summary:'));
    console.log(chalk.gray('   - First URL will show provider selection page'));
    console.log(chalk.gray('   - Second URL will redirect directly to Google'));
    console.log(chalk.gray('   - After Google auth, will redirect back to complete the flow'));
    
    console.log(chalk.yellow('\n🌐 Opening provider selection page in browser...'));
    await open(authUrl);

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error);
  }
}

testOAuthWithProviders().catch(console.error);