/**
 * Unified OAuth2 Authorization Endpoint.
 * Consolidates OAuth2 authorization flow using auth module services.
 * Handles provider selection, state management, and authorization code generation.
 * @module server/external/rest/oauth2/unified-authorize
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { type OAuthStateData, ServerAuthAdapter } from '@/server/services/auth-adapter.service';

const logger = LoggerService.getInstance();

/**
 * OAuth2 error response.
 */
interface OAuth2Error {
  error: string;
  error_description?: string;
  error_uri?: string;
  state?: string;
}

/**
 * Authorization request parameters schema.
 */
const authorizeRequestSchema = z.object({
  response_type: z.enum(['code', 'code id_token']),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string().optional()
.default('openid email profile'),
  state: z.string().optional(),
  nonce: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(['S256', 'plain']).optional(),
  provider: z.string().optional(),
  idp: z.string().optional(), // Backwards compatibility
});

/**
 * Parsed authorization request.
 */
type AuthorizeRequest = z.infer<typeof authorizeRequestSchema>;

/**
 * Unified OAuth2 Authorization Endpoint.
 */
export class UnifiedAuthorizeEndpoint {
  constructor() {
  }

  /**
   * Handle GET /oauth2/authorize.
   * @param req
   * @param res
   */
  async handleAuthorize(req: ExpressRequest, res: ExpressResponse): Promise<void> {
    try {
      const params = this.validateRequest(req);

      const providerId = params.provider || params.idp;

      if (!providerId) {
        res.redirect(`/auth?client_id=${encodeURIComponent(params.client_id)}`);
        return;
      }

      const authAdapter = ServerAuthAdapter.getInstance();

      try {
        authAdapter.initialize();
      } catch (error) {
        logger.error(LogSource.AUTH, 'Auth adapter not initialized', { error: error instanceof Error ? error.message : String(error) });
        this.sendError(res, params, {
          error: 'server_error',
          error_description: 'Authentication service unavailable'
        }); return;
      }

      const provider = await authAdapter.getProvider(providerId);

      if (!provider) {
        this.sendError(res, params, {
          error: 'invalid_request',
          error_description: `Unknown provider: ${providerId}`
        }); return;
      }

      const stateData: OAuthStateData = {
        nonce: randomBytes(16).toString('hex'),
        timestamp: Date.now(),
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        scope: params.scope,
        provider: providerId,
        ...params.code_challenge !== undefined && { codeChallenge: params.code_challenge },
        ...params.code_challenge_method !== undefined && { codeChallengeMethod: params.code_challenge_method },
        ...params.state !== undefined && { originalState: params.state }
      };

      const stateNonce = await authAdapter.createAuthorizationState(stateData);

      const callbackUrl = await authAdapter.getProviderCallbackUrl(providerId);
      const authUrl = await provider.getAuthorizationUrl({
        state: stateNonce,
        redirectUri: callbackUrl,
        scope: this.mapScopesToProvider(params.scope, providerId),
        nonce: params.nonce
      });

      logger.info(LogSource.AUTH, 'Redirecting to provider', {
        provider: providerId,
        clientId: params.client_id,
        scope: params.scope
      });

      res.redirect(authUrl);
    } catch (error) {
      logger.error(LogSource.AUTH, 'Authorization error', { error: error instanceof Error ? error.message : String(error) });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid request parameters',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'server_error',
          error_description: 'Internal server error'
        });
      }
    }
  }

  /**
   * Handle provider callback.
   * @param req
   * @param res
   */
  async handleProviderCallback(req: ExpressRequest, res: ExpressResponse): Promise<void> {
    try {
      const {
 code, state, error, error_description
} = req.query;

      const authAdapter = ServerAuthAdapter.getInstance();

      try {
        authAdapter.initialize();
      } catch (error) {
        logger.error(LogSource.AUTH, 'Auth adapter initialization failed', { error: error instanceof Error ? error.message : String(error) });
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing state parameter'
        });
        return;
      }

      if (error) {
        logger.error(LogSource.AUTH, 'Provider returned error', {
          error: error instanceof Error ? error : String(error),
          error_description: error_description instanceof Error ? error_description : String(error_description)
        });

        if (state && typeof state === 'string') {
          const stateData = await authAdapter.validateAuthorizationState(state);
          if (stateData) {
            this.sendError(res, null, {
              error: error as string,
              error_description: error_description as string,
              ...stateData.originalState && { state: stateData.originalState }
            }, stateData.redirectUri);
            return;
          }
        }

        res.status(400).send(this.renderErrorPage(
          error as string,
          error_description as string
        ));
        return;
      }

      if (!state || typeof state !== 'string') {
        res.status(400).send(this.renderErrorPage(
          'invalid_request',
          'Missing state parameter'
        ));
        return;
      }

      const stateData = await authAdapter.validateAuthorizationState(state);
      if (!stateData) {
        res.status(400).send(this.renderErrorPage(
          'invalid_request',
          'Invalid or expired state'
        ));
        return;
      }

      if (!code || typeof code !== 'string') {
        this.sendError(res, null, {
          error: 'invalid_request',
          error_description: 'Missing authorization code',
          ...stateData.originalState && { state: stateData.originalState }
        }, stateData.redirectUri);
        return;
      }

      const provider = await authAdapter.getProvider(stateData.provider);
      if (!provider) {
        this.sendError(res, null, {
          error: 'server_error',
          error_description: 'Provider configuration error',
          ...stateData.originalState && { state: stateData.originalState }
        }, stateData.redirectUri);
        return;
      }

      const callbackUrl = await authAdapter.getProviderCallbackUrl(stateData.provider);
      const tokens = await provider.exchangeCodeForTokens(code, {
        redirectUri: callbackUrl,
        state
      });

      const userInfo = await provider.getUserInfo(tokens.access_token);

      const authResult = await authAdapter.authenticateOAuthUser({
        provider: stateData.provider,
        providerUserId: userInfo.sub || userInfo.id,
        email: userInfo.email,
        profile: userInfo
      });

      const session = await authAdapter.createSession(authResult.userId, {
        provider: stateData.provider,
        loginTime: new Date().toISOString()
      });

      const authCode = await authAdapter.createAuthorizationCode({
        userId: authResult.userId,
        clientId: stateData.clientId,
        redirectUri: stateData.redirectUri,
        scope: stateData.scope,
        ...stateData.codeChallenge && { codeChallenge: stateData.codeChallenge },
        ...stateData.codeChallengeMethod && { codeChallengeMethod: stateData.codeChallengeMethod }
      });

      const redirectUrl = new URL(stateData.redirectUri);
      redirectUrl.searchParams.set('code', authCode);
      if (stateData.originalState) {
        redirectUrl.searchParams.set('state', stateData.originalState);
      }

      logger.info(LogSource.AUTH, 'OAuth flow completed successfully', {
        provider: stateData.provider,
        userId: authResult.userId,
        clientId: stateData.clientId
      });

      res.cookie('session_id', session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 100
      });

      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error(LogSource.AUTH, 'Provider callback error', { error: error instanceof Error ? error.message : String(error) });

      const {state} = req.query;
      if (state && typeof state === 'string') {
        const authAdapter = ServerAuthAdapter.getInstance();
        try {
          authAdapter.initialize();
          const stateData = await authAdapter.validateAuthorizationState(state);
          if (stateData) {
            this.sendError(res, null, {
              error: 'server_error',
              error_description: 'Authentication failed',
              ...stateData.originalState && { state: stateData.originalState }
            }, stateData.redirectUri);
        return;
          }
        } catch (err) {
          logger.error(LogSource.AUTH, 'Failed to recover state', { error: err instanceof Error ? err.message : String(err) });
        }
      }

      res.status(500).send(this.renderErrorPage(
        'server_error',
        'An unexpected error occurred during authentication'
      ));
    }
  }

  /**
   * Validate authorization request.
   * @param req
   */
  private validateRequest(req: ExpressRequest): AuthorizeRequest {
    const params = {
      ...req.query,
      ...req.body
    };

    return authorizeRequestSchema.parse(params);
  }

  /**
   * Send OAuth2 error response.
   * @param res
   * @param params
   * @param error
   * @param redirectUri
   */
  private sendError(
    res: ExpressResponse,
    params: AuthorizeRequest | null,
    error: OAuth2Error,
    redirectUri?: string
  ): void {
    if (redirectUri || params?.redirect_uri) {
      const url = new URL(redirectUri || params!.redirect_uri);
      url.searchParams.set('error', error.error);
      if (error.error_description) {
        url.searchParams.set('error_description', error.error_description);
      }
      if (error.error_uri) {
        url.searchParams.set('error_uri', error.error_uri);
      }
      if (error.state || params?.state) {
        url.searchParams.set('state', error.state || params!.state!);
      }
      res.redirect(url.toString());
    } else {
      res.status(400).json(error);
    }
  }

  /**
   * Render error page.
   * @param error
   * @param description
   */
  private renderErrorPage(error: string, description: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Authentication Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .error-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 500px;
            text-align: center;
          }
          h1 {
            color: #dc3545;
            margin-bottom: 1rem;
          }
          p {
            color: #666;
            margin-bottom: 2rem;
          }
          a {
            color: #007bff;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>Authentication Error</h1>
          <p><strong>${error}:</strong> ${description}</p>
          <a href="/">Return to Home</a>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Map generic scopes to provider-specific scopes.
   * @param scope
   * @param provider
   */
  private mapScopesToProvider(scope: string, provider: string): string {
    const scopes = scope.split(' ');
    const providerScopeMap: Record<string, Record<string, string>> = {
      google: {
        openid: 'openid',
        email: 'email',
        profile: 'profile'
      },
      github: {
        openid: 'read:user',
        email: 'user:email',
        profile: 'read:user'
      }
    };

    const mapping = providerScopeMap[provider] || {};
    const mappedScopes = scopes.map(s => { return mapping[s] || s });

    return [...new Set(mappedScopes)].join(' ');
  }
}
