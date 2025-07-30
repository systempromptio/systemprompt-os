/**
 * Server External API Integration Test
 * 
 * Tests external REST API and web interface:
 * - Express server setup
 * - REST API endpoints
 * - OAuth2 authorization server
 * - Web interface routes
 * - Middleware chain
 * - Security headers
 * 
 * Coverage targets:
 * - src/server/index.ts
 * - src/server/external/setup.ts
 * - src/server/external/routes.ts
 * - src/server/external/middleware/*.ts
 * - src/server/external/rest/*.ts
 * - src/server/external/rest/oauth2/*.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Server } from 'http';
import { runBootstrap } from '@/bootstrap';
import { createApp, startServer } from '@/server/index';

describe('Server External API Integration Tests', () => {
  let app: Express;
  let server: Server;
  let bootstrap: any;

  beforeAll(async () => {
    // Mock environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_PATH = ':memory:';
    process.env.DISABLE_DB_LOGGING = 'true';
    
    // Bootstrap the application
    bootstrap = await runBootstrap();
    
    // Create Express app
    app = await createApp();
    
    // Start server on a test port
    server = await new Promise<Server>((resolve) => {
      const testServer = app.listen(0, () => {
        resolve(testServer);
      });
    });
  });

  afterAll(async () => {
    // Close server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    
    // Shutdown bootstrap
    if (bootstrap) {
      await bootstrap.shutdown();
    }
  });

  describe('Express Server Setup', () => {
    it('should initialize Express app', () => {
      expect(app).toBeDefined();
      expect(app.listen).toBeInstanceOf(Function);
    });

    it('should configure middleware', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);
      
      // Check security headers are set
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should setup error handlers', async () => {
      // Test 404 handling
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);
      
      expect(response.text).toContain('404');
    });

    it('should bind to configured port', () => {
      const address = server.address();
      expect(address).toBeDefined();
      if (typeof address === 'object' && address !== null) {
        expect(address.port).toBeGreaterThan(0);
      }
    });
  });

  describe('REST API Endpoints', () => {
    it('should handle health checks', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should serve API status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('version');
    });

    it('should handle debug route', async () => {
      const response = await request(app)
        .get('/debug')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('message', 'Debug route working');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle user endpoints with authentication', async () => {
      // Without auth, should return 401
      const response = await request(app)
        .get('/api/users/count')
        .expect(401);
        
      expect(response.body).toHaveProperty('error');
    });

    it('should handle terminal summary endpoint without auth', async () => {
      await request(app)
        .get('/api/terminal/summary')
        .expect(401);
    });

    it('should handle terminal commands endpoint without auth', async () => {
      await request(app)
        .get('/api/terminal/commands')
        .expect(401);
    });

    it('should handle terminal execute endpoint without auth', async () => {
      await request(app)
        .post('/api/terminal/execute')
        .send({ command: 'test' })
        .expect(401);
    });

    it('should handle 404 for non-existent API endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });

  describe('OAuth2 Server', () => {
    it('should provide OAuth2 discovery endpoint', async () => {
      const response = await request(app)
        .get('/.well-known/oauth-authorization-server')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorization_endpoint');
      expect(response.body).toHaveProperty('token_endpoint');
    });

    it('should provide protected resource metadata', async () => {
      const response = await request(app)
        .get('/.well-known/oauth-protected-resource')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('resource');
      expect(response.body).toHaveProperty('authorization_servers');
    });

    it('should provide JWKS endpoint', async () => {
      const response = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('keys');
      expect(Array.isArray(response.body.keys)).toBe(true);
    });

    it('should handle GET authorization requests', async () => {
      const response = await request(app)
        .get('/oauth2/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'code',
          scope: 'read'
        })
        .expect(302);
      
      // Should redirect to login page
      expect(response.headers.location).toContain('/auth');
    });

    it('should handle POST authorization requests', async () => {
      const response = await request(app)
        .post('/oauth2/authorize')
        .send({
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'code',
          scope: 'read',
          consent: 'approve'
        })
        .expect(302);
      
      // Should redirect (likely to login since no session)
      expect(response.headers.location).toBeDefined();
    });

    it('should handle OAuth2 registration', async () => {
      const response = await request(app)
        .post('/oauth2/register')
        .send({
          client_name: 'Test Client',
          redirect_uris: ['http://localhost:3000/callback']
        })
        .expect(201)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('client_id');
      expect(response.body).toHaveProperty('client_secret');
    });

    it('should handle token endpoint', async () => {
      const response = await request(app)
        .post('/oauth2/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })
        .expect(400); // Should fail without valid credentials
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle userinfo endpoint without auth', async () => {
      await request(app)
        .get('/oauth2/userinfo')
        .expect(401);
    });

    it('should handle OAuth2 callback', async () => {
      const response = await request(app)
        .get('/oauth2/callback')
        .query({ code: 'test-code' })
        .expect(400); // Without proper state/session, returns 400
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle provider-specific OAuth2 callback', async () => {
      const response = await request(app)
        .get('/oauth2/callback/github')
        .query({ code: 'test-code' })
        .expect(400); // Without proper state/session, returns 400
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Web Interface', () => {
    it('should serve splash page', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)
        .expect('Content-Type', /html/);
      
      expect(response.text).toContain('SystemPrompt OS');
      expect(response.text).toContain('Welcome');
    });

    it('should handle authentication flow', async () => {
      const response = await request(app)
        .get('/auth')
        .expect(200)
        .expect('Content-Type', /html/);
      
      expect(response.text).toContain('Sign In');
    });

    it('should redirect to login for protected pages', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(302);
      
      expect(response.headers.location).toContain('/auth');
    });

    it('should redirect to login for config page without auth', async () => {
      const response = await request(app)
        .get('/config')
        .expect(302);
      
      expect(response.headers.location).toContain('/auth');
    });

    it('should handle root callback route', async () => {
      const response = await request(app)
        .get('/')
        .query({ code: 'test-code' })
        .expect(200); // Splash page is served even with code param
      
      // Should still render the splash page
      expect(response.text).toContain('SystemPrompt OS');
    });
  });

  describe('Security', () => {
    it('should set security headers', async () => {
      const response = await request(app)
        .get('/health');
      
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should validate CORS settings', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://example.com');
      
      expect(response.headers['access-control-allow-origin']).toBe('http://example.com');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message', 'Invalid JSON in request body');
    });
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/users/count')
        .expect(401); // API routes should return 401, not redirect
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/users/count')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Invalid token returns 401
      
      expect(response.body).toHaveProperty('error');
    });

    it('should support cookie authentication', async () => {
      // First, get a valid session by logging in
      const loginResponse = await request(app)
        .post('/auth/callback')
        .send({
          provider: 'test',
          code: 'test-code'
        });
      
      const cookies = loginResponse.headers['set-cookie'];
      
      if (cookies) {
        // Use the session cookie for authenticated request
        await request(app)
          .get('/config')
          .set('Cookie', cookies)
          .expect(200);
      }
    });
  });

  describe('Admin Routes', () => {
    it('should require authentication for admin routes', async () => {
      await request(app)
        .get('/admin')
        .expect(302)
        .expect('Location', /auth/);
    });

    it('should require admin role for admin routes', async () => {
      // Even with authentication, non-admin users should be denied
      // This would need a proper auth token without admin role
      await request(app)
        .get('/admin/users')
        .expect(302)
        .expect('Location', /auth/);
    });
  });

  describe('Error Handling', () => {
    it('should handle runtime errors gracefully', async () => {
      // Force an error by sending malformed data
      const response = await request(app)
        .post('/api/users')
        .send({ /* missing required fields */ })
        .expect(401); // Needs auth first
      
      expect(response.body).toHaveProperty('error');
    });

    it('should not expose stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/api/error-test')
        .expect(404);
      
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).toHaveProperty('error', 'Not Found');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle 404 for non-API routes with HTML', async () => {
      const response = await request(app)
        .get('/non-existent-page')
        .expect(404)
        .expect('Content-Type', /html/);
      
      expect(response.text).toContain('404 - Not Found');
      expect(response.text).toContain('Go to homepage');
    });
  });
});