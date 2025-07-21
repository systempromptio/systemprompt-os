/**
 * @fileoverview OAuth2 Token endpoint
 * @module server/external/rest/oauth2/token
 */

import { Request, Response } from 'express';
// import { SignJWT, jwtVerify } from 'jose';
// TODO: Add proper JWT library
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { CONFIG } from '../../../config.js';
import { AuthorizeEndpoint } from './authorize.js';
import { getAuthModule } from '../../../../modules/core/auth/singleton.js';
import { OAuth2Error } from './errors.js';

// Schema for token request
const TokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  client_id: z.string(),
  client_secret: z.string().optional(),
  refresh_token: z.string().optional(),
  code_verifier: z.string().optional(),
});

// In-memory storage for refresh tokens (should be Redis/DB in production)
const refreshTokens = new Map<string, {
  clientId: string;
  userId: string;
  scope: string;
  provider?: string;
  expiresAt: Date;
}>();

// In-memory storage for user sessions with provider info
const userSessions = new Map<string, {
  userId: string;
  provider?: string;
  email?: string;
  name?: string;
  picture?: string;
  providerTokens?: any;
}>();

export class TokenEndpoint {
  constructor() {
    // JWT secret is accessed from CONFIG when needed
  }
  
  /**
   * POST /oauth2/token
   * Exchange authorization code or refresh token for access token
   */
  postToken = async ( req: Request, res: Response): Promise<Response | void> => {
    try {
      const params = TokenRequestSchema.parse(req.body);
      
      // TODO: Validate client credentials (Basic auth or clientsecret)
      
      if (params.grant_type === 'authorization_code') {
        await this.handleAuthorizationCodeGrant(params, res);
      } else if (params.grant_type === 'refresh_token') {
        await this.handleRefreshTokenGrant(params, res);
      }
    } catch ( error) {
      if (error instanceof z.ZodError) {
        const oauthError = OAuth2Error.invalidRequest(error.message);
        res.status(oauthError.code).json(oauthError.toJSON());
      } else {
        const oauthError = OAuth2Error.serverError('Internal server error');
        res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };
  
  private async handleAuthorizationCodeGrant(
    params: z.infer<typeof TokenRequestSchema>,
    res: Response
  ): Promise<Response | void> {
    if (!params.code || !params.redirect_uri) {
      const error = OAuth2Error.invalidRequest('Missing required parameters');
      return res.status(error.code).json(error.toJSON());
    }
    
    // Get stored authorization code
    const codeData = AuthorizeEndpoint.getAuthorizationCode(params.code);
    if (!codeData) {
      const error = OAuth2Error.invalidGrant('Invalid authorization code');
      return res.status(error.code).json(error.toJSON());
    }
    
    // Validate code hasn't expired
    if (codeData.expiresAt < new Date()) {
      AuthorizeEndpoint.deleteAuthorizationCode(params.code);
      const error = OAuth2Error.invalidGrant('Authorization code expired');
      return res.status(error.code).json(error.toJSON());
    }
    
    // Validate clientid and redirecturi match
    if (codeData.clientId !== params.client_id || 
        codeData.redirectUri !== params.redirect_uri) {
      const error = OAuth2Error.invalidGrant('Invalid client or redirect URI');
      return res.status(error.code).json(error.toJSON());
    }
    
    // Validate PKCE if used
    if (codeData.codeChallenge) {
      if (!params.code_verifier) {
        const error = OAuth2Error.invalidRequest('Code verifier required');
        return res.status(error.code).json(error.toJSON());
      }
      
      const verifierHash = createHash('sha256')
        .update(params.code_verifier)
        .digest('base64url');
      
      if (verifierHash !== codeData.codeChallenge) {
        const error = OAuth2Error.invalidGrant('Invalid code verifier');
        return res.status(error.code).json(error.toJSON());
      }
    }
    
    // Delete authorization code (one-time use)
    AuthorizeEndpoint.deleteAuthorizationCode(params.code);
    
    // Handle provider token exchange if needed
    if (codeData.provider && codeData.providerTokens?.code) {
      try {
        const provider = getAuthModule().getProvider(codeData.provider);
        if (provider) {
          const providerTokens = await provider.exchangeCodeForTokens(codeData.providerTokens.code);
          codeData.providerTokens = providerTokens;
        }
      } catch (error) {
        // Log but don't fail - provider tokens are optional
        console.error('Provider token exchange failed:', error);
      }
    }
    
    // Store user session if provider data exists
    const sessionId = randomBytes(32).toString('base64url');
    if (codeData.provider) {
      userSessions.set(sessionId, {
        userId: codeData.userId || 'anonymous',
        provider: codeData.provider,
        providerTokens: codeData.providerTokens,
      });
    }
    
    // Generate tokens
    const tokens = await this.generateTokens(
      codeData.userId || 'anonymous',
      params.client_id,
      codeData.scope,
      codeData.provider,
      sessionId
    );
    
    res.json( tokens);
  }
  
  private async handleRefreshTokenGrant(
    params: z.infer<typeof TokenRequestSchema>,
    res: Response
  ): Promise<Response | void> {
    if (!params.refresh_token) {
      const error = OAuth2Error.invalidRequest('Missing refresh token');
      return res.status(error.code).json(error.toJSON());
    }
    
    // Get stored refresh token
    const tokenData = refreshTokens.get(params.refresh_token);
    if (!tokenData) {
      const error = OAuth2Error.invalidGrant('Invalid refresh token');
      return res.status(error.code).json(error.toJSON());
    }
    
    // Validate token hasn't expired
    if (tokenData.expiresAt < new Date()) {
      refreshTokens.delete(params.refresh_token);
      const error = OAuth2Error.invalidGrant('Refresh token expired');
      return res.status(error.code).json(error.toJSON());
    }
    
    // Validate clientid matches
    if (tokenData.clientId !== params.client_id) {
      const error = OAuth2Error.invalidGrant('Invalid client');
      return res.status(error.code).json(error.toJSON());
    }
    
    // Delete old refresh token
    refreshTokens.delete(params.refresh_token);
    
    // Generate new tokens
    const tokens = await this.generateTokens(
      tokenData.userId,
      tokenData.clientId,
      tokenData.scope,
      tokenData.provider
    );
    
    res.json( tokens);
  }
  
  private async generateTokens(
    userId: string,
    clientId: string,
    scope: string,
    provider?: string,
    sessionId?: string
  ) {
    const now = Math.floor(Date.now() / 1000);
    
    // Generate access token (simplified for now)
    // TODO: Use proper JWT library
    const accessToken = Buffer.from(JSON.stringify({
      sub: userId,
      clientid: clientId,
      scope,
      provider,
      sessionid: sessionId,
      tokentype: 'access',
      iss: CONFIG.JWTISSUER,
      aud: CONFIG.JWTAUDIENCE,
      iat: now,
      exp: now + 3600,
      jti: randomBytes(16).toString('hex')
    })).toString('base64url');
    
    // Generate refresh token
    const refreshToken = randomBytes(32).toString('base64url');
    
    // Store refresh token
    refreshTokens.set(refreshToken, {
      clientId,
      userId,
      scope,
      provider,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
    
    const response: any = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope,
    };
    
    // Add ID token for OpenID Connect
    if (scope.includes('openid')) {
      const idToken = Buffer.from(JSON.stringify({
        sub: userId,
        aud: clientId,
        iss: CONFIG.JWTISSUER,
        iat: now,
        exp: now + 3600,
        auth_time: now,
        nonce: randomBytes(16).toString('hex'), // TODO: Use actual nonce from request
      })).toString('base64url');
      
      response.id_token = idToken;
    }
    
    return response;
  }
}