/**
 * OAuth2 Provider Routes Configuration.
 * This module sets up all OAuth2-related routes for the application, including:
 * - OAuth 2.1 discovery endpoints
 * - OAuth2 authorization flow endpoints
 * - Token exchange endpoints
 * - User information endpoints
 * The module integrates with various identity providers (Google, GitHub, etc.)
 * and provides a unified OAuth2/OIDC interface for client applications.
 * @module server/external/rest/oauth2
 * @example
 * ```typescript
 * import { setupOAuth2Routes } from './oauth2/index.js';
 * import { Router } from 'express';
 * const router = Router();
 * await setupOAuth2Routes(router);
 * app.use(router);
 * ```
 */

import type {
 Request as ExpressRequest, Response as ExpressResponse, NextFunction, Router
} from 'express';
import { WellKnownEndpoint } from '@/server/external/rest/oauth2/well-known';
import { ProtectedResourceEndpoint } from '@/server/external/rest/oauth2/protected-resource';
import { AuthorizationServerEndpoint } from '@/server/external/rest/oauth2/authorization-server';
import { UnifiedAuthorizeEndpoint } from '@/server/external/rest/oauth2/unified-authorize';
import { RegisterEndpoint } from '@/server/external/rest/oauth2/register';
import { UnifiedTokenEndpoint } from '@/server/external/rest/oauth2/unified-token';
import { UserInfoEndpoint } from '@/server/external/rest/oauth2/userinfo';

/**
 * Placeholder authentication middleware.
 * @param _req - Express request object.
 * @param _res - Express response object.
 * @param next - Express next function.
 */
const authMiddleware = (_req: ExpressRequest, _res: ExpressResponse, next: NextFunction): void => {
  next();
};

/**
 * Security headers middleware for OAuth2 endpoints.
 * @param _req - Express request object.
 * @param res - Express response object.
 * @param next - Express next function.
 */
const securityHeadersMiddleware = (_req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';");
  next();
};

/**
 * Sets up discovery endpoints on the router.
 * @param router - Express router instance.
 * @param endpoints - Endpoint instances.
 * @param endpoints.wellKnown
 * @param endpoints.protectedResource
 * @param endpoints.authorizationServer
 */
const setupDiscoveryRoutes = (
  router: Router,
  endpoints: {
    wellKnown: WellKnownEndpoint;
    protectedResource: ProtectedResourceEndpoint;
    authorizationServer: AuthorizationServerEndpoint;
  }
): void => {
  router.get('/.well-known/oauth-protected-resource', async (req, res): Promise<void> => {
    await endpoints.protectedResource.getProtectedResourceMetadata(req, res);
  });

  router.get('/.well-known/oauth-authorization-server', async (req, res): Promise<void> => {
    await endpoints.authorizationServer.getAuthorizationServerMetadata(req, res);
  });

  router.get('/.well-known/jwks.json', (req, res): void => {
    void endpoints.wellKnown.getJWKS(req, res);
  });
};

/**
 * Sets up OAuth2 flow endpoints on the router.
 * @param router - Express router instance.
 * @param endpoints - Endpoint instances.
 * @param endpoints.register
 * @param endpoints.authorize
 * @param endpoints.token
 * @param endpoints.userinfo
 */
const setupOAuth2FlowRoutes = (
  router: Router,
  endpoints: {
    register: RegisterEndpoint;
    authorize: UnifiedAuthorizeEndpoint;
    token: UnifiedTokenEndpoint;
    userinfo: UserInfoEndpoint;
  }
): void => {
  router.post('/oauth2/register', (req, res): void => {
    void endpoints.register.register(req, res);
  });

  router.get('/oauth2/authorize', async (req, res): Promise<void> => {
    await endpoints.authorize.handleAuthorize(req, res);
  });

  router.post('/oauth2/authorize', async (req, res): Promise<void> => {
    await endpoints.authorize.handleAuthorize(req, res);
  });

  router.get('/oauth2/callback', async (req, res): Promise<void> => {
    await endpoints.authorize.handleProviderCallback(req, res);
  });

  router.get('/oauth2/callback/:provider', async (req, res): Promise<void> => {
    await endpoints.authorize.handleProviderCallback(req, res);
  });

  router.post('/oauth2/token', async (req, res): Promise<void> => {
    await endpoints.token.handleTokenRequest(req, res);
  });

  router.get('/oauth2/userinfo', authMiddleware, async (req, res): Promise<void> => {
    await endpoints.userinfo.getUserInfo(req, res);
  });
};

/**
 * Configures and sets up all OAuth2-related routes on the provided Express router.
 * This function sets up the following endpoints:
 * Discovery Endpoints (No authentication required):
 * - `GET /.well-known/oauth-authorization-server` - OAuth 2.1 authorization server metadata
 * - `GET /.well-known/oauth-protected-resource` - OAuth 2.1 protected resource metadata
 * - `GET /.well-known/jwks.json` - JSON Web Key Set for token verification
 * Authorization Flow Endpoints:
 * - `GET /oauth2/authorize` - OAuth2 authorization endpoint for initiating login
 * - `GET /oauth2/callback/:provider` - Callback endpoint for identity provider responses
 * Token Management Endpoints:
 * - `POST /oauth2/token` - Token exchange endpoint (requires client authentication)
 * - `GET /oauth2/userinfo` - User information endpoint (requires valid access token).
 * @param router - Express router instance to mount the OAuth2 routes on.
 * @returns Promise that resolves when all routes are configured.
 * @example
 * ```typescript
 * const app = express();
 * const router = Router();
 * await setupOAuth2Routes(router);
 * app.use('/api', router);
 * // Routes are now available at:
 * // - /api/.well-known/oauth-authorization-server
 * // - /api/oauth2/authorize
 * // - etc.
 * ```
 * @public
 */
export const setupOAuth2Routes = (router: Router): void => {
  router.use(securityHeadersMiddleware);

  const endpoints = {
    wellKnown: new WellKnownEndpoint(),
    protectedResource: new ProtectedResourceEndpoint(),
    authorizationServer: new AuthorizationServerEndpoint(),
    register: new RegisterEndpoint(),
    authorize: new UnifiedAuthorizeEndpoint(),
    token: new UnifiedTokenEndpoint(),
    userinfo: new UserInfoEndpoint()
  };

  setupDiscoveryRoutes(router, endpoints);
  setupOAuth2FlowRoutes(router, endpoints);
}
