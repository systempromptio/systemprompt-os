/**
 * Unified OAuth2 Token Endpoint.
 * Handles token exchange using auth module services.
 * Supports authorization_code, refresh_token, and client_credentials grant types.
 * @module server/external/rest/oauth2/unified-token
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { z } from 'zod';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/manual';
import { ServerAuthAdapter } from '@/server/services/auth-adapter.service';

const logger = LoggerService.getInstance();

/**
 * Token request schema.
 */
const tokenRequestSchema = z.discriminatedUnion('grant_type', [
  // Authorization code grant
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string(),
    client_id: z.string(),
    client_secret: z.string().optional(),
    redirect_uri: z.string().url(),
    code_verifier: z.string().optional(), // PKCE
  }),
  // Refresh token grant
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string(),
    client_id: z.string(),
    client_secret: z.string().optional(),
    scope: z.string().optional(),
  }),
  // Client credentials grant
  z.object({
    grant_type: z.literal('client_credentials'),
    client_id: z.string(),
    client_secret: z.string(),
    scope: z.string().optional(),
  }),
]);

/**
 * Token error response.
 */
interface TokenError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * Token success response.
 */
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/**
 * Unified OAuth2 Token Endpoint.
 */
export class UnifiedTokenEndpoint {
  constructor() {
  }

  /**
   * Handle POST /oauth2/token.
   * @param req
   * @param res
   */
  async handleTokenRequest(req: ExpressRequest, res: ExpressResponse): Promise<void> {
    try {
      const params = this.validateRequest(req);

      const authAdapter = ServerAuthAdapter.getInstance();

      try {
        authAdapter.initialize();
      } catch (error) {
        logger.error(LogSource.AUTH, 'Auth adapter initialization failed', { error: error instanceof Error ? error : String(error) });
        if (params.grant_type === 'client_credentials') {
          this.sendError(res, {
            error: 'unsupported_grant_type',
            error_description: 'Client credentials grant not supported',
          }); return;
        }
        this.sendError(res, {
          error: 'server_error',
          error_description: 'Authentication service unavailable',
        }); return;
      }

      switch (params.grant_type) {
        case 'authorization_code':
          { await this.handleAuthorizationCode(params, res, authAdapter); return; }
        case 'refresh_token':
          { await this.handleRefreshToken(params, res, authAdapter); return; }
        case 'client_credentials':
          { await this.handleClientCredentials(params, res, authAdapter); }
      }
    } catch (error) {
      logger.error(LogSource.AUTH, 'Token request error', { error: error instanceof Error ? error : String(error) });

      if (error instanceof z.ZodError) {
        this.sendError(res, {
          error: 'invalid_request',
          error_description: 'Invalid request parameters',
        }); return;
      }

      this.sendError(res, {
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  }

  /**
   * Handle authorization code grant.
   * @param params
   * @param res
   * @param authAdapter
   */
  private async handleAuthorizationCode(
    params: z.infer<typeof tokenRequestSchema> & { grant_type: 'authorization_code' },
    res: ExpressResponse,
    authAdapter: ServerAuthAdapter
  ): Promise<void> {
    try {
      if (params.client_secret) {
      }

      const codeData = await authAdapter.validateAuthorizationCode(
        params.code,
        params.client_id,
        params.redirect_uri,
        params.code_verifier
      );

      if (!codeData) {
        this.sendError(res, {
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }); return;
      }

      const tokens = await authAdapter.createTokensFromCode(codeData);

      logger.info(LogSource.AUTH, 'Tokens issued for authorization code', {
        clientId: params.client_id,
        userId: codeData.user_id,
        ...tokens.scope && { scope: tokens.scope },
      });

      this.sendTokenResponse(res, {
        access_token: tokens.accessToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        ...tokens.scope && { scope: tokens.scope },
      });
    } catch (error) {
      logger.error(LogSource.AUTH, 'Authorization code grant error', { error: error instanceof Error ? error.message : String(error) });

      if (error instanceof Error && error.message.includes('expired')) {
        this.sendError(res, {
          error: 'invalid_grant',
          error_description: 'Authorization code has expired',
        }); return;
      }

      if (error instanceof Error && error.message.includes('PKCE')) {
        this.sendError(res, {
          error: 'invalid_grant',
          error_description: 'PKCE verification failed',
        }); return;
      }

      this.sendError(res, {
        error: 'server_error',
        error_description: 'Failed to process authorization code',
      });
    }
  }

  /**
   * Handle refresh token grant.
   * @param params
   * @param res
   * @param authAdapter
   */
  private async handleRefreshToken(
    params: z.infer<typeof tokenRequestSchema> & { grant_type: 'refresh_token' },
    res: ExpressResponse,
    authAdapter: ServerAuthAdapter
  ): Promise<void> {
    try {
      if (params.client_secret) {
      }

      const tokenResponse = await authAdapter.refreshAccessToken(params.refresh_token);

      logger.info(LogSource.AUTH, 'Access token refreshed', {
        clientId: params.client_id,
        scope: tokenResponse.scope,
      });

      this.sendTokenResponse(res, {
        access_token: tokenResponse.accessToken,
        token_type: tokenResponse.tokenType,
        expires_in: tokenResponse.expiresIn,
        ...tokenResponse.scope && { scope: tokenResponse.scope },
      });
    } catch (error) {
      logger.error(LogSource.AUTH, 'Refresh token grant error', { error: error instanceof Error ? error.message : String(error) });

      if (error instanceof Error && error.message.includes('expired')) {
        this.sendError(res, {
          error: 'invalid_grant',
          error_description: 'Refresh token has expired',
        }); return;
      }

      if (error instanceof Error && error.message.includes('revoked')) {
        this.sendError(res, {
          error: 'invalid_grant',
          error_description: 'Refresh token has been revoked',
        }); return;
      }

      this.sendError(res, {
        error: 'server_error',
        error_description: 'Failed to refresh access token',
      });
    }
  }

  /**
   * Handle client credentials grant.
   * @param params
   * @param _params
   * @param res
   * @param authAdapter
   * @param _authAdapter
   */
  private async handleClientCredentials(
    _params: z.infer<typeof tokenRequestSchema> & { grant_type: 'client_credentials' },
    res: ExpressResponse,
    _authAdapter: ServerAuthAdapter
  ): Promise<void> {
    try {
      this.sendError(res, {
        error: 'unsupported_grant_type',
        error_description: 'Client credentials grant not yet implemented',
      });
    } catch (error) {
      logger.error(LogSource.AUTH, 'Client credentials grant error', { error: error instanceof Error ? error.message : String(error) });

      this.sendError(res, {
        error: 'server_error',
        error_description: 'Failed to process client credentials',
      });
    }
  }

  /**
   * Validate token request.
   * @param req
   */
  private validateRequest(req: ExpressRequest): z.infer<typeof tokenRequestSchema> {
    const params = req.body;

    if (!params || typeof params !== 'object') {
      throw new Error('Missing request body');
    }

    return tokenRequestSchema.parse(params);
  }

  /**
   * Send token response.
   * @param res
   * @param tokens
   */
  private sendTokenResponse(res: ExpressResponse, tokens: TokenResponse): void {
    res.set({
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    });

    res.json(tokens);
  }

  /**
   * Send error response.
   * @param res
   * @param error
   */
  private sendError(res: ExpressResponse, error: TokenError): void {
    let statusCode = 400

    if (error.error === 'invalid_client') {
      statusCode = 401
    } else if (error.error === 'server_error') {
      statusCode = 500
    } else if (error.error === 'temporarily_unavailable') {
      statusCode = 503
    }

    res.status(statusCode).json(error);
  }
}
