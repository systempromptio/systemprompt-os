import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { oauthFixtures } from '../fixtures/oauth.fixtures.js';
import { userFixtures } from '../fixtures/user.fixtures.js';

export interface MockAuthContext {
  isAuthenticated: boolean;
  user?: typeof userFixtures.regular;
  client?: typeof oauthFixtures.defaultClient;
  token?: string;
}

export function createMockAuthMiddleware(context: MockAuthContext = { isAuthenticated: false }) {
  return vi.fn((req: Request, res: Response, next: NextFunction) => {
    if (context.isAuthenticated) {
      (req as any).user = context.user || userFixtures.regular;
      (req as any).client = context.client || oauthFixtures.defaultClient;
      (req as any).token = context.token || 'mock-access-token';
    }
    next();
  });
}

export function createMockJWTService() {
  return {
    sign: vi.fn((payload: any) => 'mock-jwt-token'),
    verify: vi.fn((token: string) => ({
      sub: 'user-123',
      iss: 'systemprompt-os',
      aud: 'systemprompt-os-clients',
      exp: Math.floor(Date.now() / 1000) + 3600
    })),
    decode: vi.fn((token: string) => ({
      header: { alg: 'RS256', typ: 'JWT' },
      payload: { sub: 'user-123' },
      signature: 'mock-signature'
    }))
  };
}

export function createMockOAuthProviderRegistry() {
  return {
    providers: new Map([
      ['google', oauthFixtures.googleProvider],
      ['github', oauthFixtures.githubProvider]
    ]),
    
    getProvider: vi.fn((name: string) => {
      switch (name) {
        case 'google':
          return oauthFixtures.googleProvider;
        case 'github':
          return oauthFixtures.githubProvider;
        default:
          return null;
      }
    }),
    
    listProviders: vi.fn(() => ['google', 'github']),
    
    registerProvider: vi.fn()
  };
}

export function mockAuthModule() {
  const mockAuth = createMockAuthMiddleware({ isAuthenticated: true });
  const mockJWT = createMockJWTService();
  const mockProviders = createMockOAuthProviderRegistry();
  
  vi.mock('../../src/server/external/auth/middleware', () => ({
    requireAuth: mockAuth,
    optionalAuth: createMockAuthMiddleware({ isAuthenticated: false })
  }));
  
  vi.mock('../../src/server/external/auth/jwt', () => ({
    JWTService: vi.fn(() => mockJWT),
    createJWTService: vi.fn(() => mockJWT)
  }));
  
  vi.mock('../../src/server/external/auth/providers/registry', () => ({
    OAuthProviderRegistry: vi.fn(() => mockProviders),
    getProviderRegistry: vi.fn(() => mockProviders)
  }));
  
  return {
    auth: mockAuth,
    jwt: mockJWT,
    providers: mockProviders
  };
}