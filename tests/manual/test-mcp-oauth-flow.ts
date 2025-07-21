#!/usr/bin/env node
/**
 * @fileoverview Interactive MCP OAuth2 flow test script
 * @module tests/manual/test-mcp-oauth-flow
 * 
 * Run this script to interactively test the OAuth2 flow:
 * npm run test:oauth
 */

import inquirer from 'inquirer';
import open from 'open';
import express from 'express';
import { createServer } from 'http';
import chalk from 'chalk';

const LOCALHOST_URL = process.env.BASE_URL || 'http://localhost:3000';
const CALLBACK_PORT = 4567;

// We'll detect the actual OAuth URL from the discovery endpoint
let BASE_URL = LOCALHOST_URL;
let CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

interface OAuth2Config {
  authorization_uri: string;
  token_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
}

class MCPOAuthTester {
  private authorizationCode: string | null = null;
  private callbackServer: any;
  private accessToken: string | null = null;

  async run(): Promise<void> {
    console.log(chalk.blue('\n🔐 MCP OAuth2 Flow Interactive Test\n'));
    
    try {
      // First, check OAuth discovery to see if tunnel is being used
      const discoveryResponse = await fetch(`${LOCALHOST_URL}/.well-known/openid-configuration`);
      const discovery = await discoveryResponse.json();
      
      // If the authorization endpoint is not localhost, we're using a tunnel
      if (!discovery.authorization_endpoint.includes('localhost')) {
        const tunnelUrl = new URL(discovery.authorization_endpoint).origin;
        console.log(chalk.green(`✓ Detected tunnel URL: ${tunnelUrl}`));
        BASE_URL = tunnelUrl;
        // Keep callback URL as localhost since that's where our test server runs
        console.log(chalk.yellow(`  Note: OAuth will redirect to ${tunnelUrl}, but callback stays at localhost:${CALLBACK_PORT}`));
      } else {
        console.log(chalk.yellow('⚠️  No tunnel detected, using localhost'));
      }
      
      console.log(chalk.gray(`\nServer URL: ${BASE_URL}`));
      console.log(chalk.gray(`Callback URL: ${CALLBACK_URL}\n`));

      // Step 1: Test unauthenticated access
      const oauth2Config = await this.testUnauthenticatedAccess();
      
      // Step 2: Start OAuth flow
      await this.startOAuthFlow(oauth2Config);
      
      // Step 3: Test authenticated access
      await this.testAuthenticatedAccess();
      
      console.log(chalk.green('\n✨ Test completed successfully!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Test failed:'), error);
    } finally {
      await this.cleanup();
    }
  }

  private async testUnauthenticatedAccess(): Promise<OAuth2Config> {
    console.log(chalk.yellow('📡 Testing unauthenticated access to MCP endpoint...'));
    
    const response = await fetch(`${BASE_URL}/mcp/core`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      }),
    });

    const data = await response.json();
    
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }

    console.log(chalk.green('✓ Received 401 Unauthorized (as expected)'));
    console.log(chalk.gray('\nOAuth2 Configuration:'));
    console.log(JSON.stringify(data.error.data.oauth2, null, 2));

    return data.error.data.oauth2;
  }

  private async startOAuthFlow(oauth2Config: OAuth2Config): Promise<void> {
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Start OAuth2 authentication flow?',
        default: true,
      },
    ]);

    if (!proceed) {
      throw new Error('User cancelled');
    }

    // Start callback server
    await this.startCallbackServer();

    // Select provider
    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select identity provider:',
        choices: [
          { name: '🔵 Google', value: 'google' },
          { name: '⚫ GitHub', value: 'github' },
        ],
      },
    ]);

    // Build authorization URL
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: 'mcp-test-client',
      redirect_uri: CALLBACK_URL,
      scope: 'openid email profile',
      state: `test-${Date.now()}`,
      provider: provider,
    });

    const authUrl = `${oauth2Config.authorization_uri}?${authParams}`;

    console.log(chalk.blue('\n🌐 Opening browser for authentication...'));
    console.log(chalk.gray(`URL: ${authUrl}\n`));

    await open(authUrl);

    // Wait for callback
    console.log(chalk.yellow('⏳ Waiting for authorization callback...'));
    console.log(chalk.gray('   Complete the authentication in your browser.\n'));

    await this.waitForCallback();
    
    console.log(chalk.green('✓ Authorization code received!'));

    // Exchange code for token
    await this.exchangeCodeForToken(oauth2Config.token_uri);
  }

  private async startCallbackServer(): Promise<void> {
    const app = express();
    
    app.get('/callback', (req, res) => {
      this.authorizationCode = req.query.code as string;
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authorization Complete</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #28a745; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Authorization Successful!</h1>
            <p>You can close this window and return to the terminal.</p>
          </div>
          <script>setTimeout(() => window.close(), 2000);</script>
        </body>
        </html>
      `);
    });

    this.callbackServer = createServer(app);
    await new Promise<void>((resolve) => {
      this.callbackServer.listen(CALLBACK_PORT, () => resolve());
    });
  }

  private async waitForCallback(): Promise<void> {
    const timeout = 60000; // 60 seconds
    const startTime = Date.now();

    while (!this.authorizationCode) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for authorization callback');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async exchangeCodeForToken(tokenUri: string): Promise<void> {
    console.log(chalk.yellow('\n🔄 Exchanging authorization code for access token...'));

    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: this.authorizationCode,
        client_id: 'mcp-test-client',
        client_secret: 'test-secret',
        redirect_uri: CALLBACK_URL,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;

    console.log(chalk.green('✓ Access token received!'));
    console.log(chalk.gray(`Token type: ${tokenData.token_type}`));
    console.log(chalk.gray(`Expires in: ${tokenData.expires_in} seconds`));
  }

  private async testAuthenticatedAccess(): Promise<void> {
    console.log(chalk.yellow('\n🔑 Testing authenticated access to MCP endpoint...'));

    const response = await fetch(`${BASE_URL}/mcp/core`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 2,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authenticated request failed: ${response.status}`);
    }

    const data = await response.json();
    
    console.log(chalk.green('✓ Successfully accessed MCP endpoint!'));
    console.log(chalk.gray(`\nAvailable tools: ${data.result.tools.length}`));
    
    // Show first 5 tools
    console.log(chalk.blue('\n📦 Sample tools:'));
    data.result.tools.slice(0, 5).forEach((tool: any) => {
      console.log(chalk.gray(`   • ${chalk.white(tool.name)}: ${tool.description}`));
    });

    // Test a tool call
    const { testTool } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'testTool',
        message: '\nTest a tool call?',
        default: true,
      },
    ]);

    if (testTool) {
      await this.testToolCall();
    }
  }

  private async testToolCall(): Promise<void> {
    console.log(chalk.yellow('\n🔧 Testing tool call: get_working_directory'));

    const response = await fetch(`${BASE_URL}/mcp/core`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_working_directory',
          arguments: {},
        },
        id: 3,
      }),
    });

    const data = await response.json();
    
    if (data.result) {
      console.log(chalk.green('✓ Tool call successful!'));
      console.log(chalk.gray('Working directory:'), data.result[0].content);
    } else {
      console.log(chalk.red('✗ Tool call failed:'), data.error);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.callbackServer) {
      await new Promise<void>((resolve) => {
        this.callbackServer.close(() => resolve());
      });
    }
  }
}

// Run the test
const tester = new MCPOAuthTester();
tester.run().catch(console.error);

export { MCPOAuthTester };