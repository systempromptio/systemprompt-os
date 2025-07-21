/**
 * @fileoverview Unit tests for Google OAuth Provider
 * @module tests/unit/server/external/auth/providers/google
 */

import { vi } from 'vitest';
import { GoogleProvider } from '../../../../../../src/server/external/auth/providers/google';
import { generateOAuth2ProviderTests } from './oauth2-shared-tests';

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
    clientid: 'test-client-id.apps.googleusercontent.com',
    clientsecret: 'test-client-secret',
    redirecturi: 'http://localhost:3000/callback',
    scope: 'openid email profile'
  },
  expectedAuthParams: {
    accesstype: 'offline',
    prompt: 'consent'
  },
  expectedTokenEndpoint: 'https://oauth2.googleapis.com/token',
  expectedUserInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
  supportsRefresh: true
});