/**
 * @fileoverview OAuth2 Provider setup
 * @module server/external/rest/oauth2
 */

import { Router } from 'express';
import { WellKnownEndpoint } from './well-known.js';
import { AuthorizeV2Endpoint } from './authorize-v2.js';
import { TokenV2Endpoint } from './token-v2.js';
import { UserInfoEndpoint } from './userinfo.js';
import { authMiddleware } from '../../middleware/auth.js';

export async function setupOAuth2Routes(router: Router, baseUrl: string): Promise<void> {
  // Well-known endpoints (no auth required)
  const wellKnown = new WellKnownEndpoint(baseUrl);
  router.get('/.well-known/openid-configuration', wellKnown.getOpenIDConfiguration);
  router.get('/.well-known/jwks.json', wellKnown.getJWKS);
  
  // OAuth2 endpoints with IDP support
  const authorize = new AuthorizeV2Endpoint();
  const token = new TokenV2Endpoint();
  const userinfo = new UserInfoEndpoint();
  
  // Authorization endpoint (no auth required - user will authenticate here)
  router.get('/oauth2/authorize', authorize.getAuthorize);
  
  // Provider callback endpoint
  router.get('/oauth2/callback/:provider', authorize.handleProviderCallback);
  
  // Token endpoint (client authentication via Basic auth or client credentials)
  router.post('/oauth2/token', token.postToken);
  
  // UserInfo endpoint (requires valid access token)
  router.get('/oauth2/userinfo', authMiddleware, userinfo.getUserInfo);
}