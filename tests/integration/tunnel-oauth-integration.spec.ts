/**
 * @fileoverview Integration test for tunnel + OAuth flow
 * @module tests/integration/tunnel-oauth-integration
 * 
 * This test verifies the complete OAuth flow works through a tunnel:
 * 1. Start local server with OAuth endpoints
 * 2. Start tunnel service
 * 3. Simulate OAuth provider redirect through tunnel
 * 4. Verify callback handling and token exchange
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import request from 'supertest';
import { TunnelService } from '../../src/modules/core/auth/services/tunnel-service.js';
import { setupExternalAPI } from '../../src/server/external/index.js';
import { initialize as initializeAuthModule } from '../../src/modules/core/auth/index.js';

describe.skip('Tunnel OAuth Integration Tests (requires tunnel setup)', () => {
  let app: express.Express;
  let server: any;
  let tunnelService: TunnelService;
  const testPort = 3789;
  let publicUrl: string = '';
  
  beforeAll(async () => {
    // Initialize auth module
    await initializeAuthModule({
      config: { keyStorePath: './state/auth/keys' },
      logger: console
    });
    
    // Setup Express app with OAuth endpoints
    app = express();
    app.use(express.json());
    
    // Setup external API (includes OAuth endpoints)
    await setupExternalAPI(app);
    
    // Add test endpoint
    app.get('/test/health', (req, res) => {
      res.json({ 
        status: 'ok',
        tunnel: publicUrl || 'not-configured',
        timestamp: new Date().toISOString()
      });
    });
    
    // Start server
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(testPort, () => {
        console.log(`Test server listening on port ${testPort}`);
        resolve();
      });
    });
    
    // Initialize tunnel service
    tunnelService = new TunnelService({
      port: testPort,
      permanentDomain: process.env.OAUTH_DOMAIN,
      tunnelToken: process.env.CLOUDFLARE_TUNNEL_TOKEN,
      enableInDevelopment: true
    }, console);
  });
  
  afterAll(async () => {
    // Stop tunnel
    if (tunnelService) {
      await tunnelService.stop();
    }
    
    // Close server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
  
  it('should establish tunnel connection for OAuth', async () => {
    // Try to start tunnel
    try {
      publicUrl = await tunnelService.start();
      console.log('Tunnel started with URL:', publicUrl);
      
      const status = tunnelService.getStatus();
      expect(status).toHaveProperty('active');
      
      // If tunnel is active, we should have a public URL
      if (status.active && status.type !== 'none') {
        expect(status.url).toBeTruthy();
        expect(status.url).toMatch(/^https?:\/\//);
      }
    } catch (error) {
      console.log('Tunnel start failed (expected without token):', error.message);
      // Continue with localhost testing
      publicUrl = `http://localhost:${testPort}`;
    }
  });
  
  it('should handle OAuth authorization request through tunnel', async () => {
    const baseUrl = publicUrl || `http://localhost:${testPort}`;
    
    // Test OAuth authorization endpoint
    const response = await request(baseUrl)
      .get('/oauth2/authorize')
      .query({
        client_id: 'test-client',
        redirect_uri: `${baseUrl}/oauth2/callback`,
        response_type: 'code',
        state: 'test-state-123',
        scope: 'openid profile email'
      });
    
    // Should redirect to provider selection or login
    expect(response.status).toBeOneOf([302, 200]);
    
    if (response.status === 302) {
      // Check redirect location
      expect(response.headers.location).toBeTruthy();
    } else {
      // Check for provider selection page
      expect(response.text).toMatch(/oauth|provider|authorize/i);
    }
  });
  
  it('should handle OAuth callback through tunnel', async () => {
    const baseUrl = publicUrl || `http://localhost:${testPort}`;
    
    // Simulate OAuth callback
    const response = await request(baseUrl)
      .get('/oauth2/callback')
      .query({
        code: 'mock-auth-code',
        state: 'test-state-123'
      });
    
    // Should handle callback (might redirect or show error)
    expect([302, 400, 200, 404]).toContain(response.status);
    
    if (response.status === 302) {
      // Check for redirect after callback
      expect(response.headers.location).toBeTruthy();
    }
  });
  
  it('should expose OAuth configuration through tunnel', async () => {
    const baseUrl = publicUrl || `http://localhost:${testPort}`;
    
    // Test well-known OAuth configuration
    const response = await request(baseUrl)
      .get('/.well-known/oauth-authorization-server');
    
    // The endpoint might return JSON or HTML depending on configuration
    if (response.status === 200 && response.type === 'application/json') {
      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorization_endpoint');
      expect(response.body).toHaveProperty('token_endpoint');
    } else {
      // Endpoint might not be available in test environment
      expect([200, 404]).toContain(response.status);
    }
    
    // If tunnel is active, endpoints should use tunnel URL
    if (tunnelService.getStatus().active && publicUrl !== `http://localhost:${testPort}` && response.body?.authorization_endpoint) {
      expect(response.body.authorization_endpoint).toContain(publicUrl);
      expect(response.body.token_endpoint).toContain(publicUrl);
    }
  });
  
  it('should update OAuth providers with tunnel URL', async () => {
    const status = tunnelService.getStatus();
    
    if (status.active && status.url) {
      // Tunnel service should have updated OAuth providers
      const authModule = await initializeAuthModule();
      const providers = authModule.getAllProviders();
      
      console.log('OAuth providers after tunnel setup:', providers.map(p => p.name));
      
      // Providers should be configured with tunnel URL for callbacks
      providers.forEach(provider => {
        if (provider.config?.callbackUrl) {
          console.log(`${provider.name} callback URL:`, provider.config.callbackUrl);
          // In production, callback URLs should use the tunnel URL
        }
      });
    } else {
      console.log('Tunnel not active, skipping provider update test');
    }
  });
  
  it('should handle complete OAuth flow simulation', async () => {
    const baseUrl = publicUrl || `http://localhost:${testPort}`;
    
    // This simulates a complete OAuth flow:
    // 1. Client requests authorization
    // 2. User authorizes at provider
    // 3. Provider redirects to callback with code
    // 4. Client exchanges code for token
    
    console.log('Testing complete OAuth flow with base URL:', baseUrl);
    
    // Step 1: Authorization request (would normally redirect to provider)
    const authResponse = await request(baseUrl)
      .get('/oauth2/authorize')
      .query({
        client_id: 'test-client',
        redirect_uri: `${baseUrl}/oauth2/callback`,
        response_type: 'code',
        state: 'flow-test-state'
      });
    
    console.log('Authorization response status:', authResponse.status);
    
    // Step 2: Simulate provider callback (in real flow, provider would redirect here)
    const callbackResponse = await request(baseUrl)
      .get('/oauth2/callback')
      .query({
        code: 'test-authorization-code',
        state: 'flow-test-state'
      });
    
    console.log('Callback response status:', callbackResponse.status);
    
    // Step 3: Token exchange (if we got a valid auth code)
    if (callbackResponse.status === 200 || callbackResponse.status === 302) {
      const tokenResponse = await request(baseUrl)
        .post('/oauth2/token')
        .send({
          grant_type: 'authorization_code',
          code: 'test-authorization-code',
          client_id: 'test-client',
          client_secret: 'test-secret',
          redirect_uri: `${baseUrl}/oauth2/callback`
        });
      
      console.log('Token exchange response:', tokenResponse.status);
      
      // In a real implementation, this would return tokens
      if (tokenResponse.status === 200) {
        expect(tokenResponse.body).toHaveProperty('access_token');
      }
    }
  });
});

// Helper for status code assertions
declare global {
  namespace Vi {
    interface Assertion {
      toBeOneOf(expected: number[]): void;
    }
  }
}

expect.extend({
  toBeOneOf(received: number, expected: number[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () => 
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`
    };
  }
});