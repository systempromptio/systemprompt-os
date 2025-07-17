/**
 * OAuth2 IDP flow end-to-end tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fetch } from 'undici';
import { randomBytes } from 'crypto';
import { TEST_CONFIG } from '../fixtures/test-config.js';

const BASE_URL = TEST_CONFIG.BASE_URL || 'http://localhost:3000';

describe('OAuth2 IDP Flow', () => {
  let clientId: string;
  let redirectUri: string;
  
  beforeAll(() => {
    clientId = 'test-client-001';
    redirectUri = 'http://localhost:8080/callback';
  });
  
  describe('Discovery', () => {
    it('should return OpenID configuration', async () => {
      const response = await fetch(`${BASE_URL}/.well-known/openid-configuration`);
      expect(response.status).toBe(200);
      
      const config = await response.json() as any;
      
      expect(config.issuer).toBe(BASE_URL);
      expect(config.authorization_endpoint).toBe(`${BASE_URL}/oauth2/authorize`);
      expect(config.token_endpoint).toBe(`${BASE_URL}/oauth2/token`);
      expect(config.userinfo_endpoint).toBe(`${BASE_URL}/oauth2/userinfo`);
      expect(config.jwks_uri).toBe(`${BASE_URL}/.well-known/jwks.json`);
    });
    
    it('should return JWKS', async () => {
      const response = await fetch(`${BASE_URL}/.well-known/jwks.json`);
      expect(response.status).toBe(200);
      
      const jwks = await response.json() as any;
      expect(jwks.keys).toBeInstanceOf(Array);
      expect(jwks.keys.length).toBeGreaterThan(0);
    });
  });
  
  describe('IDP Selection Flow', () => {
    it('should display IDP selection page when no provider specified', async () => {
      const state = randomBytes(16).toString('hex');
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'openid profile email',
        state: state,
      });
      
      const response = await fetch(`${BASE_URL}/oauth2/authorize?${params}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('Sign In');
      expect(html).toContain('Continue with Google');
      // GitHub only shows if GITHUB_CLIENT_ID is configured
      expect(html).toContain(clientId);
    });
    
    it('should redirect to Google when Google provider is selected', async () => {
      const state = randomBytes(16).toString('hex');
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'openid profile email',
        state: state,
        provider: 'google', // Select Google as IDP
      });
      
      const response = await fetch(`${BASE_URL}/oauth2/authorize?${params}`, {
        redirect: 'manual', // Don't follow redirects
      });
      
      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      expect(location).toContain('accounts.google.com');
      expect(location).toContain('client_id=457978849271');
    });
    
    it('should handle provider callback simulation', async () => {
      // This test simulates what happens when Google redirects back
      // In a real scenario, the user would authenticate with Google
      const providerCode = 'mock-google-auth-code';
      const state = randomBytes(16).toString('hex');
      
      // Note: This endpoint would normally be called by Google
      // We can't test the full flow without actually authenticating
      const response = await fetch(`${BASE_URL}/oauth2/callback/google?code=${providerCode}&state=${state}`, {
        redirect: 'manual',
      });
      
      // Should fail because we don't have a valid session
      expect(response.status).toBe(400);
    });
  });
  
  describe('Token Exchange', () => {
    it('should reject token exchange without valid authorization code', async () => {
      const response = await fetch(`${BASE_URL}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: 'invalid-code',
          redirect_uri: redirectUri,
          client_id: clientId,
        }),
      });
      
      expect(response.status).toBe(400);
      const error = await response.json() as any;
      expect(error.error).toBe('invalid_grant');
    });
  });
  
  describe('Protected Resources', () => {
    it('should reject userinfo request without token', async () => {
      const response = await fetch(`${BASE_URL}/oauth2/userinfo`);
      
      expect(response.status).toBe(401);
      const error = await response.json() as any;
      expect(error.error).toBe('unauthorized');
    });
    
    it('should reject userinfo request with invalid token', async () => {
      const response = await fetch(`${BASE_URL}/oauth2/userinfo`, {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });
      
      expect(response.status).toBe(401);
      const error = await response.json() as any;
      expect(error.error).toBe('unauthorized');
    });
  });
  
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect(response.status).toBe(200);
      
      const health = await response.json() as any;
      expect(health.status).toBe('ok');
      expect(health.service).toBe('systemprompt-os');
    });
  });
});

// Note: Full OAuth2 flow with real IDP authentication cannot be tested
// in automated tests without browser automation or mock IDPs.
// These tests verify the OAuth2 server endpoints are working correctly.