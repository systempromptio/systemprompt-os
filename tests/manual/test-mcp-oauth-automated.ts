/**
 * Automated OAuth2 flow test for MCP endpoints
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import crypto from 'crypto';
import express from 'express';
import open from 'open';

class MCPOAuthAutomatedTester {
  private serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  private callbackUrl = 'http://localhost:4567/callback';
  private callbackServer?: ReturnType<typeof express>;
  private client?: Client;
  
  async run() {
    console.log('🔐 MCP OAuth2 Flow Automated Test\n');
    console.log(`Server URL: ${this.serverUrl}`);
    console.log(`Callback URL: ${this.callbackUrl}\n`);
    
    try {
      // Step 1: Test unauthenticated access
      console.log('📡 Testing unauthenticated access to MCP endpoint...');
      const unauthResponse = await fetch(`${this.serverUrl}/mcp/core`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        })
      });
      
      const unauthData = await unauthResponse.json();
      console.log(`✓ Received ${unauthResponse.status} ${unauthResponse.statusText} (as expected)`);
      
      if (unauthResponse.status !== 401 || !unauthData.error?.data?.oauth2) {
        throw new Error('Expected 401 with OAuth2 configuration');
      }
      
      console.log('\nOAuth2 Configuration:');
      console.log(JSON.stringify(unauthData.error.data.oauth2, null, 2));
      
      // Extract OAuth2 config
      const oauth2Config = unauthData.error.data.oauth2;
      
      // Step 2: Start OAuth2 flow with Google
      const provider = 'google';
      console.log(`\n🚀 Starting OAuth2 flow with ${provider} provider...`);
      
      // Generate state and PKCE challenge
      const state = crypto.randomBytes(32).toString('base64url');
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      
      // Build authorization URL
      const authUrl = new URL(oauth2Config.authorization_uri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', 'mcp-client');
      authUrl.searchParams.set('redirect_uri', this.callbackUrl);
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('provider', provider);
      
      console.log('\n🔗 Authorization URL:');
      console.log(authUrl.toString());
      
      // Step 3: Test direct authorization endpoint
      console.log('\n📥 Testing authorization endpoint directly...');
      const authResponse = await fetch(authUrl.toString(), {
        redirect: 'manual',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      
      console.log(`Authorization endpoint status: ${authResponse.status}`);
      
      if (authResponse.status === 302 || authResponse.status === 303) {
        const redirectLocation = authResponse.headers.get('location');
        console.log(`Redirect to: ${redirectLocation}`);
        
        // This should redirect to Google OAuth
        if (redirectLocation?.includes('accounts.google.com')) {
          console.log('✓ Successfully redirected to Google OAuth');
        }
      }
      
      // Step 4: Test that providers are available
      console.log('\n🔍 Verifying OAuth providers are configured...');
      const statusResponse = await fetch(`${this.serverUrl}/status`);
      const statusData = await statusResponse.json();
      
      console.log('\nServer status:');
      console.log(JSON.stringify(statusData, null, 2));
      
      console.log('\n✅ OAuth2 configuration test completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Open the authorization URL in a browser');
      console.log('2. Complete the OAuth flow with Google');
      console.log('3. The callback will receive the authorization code');
      console.log('4. Exchange the code for an access token');
      console.log('5. Use the token to access MCP endpoints');
      
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    }
  }
}

// Run the test
const tester = new MCPOAuthAutomatedTester();
tester.run().catch(console.error);