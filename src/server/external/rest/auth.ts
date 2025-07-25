/**
 * @file Unified authentication endpoint for SystemPrompt OS.
 * @module server/external/rest/auth
 */

import type { Request, Response } from 'express';
import type { Router } from 'express';
import { getAuthModule } from '@/modules/core/auth/singleton.js';
import { LoggerService } from '@/modules/core/logger/index.js';
import { LogSource } from '@/modules/core/logger/types/index.js';

const logger = LoggerService.getInstance();
import { renderAuthPage } from '@/server/external/templates/auth.js';
import { tunnelStatus } from '@/modules/core/auth/tunnel-status.js';

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
  public async handleAuthPage(req: Request, res: Response): Promise<void> {
    try {
      const error = req.query['error'] as string | undefined;

      const authModule = getAuthModule();
      const providerRegistry = authModule.exports.getProviderRegistry();

      if (!providerRegistry) {
        throw new Error('Provider registry not initialized');
      }

      const providers = providerRegistry.getAllProviders();

      /*
       * Auth page is always shown as login page
       * If user is authenticated, they should be on protected routes
       */
      const html = renderAuthPage({
        providers,
        isAuthenticated: false,
        ...error && { error },
      });

      res.type('html').send(html);
    } catch (error) {
      logger.error(LogSource.AUTH, 'Auth page error', {
 error: error instanceof Error ? error : new Error(String(error)),
category: 'page'
});
      res.status(500).json({
        error: 'servererror',
        error_description: 'Failed to load authentication page',
      });
    }
  }

  /**
   * Handles OAuth callback after successful authentication.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise that resolves when response is sent.
   */
  public async handleAuthCallback(req: Request, res: Response): Promise<void> {
    try {
      const {
 code, error, error_description
} = req.query;

      if (error) {
        logger.error(LogSource.AUTH, 'OAuth error during auth', {
          error: typeof error === 'string' ? new Error(error) : error instanceof Error ? error : new Error(String(error)),
          error_description,
          category: 'oauth'
        });
        res.redirect(`/auth?error=${encodeURIComponent(error as string)}`);
        return;
      }

      if (!code) {
        throw new Error('Missing authorization code');
      }

      await this.completeAuthentication(code as string, res);
    } catch (error) {
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
  public async handleLogout(req: Request, res: Response): Promise<void> {
    try {
      res.clearCookie('auth_token');
      res.clearCookie('refresh_token');

      logger.info(LogSource.AUTH, 'User logged out', {
        userId: (req as any).user?.id,
        category: 'logout',
        action: 'logout'
      });

      res.redirect('/');
    } catch (error) {
      logger.error(LogSource.AUTH, 'Logout error', {
 error: error instanceof Error ? error : new Error(String(error)),
category: 'logout'
});
      res.redirect('/');
    }
  }

  /**
   * Completes the authentication process by exchanging code for tokens.
   * @param code - Authorization code from OAuth provider.
   * @param res - Express response object.
   * @returns Promise that resolves when authentication is complete.
   */
  private async completeAuthentication(code: string, res: Response): Promise<void> {
    const baseUrl = tunnelStatus.getBaseUrlOrDefault(
      process.env['BASE_URL'] || 'http://localhost:3000',
    );
    const tokenUrl = `${baseUrl}/oauth2/token`;
    const redirectUri = `${baseUrl}/auth/callback`;

    logger.info(LogSource.AUTH, 'Attempting token exchange', {
      category: 'token',
      action: 'exchange',
      persistToDb: false
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: 'auth-client',
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      logger.error(LogSource.AUTH, 'Token exchange failed', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        category: 'token',
        action: 'exchange'
      });
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorBody}`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const cookieOptions = {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax' as const,
      maxAge: (tokens.expires_in || 3600) * 1000,
    };

    res.cookie('auth_token', tokens.access_token, cookieOptions);

    if (tokens.refresh_token) {
      res.cookie('refresh_token', tokens.refresh_token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    res.redirect('/dashboard');
  }
}

/**
 * Configures authentication routes on the Express router.
 * @param router - Express router instance to mount routes on.
 */
export function setupRoutes(router: Router): void {
  const authEndpoint = new AuthEndpoint();

  router.get('/auth', async (req, res) => {
    await authEndpoint.handleAuthPage(req, res);
  });
  router.get('/auth/callback', async (req, res) => {
    await authEndpoint.handleAuthCallback(req, res);
  });
  router.post('/auth/logout', async (req, res) => {
    await authEndpoint.handleLogout(req, res);
  });
}
