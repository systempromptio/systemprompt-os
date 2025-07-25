/**
 * OAuth2 Token endpoint implementation
 * Handles token exchange for authorization codes and refresh tokens.
 * @module server/external/rest/oauth2/token
 */

import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { CONFIG } from '@/server/config';
import { getAuthModule } from '@/modules/core/auth/singleton';
import { OAuth2Error } from '@/server/external/rest/oauth2/errors';
import { jwtSign, jwtVerify } from '@/server/external/auth/jwt';
import { AuthRepository } from '@/modules/core/auth/database/repository';
import type { AuthCodeService } from '@/modules/core/auth/services/auth-code-service';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Schema for OAuth2 token request validation.
 */

const logger = LoggerService.getInstance();

const TokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  redirect_uri: z.string().url()
.optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  refresh_token: z.string().optional(),
  code_verifier: z.string().optional(),
});

/**
 * Type definition for validated token request parameters.
 */
type TokenRequestParams = z.infer<typeof TokenRequestSchema>;

/**
 * Structure for storing refresh token data.
 */
interface RefreshTokenData {
  clientId: string;
  userId: string;
  scope: string;
  provider?: string;
  expiresAt: Date;
}

/**
 * Structure for storing user session data.
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
 * Structure for OAuth2 token response.
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
 * TODO: Replace with Redis or database in production.
 */
const refreshTokens = new Map<string, RefreshTokenData>();

/**
 * In-memory storage for user sessions with provider information
 * TODO: Replace with Redis or database in production.
 */
const userSessions = new Map<string, UserSessionData>();

// Get auth code service instance
let authCodeService: AuthCodeService;

function getAuthCodeService(): AuthCodeService {
  if (!authCodeService) {
    const authModule = getAuthModule();
    authCodeService = authModule.exports.authCodeService();
  }
  return authCodeService;
}

/**
 * OAuth2 Token Endpoint implementation
 * Handles authorization code and refresh token grants.
 */
export class TokenEndpoint {
  /**
   * Main entry point for token requests
   * Validates request and delegates to appropriate grant handler.
   * @param req
   * @param res
   */
  public postToken = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      logger.info(LogSource.AUTH, 'Token request received', {
        category: 'oauth2',
        action: 'token_request',
        persistToDb: false
      });

      const params = TokenRequestSchema.parse(req.body);

      logger.info(LogSource.AUTH, 'Token params parsed', {
        category: 'oauth2',
        action: 'token_parse',
        persistToDb: false
      });

