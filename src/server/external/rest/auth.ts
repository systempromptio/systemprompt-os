/**
 * Unified authentication endpoint for SystemPrompt OS.
 * @file Unified authentication endpoint for SystemPrompt OS.
 * @module server/external/rest/auth
 */

import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  Router
} from 'express';
import { getAuthModule } from '@/modules/core/auth/index';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';
import {
 type AuthPageConfig, renderAuthPage
} from '@/server/external/templates/auth';
import type {
  TokenResponse
} from '@/server/external/auth/types/auth.types';

const logger = LoggerService.getInstance();

/**
 * Unified authentication endpoint handling login, registration, and logout.
 */
export class AuthEndpoint {
  /**
   * Handles GET requests to the auth page
   * Shows login options for unauthenticated users or account info for authenticated users.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise that resolves when response is sent.
   */
  public handleAuthPage(req: ExpressRequest, res: ExpressResponse): void {
    try {
      const error = typeof req.query.error === 'string' ? req.query.error : undefined;

      try {
        const authModule = getAuthModule();
        const providersService = authModule.exports.providersService();
        const providers = providersService.getAllProviderInstances();

        const authPageConfig: AuthPageConfig = {
          providers,
          isAuthenticated: false,
          ...error === undefined ? {} : { error }
        };

        const html = renderAuthPage(authPageConfig);

        res.type('html').send(html);
      } catch (authError) {
        const authPageConfig: AuthPageConfig = {
          providers: [],
          isAuthenticated: false,
          ...error === undefined ? {} : { error }
        };

        const html = renderAuthPage(authPageConfig);
        res.type('html').send(html);
      }
    } catch (error: unknown) {
      logger.error(LogSource.AUTH, 'Auth page error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'page'
      });
      res.status(500).json({
        error: 'servererror',
        errorDescription: 'Failed to load authentication page'
      });
    }
  }

  /**
   * Handles OAuth callback after successful authentication.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise that resolves when response is sent.
   */
  public async handleAuthCallback(req: ExpressRequest, res: ExpressResponse): Promise<void> {
    try {
      const { query } = req;
      const code = typeof query.code === 'string' ? query.code : undefined;
      const error = typeof query.error === 'string' ? query.error : undefined;
      const errorDescription = typeof query.errorDescription === 'string'
        ? query.errorDescription
        : undefined;

      if (error !== undefined) {
        logger.error(LogSource.AUTH, 'OAuth error during auth', {
          error: new Error(error),
          errorDescription,
          category: 'oauth'
        });
        res.redirect(`/auth?error=${encodeURIComponent(error)}`);
        return;
      }

      if (code === undefined) {
        throw new Error('Missing authorization code');
      }

      await this.completeAuthentication(code, res);
    } catch (error: unknown) {
      logger.error(LogSource.AUTH, 'Auth callback error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'callback'
      });
      res.redirect('/auth?error=Authentication%20failed');
    }
  }

  /**
   * Handles POST requests to logout.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise that resolves when response is sent.
   */
  public handleLogout(req: ExpressRequest, res: ExpressResponse): void {
    try {
      res.clearCookie('auth_token');
      res.clearCookie('refresh_token');

      logger.info(LogSource.AUTH, 'User logged out', {
        userId: req.user?.id,
        category: 'logout',
        action: 'logout'
      });

      res.redirect('/');
    } catch (error: unknown) {
      logger.error(LogSource.AUTH, 'Logout error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'logout'
      });
      res.redirect('/');
    }
  }

  /**
   * Type guard to check if value is a record object.
   * @param value - Value to check.
   * @returns True if value is a record object.
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  /**
   * Formats raw token response into TokenResponse type.
   * @param raw - Raw token response object.
   * @returns Formatted token response.
   */
  private formatTokenResponse(raw: Record<string, unknown>): TokenResponse {
    const response: TokenResponse = {
      accessToken: String(raw.access_token)
    };

    if (typeof raw.refresh_token === 'string') {
      response.refreshToken = raw.refresh_token;
    }
    if (typeof raw.expires_in === 'number') {
      response.expiresIn = raw.expires_in;
    }
    if (typeof raw.token_type === 'string') {
      response.tokenType = raw.token_type;
    }
    if (typeof raw.scope === 'string') {
      response.scope = raw.scope;
    }

    return response;
  }

  /**
   * Exchanges authorization code for tokens.
   * @param code - Authorization code from OAuth provider.
   * @param baseUrl - Base URL of the application.
   * @returns Promise that resolves to token response.
   */
  private async exchangeCodeForTokens(
    code: string,
    baseUrl: string
  ): Promise<TokenResponse> {
    const tokenUrl = `${baseUrl}/oauth2/token`;
    const redirectUri = `${baseUrl}/auth/callback`;

    logger.info(LogSource.AUTH, 'Attempting token exchange', {
      category: 'token',
      action: 'exchange',
      persistToDb: false
    });

    const headers = new Headers();
    headers.set('Content-Type', 'application/x-www-form-urlencoded');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: new URLSearchParams([
        ['grant_type', 'authorization_code'],
        ['code', code],
        ['client_id', 'auth-client'],
        ['redirect_uri', redirectUri]
      ]).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      logger.error(LogSource.AUTH, 'Token exchange failed', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        category: 'token',
        action: 'exchange'
      });
      throw new Error(`Token exchange failed: ${String(tokenResponse.status)} ${errorBody}`);
    }

    const tokensJson: unknown = await tokenResponse.json();
    if (!this.isRecord(tokensJson)) {
      throw new Error('Invalid token response format');
    }
    return this.formatTokenResponse(tokensJson);
  }

  /**
   * Sets authentication cookies on the response.
   * @param tokens - Token response containing access and refresh tokens.
   * @param res - Express response object.
   */
  private setAuthCookies(tokens: TokenResponse, res: ExpressResponse): void {
    const defaultExpiresIn = 3600;
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: (tokens.expiresIn ?? defaultExpiresIn) * 1000
    };

    res.cookie('auth_token', tokens.accessToken, cookieOptions);

    if (tokens.refreshToken !== undefined) {
      const refreshTokenMaxAge = 30 * 24 * 60 * 60 * 1000;
      res.cookie('refresh_token', tokens.refreshToken, {
        ...cookieOptions,
        maxAge: refreshTokenMaxAge
      });
    }
  }

  /**
   * Completes the authentication process by exchanging code for tokens.
   * @param code - Authorization code from OAuth provider.
   * @param res - Express response object.
   * @returns Promise that resolves when authentication is complete.
   */
  private async completeAuthentication(code: string, res: ExpressResponse): Promise<void> {
    const baseUrl = 'http://localhost:3000'
    const tokens = await this.exchangeCodeForTokens(code, baseUrl);
    this.setAuthCookies(tokens, res);
    res.redirect('/dashboard');
  }
}

/**
 * Configures authentication routes on the Express router.
 * @param router - Express router instance to mount routes on.
 */
export const setupRoutes = (router: Router): void => {
  const authEndpoint = new AuthEndpoint();

  router.get('/auth', (req: ExpressRequest, res: ExpressResponse): void => {
    authEndpoint.handleAuthPage(req, res);
  });

  router.get('/auth/callback', async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
    await authEndpoint.handleAuthCallback(req, res);
  });

  router.post('/auth/logout', (req: ExpressRequest, res: ExpressResponse): void => {
    authEndpoint.handleLogout(req, res);
  });
};
