/**
 * OAuth2 Token endpoint implementation
 * Handles token exchange for authorization codes and refresh tokens.
 * @module server/external/rest/oauth2/token
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { CONFIG } from '@/server/config';
import { getAuthModule } from '@/modules/core/auth/index';
import { OAuth2Error } from '@/server/external/rest/oauth2/errors';
import { jwtSign, jwtVerify } from '@/server/external/auth/jwt';
import { AuthRepository } from '@/modules/core/auth/database/repository';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
  IJWTTokenPayload,
  IProviderTokens,
  IRefreshTokenData,
  ITokenRequestParams,
  ITokenResponse,
  IUserData,
  IUserSessionData,
} from '@/server/external/rest/oauth2/types/index';

/**
 * Authorization code data structure.
 */
interface IAuthorizationCodeData {
  userId: string | null;
  clientId: string;
  scope: string;
  redirectUri: string;
  expiresAt: Date;
  codeChallenge?: string;
  provider?: string;
  providerTokens?: Record<string, unknown> | null;
  userEmail?: string;
}

/**
 * Schema for OAuth2 token request validation.
 */
const logger = LoggerService.getInstance();

const tokenRequestSchema = z.object({
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
 * In-memory storage for refresh tokens
 * TODO: Replace with Redis or database in production.
 */
const refreshTokens = new Map<string, IRefreshTokenData>();

/**
 * In-memory storage for user sessions with provider information
 * TODO: Replace with Redis or database in production.
 */
const userSessions = new Map<string, IUserSessionData>();

/**
 * OAuth2 Token Endpoint handler class.
 */
export class TokenEndpoint {
  /**
   * Main entry point for token requests
   * Validates request and delegates to appropriate grant handler.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise resolving to response or void.
   */
  public postToken = async (
    req: ExpressRequest,
    res: ExpressResponse
  ): Promise<ExpressResponse> => {
    try {
      logger.info(LogSource.AUTH, 'Token request received', {
        category: 'oauth2',
        action: 'token_request',
        persistToDb: false
      });

      const params = tokenRequestSchema.parse(req.body);

      logger.info(LogSource.AUTH, 'Token params parsed', {
        category: 'oauth2',
        action: 'token_parse',
        persistToDb: false
      });

      if (params.grant_type === 'authorization_code') {
        return await this.handleAuthorizationCodeGrant(params as ITokenRequestParams, res);
      }
        return await this.handleRefreshTokenGrant(params as ITokenRequestParams, res);
    } catch (error) {
      logger.error(LogSource.AUTH, 'Token endpoint error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'oauth2',
        action: 'token_request'
      });

      if (error instanceof z.ZodError) {
        const missingFields = error.errors.filter(e => { return e.code === 'invalid_type' && e.message === 'Required' });

        if (missingFields.some(e => { return e.path[0] === 'grant_type' })) {
          const invalidRequestError = OAuth2Error.invalidRequest('grant_type is required');
          return res.status(invalidRequestError.code).json(invalidRequestError.toJSON());
        } if (error.errors.some(e => { return e.path[0] === 'grant_type' && e.code === 'invalid_enum_value' })) {
          const unsupportedGrantError = OAuth2Error.unsupportedGrantType('Unsupported grant_type');
          return res.status(unsupportedGrantError.code).json(unsupportedGrantError.toJSON());
        }
          const invalidRequestError = OAuth2Error.invalidRequest(error.errors[0]?.message || 'Invalid request');
          return res.status(invalidRequestError.code).json(invalidRequestError.toJSON());
      }
        const serverError = OAuth2Error.serverError('Internal server error');
        return res.status(serverError.code).json(serverError.toJSON());
    }
  };

  /**
   * Handles authorization code grant type
   * Exchanges authorization code for access and refresh tokens.
   * @param params - Token request parameters.
   * @param res - Express response object.
   * @returns Promise resolving to response or void.
   */
  private async handleAuthorizationCodeGrant(
    params: ITokenRequestParams,
    res: ExpressResponse,
  ): Promise<ExpressResponse> {
    logger.info(LogSource.AUTH, 'Authorization code grant started', {
      category: 'oauth2',
      action: 'auth_code_grant',
      persistToDb: false
    });

    if (typeof params.code !== 'string') {
      logger.error(LogSource.AUTH, 'Missing code parameter', {
        category: 'oauth2',
        action: 'auth_code_grant'
      });
      const error = OAuth2Error.invalidRequest('code is required for authorization_code grant');
      return res.status(error.code).json(error.toJSON());
    }

    if (typeof params.redirect_uri !== 'string') {
      logger.error(LogSource.AUTH, 'Missing redirect_uri parameter', {
        category: 'oauth2',
        action: 'auth_code_grant'
      });
      const error = OAuth2Error.invalidRequest('redirect_uri is required for authorization_code grant');
      return res.status(error.code).json(error.toJSON());
    }

    const authModule = await getAuthModule();
    const authCodeSvc = authModule.exports.authCodeService() as {
      getAuthorizationCode: (code: string) => Promise<IAuthorizationCodeData | null>;
      deleteAuthorizationCode: (code: string) => Promise<void>;
    };

    const codeData = await authCodeSvc.getAuthorizationCode(params.code);
    logger.info(LogSource.AUTH, 'Authorization code lookup completed', {
      category: 'oauth2',
      action: 'code_lookup',
      persistToDb: false
    });

    if (codeData === null) {
      logger.error(LogSource.AUTH, 'Invalid authorization code', {
        category: 'oauth2',
        action: 'code_lookup'
      });
      const error = OAuth2Error.invalidGrant('Invalid authorization code');
      return res.status(error.code).json(error.toJSON());
    }

    if (codeData.expiresAt < new Date()) {
      await authCodeSvc.deleteAuthorizationCode(params.code);
      const error = OAuth2Error.invalidGrant('Authorization code expired');
      return res.status(error.code).json(error.toJSON());
    }

    if (params.client_id !== undefined && codeData.clientId !== params.client_id) {
      logger.error(LogSource.AUTH, 'Invalid client', {
        category: 'oauth2',
        action: 'token_validation'
      });
      const error = OAuth2Error.invalidGrant('Invalid client');
      return res.status(error.code).json(error.toJSON());
    }

    if (codeData.redirectUri !== params.redirect_uri) {
      logger.error(LogSource.AUTH, 'Invalid redirect URI', {
        category: 'oauth2',
        action: 'token_validation'
      });
      const error = OAuth2Error.invalidGrant('Invalid redirect URI');
      return res.status(error.code).json(error.toJSON());
    }

    if (codeData.codeChallenge) {
      if (params.code_verifier === undefined) {
        logger.error(LogSource.AUTH, 'Code verifier required', {
          category: 'oauth2',
          action: 'token_validation'
        });
        const error = OAuth2Error.invalidRequest('Code verifier required');
        return res.status(error.code).json(error.toJSON());
      }

      const verifierHash = createHash('sha256')
        .update(params.code_verifier)
        .digest('base64url');

      if (verifierHash !== codeData.codeChallenge) {
        logger.error(LogSource.AUTH, 'Invalid code verifier', {
          category: 'oauth2',
          action: 'token_validation'
        });
        const error = OAuth2Error.invalidGrant('Invalid code verifier');
        return res.status(error.code).json(error.toJSON());
      }
    }

    await authCodeSvc.deleteAuthorizationCode(params.code);

    if (
      typeof codeData.provider === 'string'
      && codeData.providerTokens !== null
      && typeof codeData.providerTokens === 'object'
    ) {
      try {
        const authModule = await getAuthModule();
        const providersService = authModule.exports.providersService();
        const provider = await providersService.getProvider(codeData.provider) as {
          exchangeCodeForTokens?: (code: string) => Promise<unknown>;
        } | undefined;
        const tokenData = codeData.providerTokens as IProviderTokens;
        if (provider && typeof tokenData.code === 'string') {
          const {code} = tokenData;
          if (code.length > 0 && provider.exchangeCodeForTokens && typeof provider.exchangeCodeForTokens === 'function') {
            const providerTokens = await provider.exchangeCodeForTokens(code);
            codeData.providerTokens = providerTokens as Record<string, unknown>;
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

    const sessionData: IUserSessionData = {
      userId: codeData.userId ?? 'anonymous',
    };

    if (typeof codeData.provider === 'string') {
      sessionData.provider = codeData.provider;
    }

    if (codeData.providerTokens !== null && typeof codeData.providerTokens === 'object') {
      sessionData.providerTokens = codeData.providerTokens;
    }

    userSessions.set(sessionId, sessionData);

    const tokens = await this.generateTokens(
      codeData.userId ?? 'anonymous',
      codeData.clientId,
      codeData.scope,
      codeData.provider,
      sessionId,
      codeData.userEmail,
    );

    return res.json(tokens);
  }

  /**
   * Handles refresh token grant type
   * Exchanges refresh token for new access token.
   * @param params - Token request parameters.
   * @param res - Express response object.
   * @returns Promise resolving to response or void.
   */
  private async handleRefreshTokenGrant(
    params: ITokenRequestParams,
    res: ExpressResponse,
  ): Promise<ExpressResponse> {
    if (typeof params.refresh_token !== 'string') {
      const error = OAuth2Error.invalidRequest('Missing refresh token');
      return res.status(error.code).json(error.toJSON());
    }

    const tokenData = refreshTokens.get(params.refresh_token);
    if (typeof tokenData === 'undefined') {
      const error = OAuth2Error.invalidGrant('Invalid refresh token');
      return res.status(error.code).json(error.toJSON());
    }

    if (tokenData.expiresAt < new Date()) {
      refreshTokens.delete(params.refresh_token);
      const error = OAuth2Error.invalidGrant('Refresh token expired');
      return res.status(error.code).json(error.toJSON());
    }

    if (typeof params.client_id === 'string'
        && tokenData.clientId !== params.client_id) {
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

    return res.json(tokens);
  }

  /**
   * Generates access and refresh tokens
   * Creates JWT-like tokens with appropriate claims and expiration.
   * @param userId - User identifier.
   * @param clientId - Client identifier.
   * @param scope - Token scope.
   * @param provider - Optional provider name.
   * @param sessionId - Optional session identifier.
   * @param userEmail - Optional user email.
   * @returns Promise resolving to token response.
   */
  private async generateTokens(
    userId: string,
    clientId: string,
    scope: string,
    provider?: string,
    sessionId?: string,
    userEmail?: string,
  ): Promise<ITokenResponse> {
    const now = Math.floor(Date.now() / 1000);

    let userData: IUserData | null = null;
    const userRoles: string[] = [];
    try {
      const authRepo = AuthRepository.getInstance();
      const user = await authRepo.getIUserById(userId);
      if (user) {
        userData = {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          avatar: user.avatarUrl ?? undefined,
          roles: []
        };
        if (userData !== null) {
          userData.roles = [];
        }
      }
    } catch (error) {
      logger.error(LogSource.AUTH, 'Failed to fetch user data', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'oauth2',
        action: 'user_fetch'
      });
      if (typeof userEmail === 'string') {
        userData = {
          id: userId,
          email: userEmail,
          name: undefined,
          avatar: undefined,
          roles: [],
        };
      }
    }

    const accessTokenPayload: IJWTTokenPayload = {
      sub: userId,
      clientid: clientId,
      scope,
      provider: provider ?? undefined,
      sessionid: sessionId ?? undefined,
      tokentype: 'access',
      iss: CONFIG.JWTISSUER,
      aud: CONFIG.JWTAUDIENCE,
      iat: now,
      exp: now + 3600,
      jti: randomBytes(16).toString('hex'),
      user: userData,
      roles: userRoles,
      email: userData?.email ?? undefined,
    };

    const jwtPayload: Record<string, unknown> = {
      sub: accessTokenPayload.sub,
      iss: accessTokenPayload.iss,
      aud: accessTokenPayload.aud,
      iat: accessTokenPayload.iat,
      exp: accessTokenPayload.exp,
      jti: accessTokenPayload.jti,
      clientid: accessTokenPayload.clientid,
      scope: accessTokenPayload.scope,
      provider: accessTokenPayload.provider,
      sessionid: accessTokenPayload.sessionid,
      tokentype: accessTokenPayload.tokentype,
      user: accessTokenPayload.user,
      roles: accessTokenPayload.roles,
      email: accessTokenPayload.email,
    };

    const accessToken = await jwtSign(jwtPayload, {
      issuer: CONFIG.JWTISSUER,
      audience: CONFIG.JWTAUDIENCE,
      expiresIn: 3600,
    });

    const refreshToken = randomBytes(32).toString('base64url');

    const refreshTokenData: IRefreshTokenData = {
      clientId,
      userId,
      scope,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    if (typeof provider === 'string') {
      refreshTokenData.provider = provider;
    }

    refreshTokens.set(refreshToken, refreshTokenData);

    const response: ITokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope,
    };

    return response;
  }

  /**
   * Retrieves user session data by session ID
   * Used by userinfo endpoint to get user details.
   * @param sessionId - Session identifier.
   * @returns User session data or undefined if not found.
   */
  public static getUserSession(sessionId: string): IUserSessionData | undefined {
    return userSessions.get(sessionId);
  }

  /**
   * Validates an access token and extracts claims
   * Returns decoded token payload if valid.
   * @param token - JWT access token.
   * @returns Promise resolving to token payload or null if invalid.
   */
  public static async validateAccessToken(token: string): Promise<IJWTTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, {
        issuer: CONFIG.JWTISSUER,
        audience: CONFIG.JWTAUDIENCE,
      });

      if (payload === null
          || typeof payload !== 'object'
          || !('tokentype' in payload)
          || payload.tokentype !== 'access') {
        return null;
      }

      return payload as IJWTTokenPayload;
    } catch {
      return null;
    }
  }
}
