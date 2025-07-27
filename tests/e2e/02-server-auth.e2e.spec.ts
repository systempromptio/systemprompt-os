import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { TEST_CONFIG } from './bootstrap.js';

/**
 * Server Auth Domain E2E Tests
 * 
 * Tests the critical functionality of the authentication domain including:
 * - OAuth2 Authorization Server Discovery
 * - OAuth2 Authorization Flow
 * - OAuth2 Token Endpoint
 * - Protected Endpoints
 * - JWT handling
 */
describe('[02] Server Auth Domain', () => {
  const baseUrl = TEST_CONFIG.baseUrl;

  describe('OAuth2 Authorization Server Discovery', () => {
    it('should provide OAuth 2.1 authorization server metadata', async () => {
      const response = await request(baseUrl).get('/.well-known/oauth-authorization-server');
      if (response.status !== 200) {
        console.error('OAuth endpoint error:', response.status, JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('issuer', baseUrl);
      expect(response.body).toHaveProperty('authorization_endpoint', `${baseUrl}/oauth2/authorize`);
      expect(response.body).toHaveProperty('token_endpoint', `${baseUrl}/oauth2/token`);
      expect(response.body).toHaveProperty('userinfo_endpoint', `${baseUrl}/oauth2/userinfo`);
      expect(response.body).toHaveProperty('jwks_uri', `${baseUrl}/.well-known/jwks.json`);
    });

    it('should include supported OAuth2 features', async () => {
      const response = await request(baseUrl).get('/.well-known/oauth-authorization-server');
      expect(response.body).toHaveProperty('response_types_supported');
      expect(response.body.response_types_supported).toContain('code');
      expect(response.body).toHaveProperty('grant_types_supported');
      expect(response.body.grant_types_supported).toContain('authorization_code');
      expect(response.body).toHaveProperty('subject_types_supported');
      expect(response.body.subject_types_supported).toContain('public');
      expect(response.body).toHaveProperty('id_token_signing_alg_values_supported');
      expect(response.body.id_token_signing_alg_values_supported).toContain('RS256');
    });

    it('should provide JWKS endpoint', async () => {
      const response = await request(baseUrl).get('/.well-known/jwks.json');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('keys');
      expect(Array.isArray(response.body.keys)).toBe(true);
      expect(response.body.keys.length).toBeGreaterThan(0);
      
      const key = response.body.keys[0];
      expect(key).toHaveProperty('kty');
      expect(key).toHaveProperty('use', 'sig');
      expect(key).toHaveProperty('kid');
      expect(key).toHaveProperty('alg');
    });
  });

  describe('OAuth2 Authorization Flow', () => {
    it('should reject authorization request without client_id', async () => {
      const response = await request(baseUrl)
        .get('/oauth2/authorize')
        .query({
          response_type: 'code',
          redirect_uri: 'http://localhost:8080/callback',
          state: 'test-state'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_request');
      expect(response.body).toHaveProperty('error_description');
      expect(response.body.error_description).toContain('client_id');
    });

    it('should reject authorization request without response_type', async () => {
      const response = await request(baseUrl)
        .get('/oauth2/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'http://localhost:8080/callback',
          state: 'test-state'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_request');
      expect(response.body.error_description).toContain('response_type');
    });

    it('should reject unsupported response_type', async () => {
      const response = await request(baseUrl)
        .get('/oauth2/authorize')
        .query({
          client_id: 'test-client',
          response_type: 'token',
          redirect_uri: 'http://localhost:8080/callback',
          state: 'test-state'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'unsupported_response_type');
    });

    it('should show IDP selection for valid authorization request', async () => {
      const response = await request(baseUrl)
        .get('/oauth2/authorize')
        .query({
          client_id: 'test-client',
          response_type: 'code',
          redirect_uri: 'http://localhost:8080/callback',
          state: 'test-state',
          scope: 'profile email'
        });
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Sign in to continue');
      expect(response.text).toContain('Google');
      expect(response.text).toContain('GitHub');
    });

    it('should handle IDP selection and redirect', async () => {
      const response = await request(baseUrl)
        .post('/oauth2/authorize')
        .send({
          client_id: 'test-client',
          response_type: 'code',
          redirect_uri: 'http://localhost:8080/callback',
          state: 'test-state',
          idp: 'google'
        });
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(response.headers.location).toContain('client_id=test-google-client');
      expect(response.headers.location).toContain('state=');
    });
  });

  describe('OAuth2 Token Endpoint', () => {
    it('should reject token request without grant_type', async () => {
      const response = await request(baseUrl)
        .post('/oauth2/token')
        .send({
          code: 'test-code',
          client_id: 'test-client',
          client_secret: 'test-secret'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_request');
      expect(response.body.error_description).toContain('grant_type');
    });

    it('should reject unsupported grant_type', async () => {
      const response = await request(baseUrl)
        .post('/oauth2/token')
        .send({
          grant_type: 'password',
          username: 'test',
          password: 'test'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'unsupported_grant_type');
    });

    it('should validate authorization_code grant requirements', async () => {
      const response = await request(baseUrl)
        .post('/oauth2/token')
        .send({
          grant_type: 'authorization_code',
          client_id: 'test-client',
          client_secret: 'test-secret'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_request');
      expect(response.body.error_description).toContain('code');
    });

    it('should reject invalid authorization code', async () => {
      const response = await request(baseUrl)
        .post('/oauth2/token')
        .send({
          grant_type: 'authorization_code',
          code: 'invalid-code',
          client_id: 'test-client',
          client_secret: 'test-secret',
          redirect_uri: 'http://localhost:8080/callback'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_grant');
    });

    it('should handle refresh_token grant type', async () => {
      const response = await request(baseUrl)
        .post('/oauth2/token')
        .send({
          grant_type: 'refresh_token',
          refresh_token: 'invalid-refresh-token',
          client_id: 'test-client',
          client_secret: 'test-secret'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_grant');
    });
  });

  describe('Protected Endpoints', () => {
    it('should reject userinfo request without token', async () => {
      const response = await request(baseUrl).get('/oauth2/userinfo');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'invalid_token');
      expect(response.body).toHaveProperty('error_description', 'No access token provided');
    });

    it('should reject userinfo request with invalid bearer token', async () => {
      const response = await request(baseUrl)
        .get('/oauth2/userinfo')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'invalid_token');
      expect(response.body.error_description).toContain('Invalid or expired token');
    });

    it('should reject userinfo request with malformed authorization header', async () => {
      const response = await request(baseUrl)
        .get('/oauth2/userinfo')
        .set('Authorization', 'InvalidScheme token');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'invalid_token');
    });
  });

  describe('Authorization Callback', () => {
    it('should handle OAuth callback with error', async () => {
      const response = await request(baseUrl)
        .get('/oauth2/callback')
        .query({
          error: 'access_denied',
          error_description: 'User denied access',
          state: 'test-state'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'access_denied');
    });

    it('should validate state parameter in callback', async () => {
      const response = await request(baseUrl)
        .get('/oauth2/callback')
        .query({
          code: 'test-code',
          state: 'invalid-state'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_request');
      expect(response.body.error_description).toContain('state');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers on auth endpoints', async () => {
      const response = await request(baseUrl).get('/oauth2/authorize?client_id=test');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('content-security-policy');
    });
  });
});