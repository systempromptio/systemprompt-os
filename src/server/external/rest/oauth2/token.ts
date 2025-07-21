/**
 * OAuth2 Token endpoint implementation
 * Handles token exchange for authorization codes and refresh tokens
 * @module server/external/rest/oauth2/token
 */

import { Request, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { CONFIG } from '../../../config.js';
import { AuthorizeEndpoint } from './authorize.js';
import { getAuthModule } from '../../../../modules/core/auth/singleton.js';
import { OAuth2Error } from './errors.js';
import { jwtSign, jwtVerify } from '../../auth/jwt.js';

/**
 * Schema for OAuth2 token request validation
 */
const TokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  refresh_token: z.string().optional(),
  code_verifier: z.string().optional(),
});

/**
 * Type definition for validated token request parameters
 */
type TokenRequestParams = z.infer<typeof TokenRequestSchema>;

/**
 * Structure for storing refresh token data
 */
interface RefreshTokenData {
  clientId: string;
  userId: string;
  scope: string;
  provider?: string;
  expiresAt: Date;
}

/**
 * Structure for storing user session data
 */
interface UserSessionData {
  userId: string;
  provider?: string;
  email?: string;
  name?: string;
  picture?: string;
  providerTokens?: any;
}

/**
 * Structure for OAuth2 token response
 */
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  id_token?: string;
}

/**
 * In-memory storage for refresh tokens
 * TODO: Replace with Redis or database in production
 */
const refreshTokens = new Map<string, RefreshTokenData>();

/**
 * In-memory storage for user sessions with provider information
 * TODO: Replace with Redis or database in production
 */
const userSessions = new Map<string, UserSessionData>();

/**
 * OAuth2 Token Endpoint implementation
 * Handles authorization code and refresh token grants
 */
export class TokenEndpoint {
  /**
   * Main entry point for token requests
   * Validates request and delegates to appropriate grant handler
   */
  public postToken = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const params = TokenRequestSchema.parse(req.body);
      
      if (params.grant_type === 'authorization_code') {
        await this.handleAuthorizationCodeGrant(params, res);
      } else if (params.grant_type === 'refresh_token') {
        await this.handleRefreshTokenGrant(params, res);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const oauthError = OAuth2Error.invalidRequest(error.message);
        res.status(oauthError.code).json(oauthError.toJSON());
      } else {
        const oauthError = OAuth2Error.serverError('Internal server error');
        res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };

  /**
   * Handles authorization code grant type
   * Exchanges authorization code for access and refresh tokens
   */
  private async handleAuthorizationCodeGrant(
    params: TokenRequestParams,
    res: Response
  ): Promise<Response | void> {
    if (!params.code || !params.redirect_uri) {
      const error = OAuth2Error.invalidRequest('Missing required parameters');
      return res.status(error.code).json(error.toJSON());
    }
    
    const codeData = AuthorizeEndpoint.getAuthorizationCode(params.code);
    if (!codeData) {
      const error = OAuth2Error.invalidGrant('Invalid authorization code');
      return res.status(error.code).json(error.toJSON());
    }
    
    if (codeData.expiresAt < new Date()) {
      AuthorizeEndpoint.deleteAuthorizationCode(params.code);
      const error = OAuth2Error.invalidGrant('Authorization code expired');
      return res.status(error.code).json(error.toJSON());
    }
    
    // Special handling for setup flow
    if (codeData.clientId === 'setup-client') {
      // Allow setup-client without validation during initial setup
      const db = await import('@/modules/core/database/index.js').then(m => m.getDatabase());
      const userCount = await db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM auth_users'
      ).then(result => result[0]?.count || 0);
      
      if (userCount > 0) {
        const error = OAuth2Error.invalidGrant('Setup already completed');
        return res.status(error.code).json(error.toJSON());
      }
    } else if (params.client_id && codeData.clientId !== params.client_id) {
      const error = OAuth2Error.invalidGrant('Invalid client');
      return res.status(error.code).json(error.toJSON());
    }
    