      if (params.grant_type === 'authorization_code') {
        await this.handleAuthorizationCodeGrant(params, res);
      } else if (params.grant_type === 'refresh_token') {
        await this.handleRefreshTokenGrant(params, res);
      }
    } catch (error) {
      logger.error(LogSource.AUTH, 'Token endpoint error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'oauth2',
        action: 'token_request'
      });

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
   * Exchanges authorization code for access and refresh tokens.
   * @param params
   * @param res
   */
  private async handleAuthorizationCodeGrant(
    params: TokenRequestParams,
    res: Response,
  ): Promise<Response | void> {
    logger.info(LogSource.AUTH, 'Authorization code grant started', {
      category: 'oauth2',
      action: 'auth_code_grant',
      persistToDb: false
    });

    if (!params.code || !params.redirect_uri) {
      logger.error(LogSource.AUTH, 'Missing required parameters', {
        category: 'oauth2',
        action: 'auth_code_grant'
      });
      const error = OAuth2Error.invalidRequest('Missing required parameters');
      return res.status(error.code).json(error.toJSON());
    }

    const authCodeService = getAuthCodeService();
    const codeData = await authCodeService.getAuthorizationCode(params.code);
    logger.info(LogSource.AUTH, 'Authorization code lookup completed', {
      category: 'oauth2',
      action: 'code_lookup',
      persistToDb: false
    });

    if (!codeData) {
      logger.error(LogSource.AUTH, 'Invalid authorization code', {
        category: 'oauth2',
        action: 'code_lookup'
      });
      const error = OAuth2Error.invalidGrant('Invalid authorization code');
      return res.status(error.code).json(error.toJSON());
    }

    if (codeData.expiresAt < new Date()) {
      await authCodeService.deleteAuthorizationCode(params.code);
      const error = OAuth2Error.invalidGrant('Authorization code expired');
      return res.status(error.code).json(error.toJSON());
    }

    if (params.client_id && codeData.clientId !== params.client_id) {
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

      const verifierHash = createHash('sha256').update(params.code_verifier)
.digest('base64url');

      if (verifierHash !== codeData.codeChallenge) {
        const error = OAuth2Error.invalidGrant('Invalid code verifier');
        return res.status(error.code).json(error.toJSON());
      }
    }

    await authCodeService.deleteAuthorizationCode(params.code);

    if (
      codeData.provider
      && codeData.providerTokens
      && typeof codeData.providerTokens === 'object'
    ) {
      try {
        const provider = getAuthModule().exports.getProvider(codeData.provider);
        if (provider && 'code' in codeData.providerTokens) {
          const code = String(codeData.providerTokens['code']);
          if (code) {
            const providerTokens = await provider.exchangeCodeForTokens(code);
            codeData.providerTokens = providerTokens as unknown as Record<string, unknown>;
          }
        }
      } catch (error) {
        logger.error(LogSource.AUTH, 'Provider token exchange failed', {
          error: error instanceof Error ? error : new Error(String(error)),
          category: 'oauth2',
          action: 'token_exchange'
        });
      }
    }

    const sessionId = randomBytes(16).toString('hex');

    userSessions.set(sessionId, {
      userId: codeData.userId || 'anonymous',
      ...codeData.provider && { provider: codeData.provider },
      ...codeData.providerTokens && { providerTokens: codeData.providerTokens },
    });

    const tokens = await this.generateTokens(
      codeData.userId || 'anonymous',
      codeData.clientId,
      codeData.scope,
      codeData.provider,
      sessionId,
      codeData.userEmail,
    );

    res.json(tokens);
  }

  /**
   * Handles refresh token grant type
   * Exchanges refresh token for new access token.
   * @param params
   * @param res
   */
  private async handleRefreshTokenGrant(
    params: TokenRequestParams,
    res: Response,
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
      tokenData.provider,
    );

    res.json(tokens);
  }

  /**
   * Generates access and refresh tokens
   * Creates JWT-like tokens with appropriate claims and expiration.
   * @param userId
   * @param clientId
   * @param scope
   * @param provider
   * @param sessionId
   * @param userEmail
   */
  private async generateTokens(
    userId: string,
    clientId: string,
    scope: string,
    provider?: string,
    sessionId?: string,
    userEmail?: string,
  ): Promise<TokenResponse> {
    const now = Math.floor(Date.now() / 1000);

    let userData: any = null;
    let userRoles: string[] = [];
    try {
      const authRepo = AuthRepository.getInstance();
      const user = await authRepo.getIUserById(userId);
      if (user) {
        userData = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatarUrl,
          roles: []
        };
        const roles = await authRepo.getIUserIRoles(userId);
        userRoles = roles.map((r: any) => {
          return r.name;
        });
        userData.roles = userRoles;
      }
    } catch (error) {
      logger.error(LogSource.AUTH, 'Failed to fetch user data', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'oauth2',
        action: 'user_fetch'
      });
      if (userEmail) {
        userData = {
          id: userId,
          email: userEmail,
        };
      }
    }

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
      jti: randomBytes(16).toString('hex'),
      user: userData,
      roles: userRoles,
      email: userData?.email,
    };

    const accessToken = await jwtSign(accessTokenPayload, {
      issuer: CONFIG.JWTISSUER,
      audience: CONFIG.JWTAUDIENCE,
      expiresIn: 3600,
    });

    const refreshToken = randomBytes(32).toString('base64url');

    refreshTokens.set(refreshToken, {
      clientId,
      userId,
      scope,
      ...provider && { provider },
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
        ...userData && {
          email: userData.email,
          name: userData.name,
          picture: userData.avatar,
        },
      };

      response.id_token = await jwtSign(idTokenPayload, {
        issuer: CONFIG.JWTISSUER,
        audience: clientId,
        expiresIn: 3600,
      });
    }

    return response;
  }

  /**
   * Retrieves user session data by session ID
   * Used by userinfo endpoint to get user details.
   * @param sessionId
   */
  public static getUserSession(sessionId: string): UserSessionData | undefined {
    return userSessions.get(sessionId);
  }

  /**
   * Validates an access token and extracts claims
   * Returns decoded token payload if valid.
   * @param token
   */
  public static async validateAccessToken(token: string): Promise<any> {
    try {
      const { payload } = await jwtVerify(token, {
        issuer: CONFIG.JWTISSUER,
        audience: CONFIG.JWTAUDIENCE,
      });

      if (!payload || typeof payload !== 'object' || !('tokentype' in payload) || payload['tokentype'] !== 'access') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}
