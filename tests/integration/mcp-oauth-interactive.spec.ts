/**
 * @fileoverview Interactive MCP OAuth2 flow test using MCP SDK
 * @module tests/integration/mcp-oauth-interactive
 * 
 * This test demonstrates the complete OAuth2 flow with user interaction:
 * 1. Attempts to connect to MCP server
 * 2. Handles 401 authentication required
 * 3. Prompts user to complete OAuth in browser
 * 4. Uses the token to successfully connect
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import inquirer from 'inquirer';
import open from 'open';
import express from 'express';
import { createServer } from 'http';

/**
 * HTTP Transport for MCP client
 */
class HttpClientTransport {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  async start(): Promise<void> {
    // HTTP transport doesn't need to "start"
  }

  async send(message: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/mcp/core`, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    });

    const data = await response.json();

    // Check for authentication error
    if (response.status === 401 && data.error?.code === -32001) {
      throw new AuthenticationError(data.error.message, data.error.data);
    }

    return data;
  }

  async close(): Promise<void> {
    // HTTP transport doesn't need to "close"
  }

  onMessage(handler: (message: any) => void): void {
    // HTTP is request/response, not streaming
  }

  onError(handler: (error: Error) => void): void {
    // HTTP errors are thrown from send()
  }

  onClose(handler: () => void): void {
    // HTTP doesn't have persistent connections
  }
}

class AuthenticationError extends Error {
  constructor(message: string, public data: any) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

describe('Interactive MCP OAuth2 Flow', () => {
  let callbackServer: any;
  let authorizationCode: string | null = null;
  const PORT = 4567;
  const BASE_URL = 'http://localhost:3000';
  const CALLBACK_URL = `http://localhost:${PORT}/callback`;

  beforeAll(async () => {
    // Create a local server to handle OAuth callback
    const app = express();
    
    app.get('/callback', (req, res) => {
      authorizationCode = req.query.code as string;
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Authorization Successful!</h1>
            <p>You can close this window and return to the terminal.</p>
            <script>window.close();</script>
          </body>
        </html>
      `);
    });

    callbackServer = createServer(app);
    await new Promise<void>((resolve) => {
      callbackServer.listen(PORT, () => resolve());
    });
  });

  afterAll(async () => {
    if (callbackServer) {
      await new Promise<void>((resolve) => {
        callbackServer.close(() => resolve());
      });
    }
  });

  it('should complete OAuth2 flow interactively and list MCP tools', async () => {
    console.log('\n🔐 Starting Interactive MCP OAuth2 Flow Test\n');

    const transport = new HttpClientTransport(BASE_URL);
    const client = new Client(
      {
        name: 'mcp-oauth-test',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Step 1: Try to connect without authentication
    console.log('📡 Attempting to connect to MCP server without authentication...');
    
    try {
      await client.connect(transport as any);
      // Try to list tools without auth
      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        console.log('❌ Authentication required (as expected)');
        console.log('\n📋 OAuth2 Configuration received:');
        console.log(JSON.stringify(error.data.oauth2, null, 2));

        const oauth2Config = error.data.oauth2;

        // Step 2: Prompt user to start OAuth flow
        const { startAuth } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'startAuth',
            message: 'Would you like to authenticate via OAuth2?',
            default: true,
          },
        ]);

        if (!startAuth) {
          console.log('❌ Test cancelled by user');
          return;
        }

        // Step 3: Select provider
        const { provider } = await inquirer.prompt([
          {
            type: 'list',
            name: 'provider',
            message: 'Select an identity provider:',
            choices: [
              { name: 'Google', value: 'google' },
              { name: 'GitHub', value: 'github' },
            ],
          },
        ]);

        // Step 4: Build authorization URL
        const authParams = new URLSearchParams({
          response_type: 'code',
          client_id: 'mcp-test-client',
          redirect_uri: CALLBACK_URL,
          scope: 'openid email profile',
          state: 'test-state-' + Date.now(),
          provider: provider,
        });

        const authUrl = `${oauth2Config.authorization_uri}?${authParams}`;

        console.log('\n🌐 Opening browser for authentication...');
        console.log(`📍 Authorization URL: ${authUrl}`);
        
        // Open browser
        await open(authUrl);

        // Step 5: Wait for callback
        console.log('\n⏳ Waiting for authorization callback...');
        console.log('   Please complete the authentication in your browser.');

        // Poll for authorization code
        let attempts = 0;
        while (!authorizationCode && attempts < 60) { // 60 second timeout
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        if (!authorizationCode) {
          throw new Error('Timeout waiting for authorization callback');
        }

        console.log('✅ Authorization code received!');

        // Step 6: Exchange code for token
        console.log('\n🔄 Exchanging authorization code for access token...');

        const tokenResponse = await fetch(`${BASE_URL}/oauth2/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code: authorizationCode,
            client_id: 'mcp-test-client',
            client_secret: 'test-secret', // In production, this would be secure
            redirect_uri: CALLBACK_URL,
          }),
        });

        if (!tokenResponse.ok) {
          const error = await tokenResponse.json();
          throw new Error(`Token exchange failed: ${JSON.stringify(error)}`);
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Access token received!');

        // Step 7: Use token to access MCP
        console.log('\n🔑 Connecting to MCP server with authentication...');
        transport.setToken(tokenData.access_token);

        // Now try to list tools with authentication
        const toolsResponse = await transport.send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2,
        });

