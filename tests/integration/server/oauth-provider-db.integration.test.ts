/**
 * OAuth Provider Database Integration Test
 * 
 * Tests the complete flow of:
 * 1. Storing OAuth provider configuration in database
 * 2. Loading provider from database
 * 3. Creating a working provider instance from DB config
 * 4. Server OAuth endpoints using the DB-loaded provider
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IAuthModuleExports } from '@/modules/core/auth/types';
import type { Express } from 'express';
import request from 'supertest';
import { createTestId } from '../setup';

describe.skip('OAuth Provider Database Integration - SKIP: Need to refactor for new module system', () => {
  let bootstrap: Bootstrap;
  let dbService: DatabaseService;
  let authModule: any;
  let app: Express;
  
  const testSessionId = `oauth-provider-db-${createTestId()}`;

  beforeAll(async () => {
    console.log(`🚀 Setting up OAuth provider DB integration test (session: ${testSessionId})...`);
    
    // Clean up singletons first
    try {
      const { DatabaseService } = await import('@/modules/core/database/services/database.service');
      await DatabaseService.reset();
    } catch (error) {
      // Ignore
    }
    
    try {
      const { LoggerService } = await import('@/modules/core/logger/services/logger.service');
      (LoggerService as any).instance = null;
    } catch (error) {
      // Ignore
    }
    
    try {
      const { ModulesModuleService } = await import('@/modules/core/modules/services/modules-module.service');
      ModulesModuleService.reset();
    } catch (error) {
      // Ignore
    }
    
    try {
      const { SystemService } = await import('@/modules/core/system/services/system.service');
      (SystemService as any).instance = null;
    } catch (error) {
      // Ignore
    }
    
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.DISABLE_TELEMETRY = 'true';
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services
    const authModuleRef = modules.get('auth');
    const dbModule = modules.get('database');
    
    if (!authModuleRef || !dbModule) {
      throw new Error('Required modules not loaded');
    }
    
    authModule = authModuleRef;
    dbService = (dbModule as any).exports.service();
    
    // Setup Express app for testing
    const express = await import('express');
    app = express.default();
    app.use(express.json());
    
    // Mock the getAuthModule function for server endpoints
    const authModulePath = '@/modules/core/auth/index';
    const authModuleModule = await import(authModulePath);
    (authModuleModule as any).getAuthModule = () => authModule;
    
    // Setup OAuth routes
    const { setupOAuth2Routes } = await import('@/server/external/rest/oauth2/index');
    const { Router } = express;
    const router = Router();
    setupOAuth2Routes(router);
    app.use(router);
    
    console.log('✅ OAuth provider DB integration test environment ready');
  }, 60000);

  afterAll(async () => {
    await bootstrap?.shutdown();
  });

  beforeEach(async () => {
    // Clear auth_providers table
    await dbService.execute('DELETE FROM auth_providers');
  });

  describe('Provider Storage and Loading', () => {
    it('should store Google OAuth provider configuration in database', async () => {
      // Insert Google provider config into database
      const googleConfig = {
        id: 'google',
        name: 'Google',
        type: 'oidc',
        enabled: 1,
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        redirect_uri: 'http://localhost:3000/oauth2/callback/google',
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        userinfo_endpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
        discovery_endpoint: 'https://accounts.google.com/.well-known/openid-configuration',
        scopes: JSON.stringify(['openid', 'email', 'profile']),
        userinfo_mapping: JSON.stringify({
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          picture: 'picture'
        }),
        metadata: JSON.stringify({
          access_type: 'offline',
          prompt: 'consent'
        })
      };

      await dbService.execute(`
        INSERT INTO auth_providers (
          id, name, type, enabled, client_id, client_secret, redirect_uri,
          authorization_endpoint, token_endpoint, userinfo_endpoint,
          discovery_endpoint, scopes, userinfo_mapping, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        googleConfig.id,
        googleConfig.name,
        googleConfig.type,
        googleConfig.enabled,
        googleConfig.client_id,
        googleConfig.client_secret,
        googleConfig.redirect_uri,
        googleConfig.authorization_endpoint,
        googleConfig.token_endpoint,
        googleConfig.userinfo_endpoint,
        googleConfig.discovery_endpoint,
        googleConfig.scopes,
        googleConfig.userinfo_mapping,
        googleConfig.metadata
      ]);

      // Verify it was stored
      const providers = await dbService.query('SELECT * FROM auth_providers WHERE id = ?', ['google']);
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('google');
      expect(providers[0].client_id).toBe('test-google-client-id');
    });

    it('should load provider from database and make it available to auth module', async () => {
      // Insert provider config
      await dbService.execute(`
        INSERT INTO auth_providers (
          id, name, type, enabled, client_id, client_secret,
          authorization_endpoint, token_endpoint, scopes
        ) VALUES (
          'github', 'GitHub', 'oauth2', 1, 'test-github-client', 'test-github-secret',
          'https://github.com/login/oauth/authorize',
          'https://github.com/login/oauth/access_token',
          '["user:email", "read:user"]'
        )
      `);

      // Reload providers in auth module
      const authExports = authModule.exports as IAuthModuleExports;
      await authExports.reloadProviders();

      // Check if provider is available
      const hasProvider = authExports.hasProvider('github');
      expect(hasProvider).toBe(true);

      // Get provider instance
      const provider = authExports.getProvider('github');
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('github');
      expect(provider?.name).toBe('GitHub');
    });
  });

  describe('Generic Provider Factory', () => {
    it('should create working OAuth2 provider from database config', async () => {
      // Insert a custom OAuth2 provider
      const customProvider = {
        id: 'custom-oauth',
        name: 'Custom OAuth Provider',
        type: 'oauth2',
        enabled: 1,
        client_id: 'custom-client-id',
        client_secret: 'custom-client-secret',
        redirect_uri: 'http://localhost:3000/oauth2/callback/custom-oauth',
        authorization_endpoint: 'https://custom.example.com/oauth/authorize',
        token_endpoint: 'https://custom.example.com/oauth/token',
        userinfo_endpoint: 'https://custom.example.com/oauth/userinfo',
        scopes: JSON.stringify(['read', 'write']),
        userinfo_mapping: JSON.stringify({
          id: 'user_id',
          email: 'email_address',
          name: 'display_name'
        }),
        metadata: JSON.stringify({
          response_type: 'code',
          grant_type: 'authorization_code',
          token_method: 'POST',
          token_auth: 'header' // or 'body'
        })
      };

      await dbService.execute(`
        INSERT INTO auth_providers (
          id, name, type, enabled, client_id, client_secret, redirect_uri,
          authorization_endpoint, token_endpoint, userinfo_endpoint,
          scopes, userinfo_mapping, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customProvider.id,
        customProvider.name,
        customProvider.type,
        customProvider.enabled,
        customProvider.client_id,
        customProvider.client_secret,
        customProvider.redirect_uri,
        customProvider.authorization_endpoint,
        customProvider.token_endpoint,
        customProvider.userinfo_endpoint,
        customProvider.scopes,
        customProvider.userinfo_mapping,
        customProvider.metadata
      ]);

      // Reload providers
      const authExports = authModule.exports as IAuthModuleExports;
      await authExports.reloadProviders();

      // Get the provider
      const provider = authExports.getProvider('custom-oauth');
      expect(provider).toBeDefined();
      
      // Test that provider can generate authorization URL
      const authUrl = provider?.getAuthorizationUrl('test-state');
      expect(authUrl).toContain(customProvider.authorization_endpoint);
      expect(authUrl).toContain('client_id=custom-client-id');
      expect(authUrl).toContain('state=test-state');
      expect(authUrl).toMatch(/scope=(read%20write|read\+write)/);
    });

    it('should support OIDC providers with discovery', async () => {
      // Insert OIDC provider with discovery endpoint
      await dbService.execute(`
        INSERT INTO auth_providers (
          id, name, type, enabled, client_id, client_secret,
          authorization_endpoint, token_endpoint,
          discovery_endpoint, scopes, metadata
        ) VALUES (
          'keycloak', 'Keycloak', 'oidc', 1, 'test-keycloak-client', 'test-keycloak-secret',
          'https://keycloak.example.com/realms/master/protocol/openid-connect/auth',
          'https://keycloak.example.com/realms/master/protocol/openid-connect/token',
          'https://keycloak.example.com/realms/master/.well-known/openid-configuration',
          '["openid", "profile", "email"]',
          '{"auto_discover": true}'
        )
      `);

      const authExports = authModule.exports as IAuthModuleExports;
      await authExports.reloadProviders();

      const provider = authExports.getProvider('keycloak');
      expect(provider).toBeDefined();
      expect(provider?.type).toBe('oidc');
    });
  });

  describe('Server OAuth Flow with DB Providers', () => {
    beforeEach(async () => {
      // Insert test provider
      await dbService.execute(`
        INSERT INTO auth_providers (
          id, name, type, enabled, client_id, client_secret, redirect_uri,
          authorization_endpoint, token_endpoint, userinfo_endpoint, scopes
        ) VALUES (
          'test-provider', 'Test Provider', 'oauth2', 1,
          'test-client-id', 'test-client-secret',
          'http://localhost:3000/oauth2/callback/test-provider',
          'https://auth.test.com/authorize',
          'https://auth.test.com/token',
          'https://auth.test.com/userinfo',
          '["openid", "profile", "email"]'
        )
      `);

      // Reload providers
      const authExports = authModule.exports as IAuthModuleExports;
      await authExports.reloadProviders();
    });

    it('should handle authorization request with DB-loaded provider', async () => {
      const response = await request(app)
        .get('/oauth2/authorize')
        .query({
          response_type: 'code',
          client_id: 'test-mcp-client',
          redirect_uri: 'http://localhost:5173/callback',
          scope: 'openid profile',
          state: 'test-state',
          provider: 'test-provider'
        });

      // Should redirect to provider's authorization endpoint
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://auth.test.com/authorize');
      expect(response.headers.location).toContain('client_id=test-client-id');
    });

    it('should show provider selection when no provider specified', async () => {
      // Insert another provider
      await dbService.execute(`
        INSERT INTO auth_providers (
          id, name, type, enabled, client_id, client_secret,
          authorization_endpoint, token_endpoint, scopes
        ) VALUES (
          'another-provider', 'Another Provider', 'oauth2', 1,
          'another-client', 'another-secret',
          'https://another.test.com/auth',
          'https://another.test.com/token',
          '["read"]'
        )
      `);

      const authExports = authModule.exports as IAuthModuleExports;
      await authExports.reloadProviders();

      const response = await request(app)
        .get('/oauth2/authorize')
        .query({
          response_type: 'code',
          client_id: 'test-mcp-client',
          redirect_uri: 'http://localhost:5173/callback',
          scope: 'openid profile',
          state: 'test-state'
        });

      // Should show provider selection page
      expect(response.status).toBe(200);
      expect(response.text).toContain('Test Provider');
      expect(response.text).toContain('Another Provider');
      expect(response.text).toContain('Choose how to sign in');
    });

    it('should return well-known metadata with correct base URL', async () => {
      const response = await request(app)
        .get('/.well-known/oauth-protected-resource');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resource');
      expect(response.body).toHaveProperty('authorization_servers');
      expect(response.body).toHaveProperty('bearer_methods_supported');
    });
  });

  describe('Provider CRUD Operations', () => {
    it('should create provider through service API', async () => {
      const authExports = authModule.exports as IAuthModuleExports;
      
      const newProvider = await authExports.createProvider({
        id: 'slack',
        name: 'Slack',
        type: 'oauth2',
        enabled: true,
        clientId: 'slack-client-id',
        clientSecret: 'slack-client-secret',
        authorizationEndpoint: 'https://slack.com/oauth/v2/authorize',
        tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
        scopes: ['identity.basic', 'identity.email'],
        metadata: {
          team_id: 'optional-team-id'
        }
      });

      expect(newProvider).toBeDefined();
      expect(newProvider.id).toBe('slack');

      // Verify it's in the database
      const dbProvider = await dbService.query(
        'SELECT * FROM auth_providers WHERE id = ?',
        ['slack']
      );
      expect(dbProvider).toHaveLength(1);
    });

    it('should update provider configuration', async () => {
      // Create initial provider
      await dbService.execute(`
        INSERT INTO auth_providers (
          id, name, type, enabled, client_id, client_secret,
          authorization_endpoint, token_endpoint
        ) VALUES (
          'update-test', 'Update Test', 'oauth2', 0,
          'old-client', 'old-secret',
          'https://old.test.com/auth',
          'https://old.test.com/token'
        )
      `);

      const authExports = authModule.exports as IAuthModuleExports;
      
      // Update the provider
      await authExports.updateProvider('update-test', {
        enabled: true,
        clientId: 'new-client-id',
        clientSecret: 'new-client-secret',
        scopes: ['new-scope']
      });

      // Verify updates
      const updated = await dbService.query(
        'SELECT * FROM auth_providers WHERE id = ?',
        ['update-test']
      );
      
      expect(updated[0].enabled).toBe(1);
      expect(updated[0].client_id).toBe('new-client-id');
      expect(JSON.parse(updated[0].scopes)).toContain('new-scope');
    });

    it('should delete provider', async () => {
      // Create provider
      await dbService.execute(`
        INSERT INTO auth_providers (
          id, name, type, enabled, client_id, client_secret,
          authorization_endpoint, token_endpoint
        ) VALUES (
          'delete-test', 'Delete Test', 'oauth2', 1,
          'client', 'secret',
          'https://test.com/auth',
          'https://test.com/token'
        )
      `);

      const authExports = authModule.exports as IAuthModuleExports;
      
      // Delete the provider
      const deleted = await authExports.deleteProvider('delete-test');
      expect(deleted).toBe(true);

      // Verify it's gone
      const result = await dbService.query(
        'SELECT * FROM auth_providers WHERE id = ?',
        ['delete-test']
      );
      expect(result).toHaveLength(0);
    });
  });
});