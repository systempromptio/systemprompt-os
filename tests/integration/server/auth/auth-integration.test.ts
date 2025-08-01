/**
 * Authentication Integration Tests
 * 
 * These tests verify authentication integration via events:
 * - Token validation through events
 * - Session management via auth module
 * - OAuth flow coordination
 * - Role-based access control
 * - Auth middleware integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServerCore } from '@/server/core/server';
import { HttpProtocolHandler } from '@/server/protocols/http/http-protocol';
import { ServerEvents } from '@/server/core/types/events.types';
import fetch from 'node-fetch';

describe('Authentication Integration Tests', () => {
  let server: ServerCore;
  let httpHandler: HttpProtocolHandler;
  let baseUrl: string;

  beforeEach(async () => {
    server = new ServerCore({ port: 0 });
    httpHandler = new HttpProtocolHandler();
    
    await server.registerProtocol('http', httpHandler);
    await server.start();
    
    const port = server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;

    // Mock auth module responses
    setupAuthMocks();
  });

  afterEach(async () => {
    await server.stop();
  });

  function setupAuthMocks() {
    // Token validation
    server.eventBus.on('auth.validate', async (event) => {
      const tokenMap = {
        'valid-token': {
          valid: true,
          userId: 'user-123',
          scopes: ['read', 'write'],
          sessionId: 'session-456'
        },
        'admin-token': {
          valid: true,
          userId: 'admin-789',
          scopes: ['read', 'write', 'admin'],
          sessionId: 'session-admin',
          roles: ['admin']
        },
        'expired-token': {
          valid: false,
          reason: 'Token expired'
        },
        'limited-token': {
          valid: true,
          userId: 'user-limited',
          scopes: ['read'],
          sessionId: 'session-limited'
        }
      };

      const result = tokenMap[event.token] || { valid: false, reason: 'Invalid token' };
      
      server.eventBus.emit(`response.${event.requestId}`, {
        data: result
      });
    });

    // Role checking
    server.eventBus.on('auth.check.roles', async (event) => {
      const userRoles = {
        'admin-789': ['admin', 'user'],
        'user-123': ['user'],
        'user-limited': ['user']
      };

      const hasRoles = event.roles.every(role => 
        userRoles[event.userId]?.includes(role)
      );

      server.eventBus.emit(`response.${event.requestId}`, {
        data: { hasRoles }
      });
    });

    // Session validation
    server.eventBus.on('auth.session.validate', async (event) => {
      const sessions = {
        'session-456': {
          valid: true,
          userId: 'user-123',
          createdAt: new Date(Date.now() - 3600000),
          lastActivity: new Date(Date.now() - 60000)
        },
        'session-admin': {
          valid: true,
          userId: 'admin-789',
          createdAt: new Date(Date.now() - 7200000),
          lastActivity: new Date()
        },
        'session-expired': {
          valid: false,
          reason: 'Session expired'
        }
      };

      const session = sessions[event.sessionId] || { valid: false, reason: 'Session not found' };
      
      server.eventBus.emit(`response.${event.requestId}`, {
        data: session
      });
    });
  }

  describe('Token-Based Authentication', () => {
    beforeEach(() => {
      // Register test endpoints
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [
          {
            protocol: 'http',
            method: 'GET',
            path: '/api/public',
            handler: 'test.public',
            auth: { required: false }
          },
          {
            protocol: 'http',
            method: 'GET',
            path: '/api/protected',
            handler: 'test.protected',
            auth: { required: true }
          },
          {
            protocol: 'http',
            method: 'GET',
            path: '/api/admin',
            handler: 'test.admin',
            auth: { required: true, roles: ['admin'] }
          }
        ]
      });

      // Set up handlers
      server.eventBus.on('test.public', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { message: 'Public access' }
        });
      });

      server.eventBus.on('test.protected', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { 
            message: 'Protected access',
            user: event.auth?.userId 
          }
        });
      });

      server.eventBus.on('test.admin', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { 
            message: 'Admin access',
            user: event.auth?.userId 
          }
        });
      });
    });

    it('should allow public endpoints without authentication', async () => {
      const response = await fetch(`${baseUrl}/api/public`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Public access');
    });

    it('should require authentication for protected endpoints', async () => {
      // No token
      const response1 = await fetch(`${baseUrl}/api/protected`);
      expect(response1.status).toBe(401);

      // Invalid token
      const response2 = await fetch(`${baseUrl}/api/protected`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      expect(response2.status).toBe(401);

      // Valid token
      const response3 = await fetch(`${baseUrl}/api/protected`, {
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      const data3 = await response3.json();

      expect(response3.status).toBe(200);
      expect(data3.message).toBe('Protected access');
      expect(data3.user).toBe('user-123');
    });

    it('should handle expired tokens', async () => {
      const response = await fetch(`${baseUrl}/api/protected`, {
        headers: { 'Authorization': 'Bearer expired-token' }
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toContain('expired');
    });

    it('should enforce role-based access control', async () => {
      // Regular user token
      const response1 = await fetch(`${baseUrl}/api/admin`, {
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      expect(response1.status).toBe(403);

      // Admin token
      const response2 = await fetch(`${baseUrl}/api/admin`, {
        headers: { 'Authorization': 'Bearer admin-token' }
      });
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.message).toBe('Admin access');
      expect(data2.user).toBe('admin-789');
    });

    it('should check scopes for API access', async () => {
      // Register scope-protected endpoint
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'POST',
          path: '/api/write-protected',
          handler: 'test.write',
          auth: { 
            required: true,
            scopes: ['write']
          }
        }]
      });

      server.eventBus.on('test.write', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { written: true }
        });
      });

      // Token with only read scope
      const response1 = await fetch(`${baseUrl}/api/write-protected`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer limited-token' }
      });
      expect(response1.status).toBe(403);

      // Token with write scope
      const response2 = await fetch(`${baseUrl}/api/write-protected`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      expect(response2.status).toBe(200);
    });
  });

  describe('Session-Based Authentication', () => {
    it('should support cookie-based sessions', async () => {
      // Register session endpoint
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/session-protected',
          handler: 'test.session',
          auth: { 
            required: true,
            sessionBased: true
          }
        }]
      });

      server.eventBus.on('test.session', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { 
            message: 'Session authenticated',
            sessionId: event.auth?.sessionId 
          }
        });
      });

      // Mock cookie parsing
      server.eventBus.on('auth.extract.session', async (event) => {
        const cookie = event.headers.cookie;
        const match = cookie?.match(/session_id=([^;]+)/);
        const sessionId = match?.[1];

        server.eventBus.emit(`response.${event.requestId}`, {
          data: { sessionId }
        });
      });

      // Valid session cookie
      const response = await fetch(`${baseUrl}/api/session-protected`, {
        headers: { 
          'Cookie': 'session_id=session-456; other=value'
        }
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe('session-456');
    });

    it('should handle session expiry', async () => {
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/session-check',
          handler: 'test.sessionCheck',
          auth: { 
            required: true,
            sessionBased: true
          }
        }]
      });

      server.eventBus.on('auth.extract.session', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { sessionId: 'session-expired' }
        });
      });

      const response = await fetch(`${baseUrl}/api/session-check`, {
        headers: { 
          'Cookie': 'session_id=session-expired'
        }
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.message).toContain('expired');
    });
  });

  describe('OAuth Integration', () => {
    beforeEach(() => {
      // OAuth provider configuration
      server.eventBus.on('auth.oauth.providers', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: {
            providers: [
              {
                id: 'github',
                name: 'GitHub',
                authUrl: 'https://github.com/login/oauth/authorize',
                tokenUrl: 'https://github.com/login/oauth/access_token',
                clientId: 'test-client-id'
              },
              {
                id: 'google',
                name: 'Google',
                authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token',
                clientId: 'test-google-client'
              }
            ]
          }
        });
      });

      // OAuth state management
      server.eventBus.on('auth.oauth.create-state', async (event) => {
        const state = `state-${Date.now()}-${Math.random()}`;
        // Store state data
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { state }
        });
      });

      server.eventBus.on('auth.oauth.validate-state', async (event) => {
        // Simple validation for testing
        const valid = event.state.startsWith('state-');
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { 
            valid,
            data: valid ? event.stateData : null
          }
        });
      });
    });

    it('should handle OAuth authorization flow', async () => {
      // Register OAuth endpoints
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'auth',
        endpoints: [
          {
            protocol: 'http',
            method: 'GET',
            path: '/oauth/authorize',
            handler: 'auth.oauth.authorize',
            auth: { required: false }
          },
          {
            protocol: 'http',
            method: 'GET',
            path: '/oauth/callback/:provider',
            handler: 'auth.oauth.callback',
            auth: { required: false }
          }
        ]
      });

      // Authorization handler
      server.eventBus.on('auth.oauth.authorize', async (event) => {
        const { provider = 'github', redirect_uri } = event.query;
        
        // Get provider config
        const providersResponse = await server.eventBus.emitAndWait(
          'auth.oauth.providers',
          { requestId: `oauth-${event.requestId}` },
          { timeout: 1000 }
        );

        const providerConfig = providersResponse.data.providers.find(
          p => p.id === provider
        );

        if (!providerConfig) {
          server.eventBus.emit(`response.${event.requestId}`, {
            error: { code: 'INVALID_PROVIDER', statusCode: 400 }
          });
          return;
        }

        // Create state
        const stateResponse = await server.eventBus.emitAndWait(
          'auth.oauth.create-state',
          {
            requestId: `state-${event.requestId}`,
            provider,
            redirect_uri
          },
          { timeout: 1000 }
        );

        // Build authorization URL
        const authUrl = new URL(providerConfig.authUrl);
        authUrl.searchParams.set('client_id', providerConfig.clientId);
        authUrl.searchParams.set('redirect_uri', redirect_uri || `${baseUrl}/oauth/callback/${provider}`);
        authUrl.searchParams.set('state', stateResponse.data.state);
        authUrl.searchParams.set('scope', 'read:user user:email');

        server.eventBus.emit(`response.${event.requestId}`, {
          data: {
            redirect: authUrl.toString()
          }
        });
      });

      // Test authorization request
      const response = await fetch(`${baseUrl}/oauth/authorize?provider=github`, {
        redirect: 'manual'
      });

      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toContain('github.com/login/oauth/authorize');
      expect(location).toContain('client_id=test-client-id');
      expect(location).toContain('state=state-');
    });

    it('should handle OAuth callback', async () => {
      // Register callback endpoint
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'auth',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/oauth/callback/:provider',
          handler: 'auth.oauth.callback',
          auth: { required: false }
        }]
      });

      // Callback handler
      server.eventBus.on('auth.oauth.callback', async (event) => {
        const { provider } = event.params;
        const { code, state } = event.query;

        // Validate state
        const stateResponse = await server.eventBus.emitAndWait(
          'auth.oauth.validate-state',
          {
            requestId: `validate-${event.requestId}`,
            state,
            stateData: { provider }
          },
          { timeout: 1000 }
        );

        if (!stateResponse.data.valid) {
          server.eventBus.emit(`response.${event.requestId}`, {
            error: { code: 'INVALID_STATE', statusCode: 400 }
          });
          return;
        }

        // Mock token exchange
        server.eventBus.emit('auth.oauth.exchange-code', {
          requestId: event.requestId,
          provider,
          code
        });
      });

      // Handle code exchange
      server.eventBus.on('auth.oauth.exchange-code', async (event) => {
        // Mock successful exchange
        const userData = {
          id: 'oauth-user-123',
          email: 'user@example.com',
          name: 'OAuth User'
        };

        // Create session
        const sessionResponse = await server.eventBus.emitAndWait(
          'auth.session.create',
          {
            requestId: `session-${event.requestId}`,
            userId: userData.id,
            provider: event.provider
          },
          { timeout: 1000 }
        );

        server.eventBus.emit(`response.${event.requestId}`, {
          data: {
            user: userData,
            sessionId: sessionResponse.data?.sessionId || 'new-session',
            redirect: '/dashboard'
          }
        });
      });

      // Mock session creation
      server.eventBus.on('auth.session.create', async (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: {
            sessionId: `session-${event.userId}-${Date.now()}`,
            userId: event.userId
          }
        });
      });

      // Test callback
      const response = await fetch(
        `${baseUrl}/oauth/callback/github?code=test-code&state=state-123`,
        { redirect: 'manual' }
      );

      expect(response.status).toBe(302);
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('session_id=');
    });
  });

  describe('Auth Middleware Integration', () => {
    it.skip('should process auth middleware in correct order', async () => {
      const middlewareLog: string[] = [];

      // Register multiple auth middlewares
      server.eventBus.on(ServerEvents.AUTH_MIDDLEWARE, async (event) => {
        middlewareLog.push(`auth-check-${event.phase}`);
        
        if (event.phase === 'extract') {
          // Extract token
          const auth = event.request.headers.authorization;
          if (auth?.startsWith('Bearer ')) {
            event.token = auth.substring(7);
          }
        } else if (event.phase === 'validate' && event.token) {
          // Validate token
          const response = await server.eventBus.emitAndWait(
            'auth.validate',
            {
              requestId: `validate-${event.request.requestId}`,
              token: event.token
            },
            { timeout: 1000 }
          );
          
          if (response.data.valid) {
            event.auth = {
              authenticated: true,
              userId: response.data.userId,
              scopes: response.data.scopes
            };
          }
        } else if (event.phase === 'authorize' && event.auth) {
          // Check authorization
          const endpoint = event.endpoint;
          if (endpoint.auth?.roles) {
            const roleResponse = await server.eventBus.emitAndWait(
              'auth.check.roles',
              {
                requestId: `roles-${event.request.requestId}`,
                userId: event.auth.userId,
                roles: endpoint.auth.roles
              },
              { timeout: 1000 }
            );
            
            if (!roleResponse.data.hasRoles) {
              event.reject(403, 'Insufficient permissions');
              return;
            }
          }
        }
        
        event.continue();
      });

      // Register test endpoint
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/middleware-test',
          handler: 'test.middleware',
          auth: { required: true, roles: ['admin'] }
        }]
      });

      server.eventBus.on('test.middleware', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { 
            message: 'Middleware test passed',
            auth: event.auth 
          }
        });
      });

      // Test with admin token
      const response = await fetch(`${baseUrl}/api/middleware-test`, {
        headers: { 'Authorization': 'Bearer admin-token' }
      });

      expect(response.status).toBe(200);
      expect(middlewareLog).toEqual([
        'auth-check-extract',
        'auth-check-validate',
        'auth-check-authorize'
      ]);
    });

    it('should allow custom auth strategies', async () => {
      // Register API key auth strategy
      server.eventBus.on('auth.strategy.api-key', async (event) => {
        const apiKey = event.headers['x-api-key'];
        
        if (apiKey === 'valid-api-key') {
          server.eventBus.emit(`response.${event.requestId}`, {
            data: {
              authenticated: true,
              userId: 'api-user-123',
              scopes: ['api.access']
            }
          });
        } else {
          server.eventBus.emit(`response.${event.requestId}`, {
            data: { authenticated: false }
          });
        }
      });

      // Register endpoint with custom auth
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/api-key-protected',
          handler: 'test.apiKey',
          auth: { 
            required: true,
            strategy: 'api-key'
          }
        }]
      });

      server.eventBus.on('test.apiKey', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { 
            message: 'API key authenticated',
            user: event.auth?.userId 
          }
        });
      });

      // Override auth middleware for API key strategy
      server.eventBus.on(ServerEvents.AUTH_MIDDLEWARE, async (event) => {
        if (event.endpoint.auth?.strategy === 'api-key' && event.phase === 'validate') {
          const response = await server.eventBus.emitAndWait(
            'auth.strategy.api-key',
            {
              requestId: `api-key-${event.request.requestId}`,
              headers: event.request.headers
            },
            { timeout: 1000 }
          );
          
          if (response.data.authenticated) {
            event.auth = response.data;
          } else {
            event.reject(401, 'Invalid API key');
            return;
          }
        }
        event.continue();
      });

      // Test with API key
      const response = await fetch(`${baseUrl}/api/api-key-protected`, {
        headers: { 'X-API-Key': 'valid-api-key' }
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toBe('api-user-123');
    });
  });

  describe('Auth Events and Hooks', () => {
    it('should emit auth events for monitoring', async () => {
      const authEvents: any[] = [];

      // Listen for auth events
      server.eventBus.on(ServerEvents.AUTH_SUCCESS, (event) => {
        authEvents.push({ type: 'success', ...event });
      });

      server.eventBus.on(ServerEvents.AUTH_FAILURE, (event) => {
        authEvents.push({ type: 'failure', ...event });
      });

      // Register endpoint
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/auth-events',
          handler: 'test.authEvents',
          auth: { required: true }
        }]
      });

      server.eventBus.on('test.authEvents', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { authenticated: true }
        });
      });

      // Successful auth
      await fetch(`${baseUrl}/api/auth-events`, {
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      // Failed auth
      await fetch(`${baseUrl}/api/auth-events`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });

      // No auth
      await fetch(`${baseUrl}/api/auth-events`);

      expect(authEvents).toHaveLength(3);
      expect(authEvents[0].type).toBe('success');
      expect(authEvents[0].userId).toBe('user-123');
      expect(authEvents[1].type).toBe('failure');
      expect(authEvents[1].reason).toContain('Invalid token');
      expect(authEvents[2].type).toBe('failure');
      expect(authEvents[2].reason).toContain('No authentication');
    });

    it.skip('should support auth hooks for custom logic', async () => {
      // Pre-auth hook
      server.eventBus.on('auth.hook.pre-validate', async (event) => {
        // Block specific IPs
        const clientIp = event.request.headers['x-forwarded-for'] || event.request.ip;
        if (clientIp === '10.0.0.1') {
          event.reject('IP blocked');
          return;
        }
        event.continue();
      });

      // Post-auth hook
      server.eventBus.on('auth.hook.post-validate', async (event) => {
        if (event.auth?.userId) {
          // Log successful auth
          server.eventBus.emit('audit.log', {
            type: 'auth.success',
            userId: event.auth.userId,
            timestamp: new Date()
          });
        }
        event.continue();
      });

      // Register endpoint
      server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
        moduleId: 'test',
        endpoints: [{
          protocol: 'http',
          method: 'GET',
          path: '/api/hooked',
          handler: 'test.hooked',
          auth: { required: true }
        }]
      });

      server.eventBus.on('test.hooked', (event) => {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { hooked: true }
        });
      });

      // Test blocked IP
      const response1 = await fetch(`${baseUrl}/api/hooked`, {
        headers: { 
          'Authorization': 'Bearer valid-token',
          'X-Forwarded-For': '10.0.0.1'
        }
      });
      expect(response1.status).toBe(403);

      // Test normal request
      const response2 = await fetch(`${baseUrl}/api/hooked`, {
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      expect(response2.status).toBe(200);
    });
  });
});