        expect(toolsResponse).toHaveProperty('result');
        expect(toolsResponse.result).toHaveProperty('tools');
        expect(Array.isArray(toolsResponse.result.tools)).toBe(true);

        console.log('\n✅ Successfully authenticated and connected to MCP server!');
        console.log(`📦 Available tools: ${toolsResponse.result.tools.length}`);
        
        // List first few tools
        console.log('\n📋 Sample tools:');
        toolsResponse.result.tools.slice(0, 5).forEach((tool: any) => {
          console.log(`   - ${tool.name}: ${tool.description}`);
        });

        // Test calling a specific tool
        const { testTool } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'testTool',
            message: '\nWould you like to test calling a tool?',
            default: true,
          },
        ]);

        if (testTool) {
          console.log('\n🔧 Testing tool call: inspect_directory');
          
          const inspectResponse = await transport.send({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'inspect_directory',
              arguments: {
                path: '.',
              },
            },
            id: 3,
          });

          if (inspectResponse.result) {
            console.log('✅ Tool call successful!');
            console.log('📁 Directory contents:', 
              JSON.stringify(inspectResponse.result, null, 2).slice(0, 500) + '...');
          }
        }

        // Cleanup
        await client.close();
        console.log('\n✨ Test completed successfully!');
      } else {
        throw error;
      }
    }
  }, 120000); // 2 minute timeout for interactive test

  it('should test with pre-configured token (non-interactive)', async () => {
    // This test can run in CI with a pre-configured token
    const testToken = process.env.MCP_TEST_TOKEN;
    
    if (!testToken) {
      console.log('⚠️  Skipping non-interactive test (MCP_TEST_TOKEN not set)');
      return;
    }

    const transport = new HttpClientTransport(BASE_URL);
    transport.setToken(testToken);

    const response = await transport.send({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1,
    });

    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('tools');
    expect(response.result.tools.length).toBeGreaterThan(0);
  });
});

/**
 * Utility to generate a test token for development
 */
describe('Token Generation Utility', () => {
  it('should generate a test token for development', async () => {
    const { generateToken } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'generateToken',
        message: 'Generate a test token for development?',
        default: false,
      },
    ]);

    if (generateToken) {
      // In a real scenario, this would go through proper OAuth
      // For development, we can create a token directly
      console.log('\n🔐 To generate a proper token:');
      console.log('1. Complete the OAuth flow above');
      console.log('2. Save the access_token from the response');
      console.log('3. Set it as MCP_TEST_TOKEN environment variable');
      console.log('\nExample:');
      console.log('export MCP_TEST_TOKEN="your-access-token-here"');
    }
  });
});