    if (codeData.redirectUri !== params.redirect_uri) {
      const error = OAuth2Error.invalidGrant('Invalid redirect URI');
      return res.status(error.code).json(error.toJSON());
    }
    
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
    
    AuthorizeEndpoint.deleteAuthorizationCode(params.code);
    
    if (codeData.provider && codeData.providerTokens?.code) {
      try {
        const provider = getAuthModule().getProvider(codeData.provider);
        if (provider) {
          const providerTokens = await provider.exchangeCodeForTokens(codeData.providerTokens.code);
          codeData.providerTokens = providerTokens;
        }
      } catch (error) {
        console.error('Provider token exchange failed:', error);
      }
    }
    
    const sessionId = randomBytes(16).toString('hex');
    
    userSessions.set(sessionId, {
      userId: codeData.userId || 'anonymous',
      provider: codeData.provider,
      providerTokens: codeData.providerTokens,
    });
    
    const tokens = await this.generateTokens(
      codeData.userId || 'anonymous',
      codeData.clientId,
      codeData.scope,
      codeData.provider,
      sessionId
    );
    
    res.json(tokens);
  }

  /**
   * Handles refresh token grant type
   * Exchanges refresh token for new access token
   */
  private async handleRefreshTokenGrant(
    params: TokenRequestParams,
    res: Response
  ): Promise<Response | void> {
    if (!params.refresh_token) {
      const error = OAuth2Error.invalidRequest('Missing refresh token');
      return res.status(error.code).json(error.toJSON());
    }
    
    const tokenData = refreshTokens.get(params.refresh_token);
    if (!tokenData) {
      const error = OAuth2Error.invalidGrant('Invalid refresh token');
      return res.status(error.code).json(error.toJSON());
    }
    
    if (tokenData.expiresAt < new Date()) {
      refreshTokens.delete(params.refresh_token);
      const error = OAuth2Error.invalidGrant('Refresh token expired');
      return res.status(error.code).json(error.toJSON());
    }
    
    if (params.client_id && tokenData.clientId !== params.client_id) {
      const error = OAuth2Error.invalidGrant('Invalid client');
      return res.status(error.code).json(error.toJSON());
    }
    
    refreshTokens.delete(params.refresh_token);
    
    const tokens = await this.generateTokens(
      tokenData.userId,
      tokenData.clientId,
      tokenData.scope,
      tokenData.provider
    );
    
    res.json(tokens);
  }

  /**
   * Generates access and refresh tokens
   * Creates JWT-like tokens with appropriate claims and expiration
   */
  private async generateTokens(
    userId: string,
    clientId: string,
    scope: string,
    provider?: string,
    sessionId?: string
  ): Promise<TokenResponse> {
    const now = Math.floor(Date.now() / 1000);
    
    const accessTokenPayload = {
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
    };
    
    const accessToken = await jwtSign(accessTokenPayload, CONFIG.JWTSECRET);
    
    const refreshToken = randomBytes(32).toString('base64url');
    
    refreshTokens.set(refreshToken, {
      clientId,
      userId,
      scope,
      provider,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    
    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope,
    };
    
    if (scope.includes('openid')) {
      const idTokenPayload = {
        sub: userId,
        aud: clientId,
        iss: CONFIG.JWTISSUER,
        iat: now,
        exp: now + 3600,
        auth_time: now,
        nonce: randomBytes(16).toString('hex'),
      };
      
      response.id_token = await jwtSign(idTokenPayload, CONFIG.JWTSECRET);
    }
    
    return response;
  }

  /**
   * Retrieves user session data by session ID
   * Used by userinfo endpoint to get user details
   */
  public static getUserSession(sessionId: string): UserSessionData | undefined {
    return userSessions.get(sessionId);
  }

  /**
   * Validates an access token and extracts claims
   * Returns decoded token payload if valid
   */
  public static async validateAccessToken(token: string): Promise<any> {
    try {
      const { payload } = await jwtVerify(token, CONFIG.JWTSECRET);
      
      if (payload.tokentype !== 'access') {
        return null;
      }
      
      return payload;
    } catch {
      return null;
    }
  }
}