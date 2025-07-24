/**
 * @fileoverview Unit tests for Google OAuth Provider
 * @module tests/unit/server/external/auth/providers/google
 */

import { vi } from 'vitest';
import { GoogleProvider } from '../../../../../../src/server/external/auth/providers/google.js';
import { generateOAuth2ProviderTests } from './oauth2-shared-tests.js';

// Mock global fetch
global.fetch = vi.fn();

// Generate comprehensive tests using shared utility
generateOAuth2ProviderTests({
  providerName: 'Google',
  providerId: 'google',
  providerType: 'oidc',
  createProvider: (config) => new GoogleProvider(config),
  baseConfig: {
    id: 'google',
    name: 'Google',
    client_id: 'test-client-id.apps.googleusercontent.com',
    client_secret: 'test-client-secret',
    redirect_uri: 'http://localhost:3000/callback',
    scope: 'openid email profile'
  },
  expectedAuthParams: {
    access_type: 'offline',
    prompt: 'consent'
  },
  expectedTokenEndpoint: 'https://oauth2.googleapis.com/token',
  expectedUserInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
  supportsRefresh: true
});