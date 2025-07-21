#!/usr/bin/env node
/**
 * @fileoverview Test MCP OAuth2 flow following RFC 9728
 * @module tests/manual/test-mcp-oauth-rfc9728
 * 
 * Run this script to test the OAuth2 flow:
 * npx tsx tests/manual/test-mcp-oauth-rfc9728.ts
 */

import chalk from 'chalk';

const BASE_URL = process.env.BASE_URL || 'https://democontainer.systemprompt.io';

interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported?: string[];
  scopes_supported?: string[];
  resource_documentation?: string;
}

interface OpenIDConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  scopes_supported: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
}

class MCPOAuthRFC9728Tester {
  async run(): Promise<void> {
    console.log(chalk.blue('\n🔐 MCP OAuth2 Flow Test (RFC 9728)\n'));
    console.log(chalk.gray(`Testing against: ${BASE_URL}\n`));
    
    try {
      // Step 1: Make unauthenticated request to MCP endpoint
      console.log(chalk.yellow('1️⃣  Making unauthenticated request to MCP endpoint...'));
      const { wwwAuthenticate } = await this.testUnauthenticatedAccess();
      
      // Step 2: Parse WWW-Authenticate header
      console.log(chalk.yellow('\n2️⃣  Parsing WWW-Authenticate header...'));
      const asUri = this.parseWWWAuthenticate(wwwAuthenticate);
      
      // Step 3: Fetch protected resource metadata
      console.log(chalk.yellow('\n3️⃣  Fetching protected resource metadata...'));
      const resourceMetadata = await this.fetchProtectedResourceMetadata(asUri);
      
      // Step 4: Fetch authorization server metadata
      console.log(chalk.yellow('\n4️⃣  Fetching authorization server metadata...'));
      const authServerMetadata = await this.fetchAuthServerMetadata(resourceMetadata.authorization_servers[0]);
      
      console.log(chalk.green('\n✅ OAuth discovery completed successfully!\n'));
      console.log(chalk.blue('📋 Summary:'));
      console.log(chalk.gray(`   Protected Resource: ${resourceMetadata.resource}`));
      console.log(chalk.gray(`   Authorization Server: ${resourceMetadata.authorization_servers[0]}`));
      console.log(chalk.gray(`   Authorization Endpoint: ${authServerMetadata.authorization_endpoint}`));
      console.log(chalk.gray(`   Token Endpoint: ${authServerMetadata.token_endpoint}`));
      console.log(chalk.gray(`   Supported Scopes: ${resourceMetadata.scopes_supported?.join(', ')}`));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Test failed:'), error);
      process.exit(1);
    }
  }

  private async testUnauthenticatedAccess(): Promise<{ wwwAuthenticate: string }> {
    const response = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      }),
    });

    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }

    const wwwAuthenticate = response.headers.get('www-authenticate');
    if (!wwwAuthenticate) {
      throw new Error('Missing WWW-Authenticate header');
    }

    const data = await response.json();
    
    console.log(chalk.green('   ✓ Received 401 Unauthorized'));
    console.log(chalk.gray(`   WWW-Authenticate: ${wwwAuthenticate}`));
    console.log(chalk.gray(`   Error code: ${data.error.code}`));
    console.log(chalk.gray(`   Error message: ${data.error.message}`));

    return { wwwAuthenticate };
  }

  private parseWWWAuthenticate(header: string): string {
    // Parse: Bearer realm="...", as_uri="..."
    const asUriMatch = header.match(/as_uri="([^"]+)"/);
    if (!asUriMatch) {
      throw new Error('Failed to parse as_uri from WWW-Authenticate header');
    }
    
    const asUri = asUriMatch[1];
    console.log(chalk.green(`   ✓ Parsed as_uri: ${asUri}`));
    
    return asUri;
  }

  private async fetchProtectedResourceMetadata(url: string): Promise<ProtectedResourceMetadata> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch protected resource metadata: ${response.status}`);
    }

    const metadata = await response.json() as ProtectedResourceMetadata;
    
    console.log(chalk.green('   ✓ Protected resource metadata:'));
    console.log(chalk.gray(`     Resource: ${metadata.resource}`));
    console.log(chalk.gray(`     Authorization servers: ${metadata.authorization_servers.join(', ')}`));
    console.log(chalk.gray(`     Bearer methods: ${metadata.bearer_methods_supported?.join(', ')}`));
    console.log(chalk.gray(`     Scopes: ${metadata.scopes_supported?.join(', ')}`));
    
    return metadata;
  }

  private async fetchAuthServerMetadata(authServerUrl: string): Promise<OpenIDConfiguration> {
    // For now, assume the auth server supports OpenID Connect discovery
    const discoveryUrl = `${authServerUrl}/.well-known/openid-configuration`;
    
    console.log(chalk.gray(`   Trying OpenID Connect discovery at: ${discoveryUrl}`));
    
    try {
      const response = await fetch(discoveryUrl);
      
      if (response.ok) {
        const metadata = await response.json() as OpenIDConfiguration;
        console.log(chalk.green('   ✓ Authorization server metadata (OpenID Connect):'));
        console.log(chalk.gray(`     Issuer: ${metadata.issuer}`));
        console.log(chalk.gray(`     Authorization endpoint: ${metadata.authorization_endpoint}`));
        console.log(chalk.gray(`     Token endpoint: ${metadata.token_endpoint}`));
        return metadata;
      }
    } catch (error) {
      // Ignore and try OAuth 2.0 discovery
    }

    // Try OAuth 2.0 Authorization Server Metadata (RFC 8414)
    const oauth2DiscoveryUrl = `${authServerUrl}/.well-known/oauth-authorization-server`;
    console.log(chalk.gray(`   Trying OAuth 2.0 discovery at: ${oauth2DiscoveryUrl}`));
    
    const oauth2Response = await fetch(oauth2DiscoveryUrl);
    
    if (!oauth2Response.ok) {
      // If no discovery is available, construct minimal metadata
      console.log(chalk.yellow('   ⚠️  No authorization server metadata found, using defaults'));
      return {
        issuer: authServerUrl,
        authorization_endpoint: `${authServerUrl}/oauth2/authorize`,
        token_endpoint: `${authServerUrl}/oauth2/token`,
        userinfo_endpoint: `${authServerUrl}/oauth2/userinfo`,
        jwks_uri: `${authServerUrl}/.well-known/jwks.json`,
        response_types_supported: ['code'],
        scopes_supported: ['openid', 'profile', 'email'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256', 'plain']
      };
    }

    const metadata = await oauth2Response.json() as OpenIDConfiguration;
    console.log(chalk.green('   ✓ Authorization server metadata (OAuth 2.0):'));
    console.log(chalk.gray(`     Issuer: ${metadata.issuer}`));
    console.log(chalk.gray(`     Authorization endpoint: ${metadata.authorization_endpoint}`));
    console.log(chalk.gray(`     Token endpoint: ${metadata.token_endpoint}`));
    
    return metadata;
  }
}

// Run the test
const tester = new MCPOAuthRFC9728Tester();
tester.run().catch(console.error);

export { MCPOAuthRFC9728Tester };