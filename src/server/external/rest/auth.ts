/**
 * @fileoverview Unified authentication endpoint for SystemPrompt OS
 * @module server/external/rest/auth
 */

import type { Request, Response, Router } from 'express';
import { getAuthModule } from '@/modules/core/auth/singleton.js';
import { logger } from '@/utils/logger.js';
import { renderAuthPage } from '../templates/auth.js';
import { tunnelStatus } from '@/modules/core/auth/tunnel-status.js';

/**
 * Unified authentication endpoint handling login, registration, and logout
 */
export class AuthEndpoint {
  /**
   * Handles GET requests to the auth page
   * Shows login options for unauthenticated users or account info for authenticated users
   * 
   * @param req Express request object
   * @param res Express response object
   * @returns Promise that resolves when response is sent
   */
  public async handleAuthPage(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const error = req.query.error as string | undefined;
      
      const authModule = getAuthModule();
      const providerRegistry = authModule.getProviderRegistry();
      
      if (!providerRegistry) {
        throw new Error('Provider registry not initialized');
      }

      const providers = providerRegistry.getAllProviders();
      
      const html = renderAuthPage({
        providers,
        isAuthenticated: !!user,
        userEmail: user?.email,
        error
      });
      
      res.type('html').send(html);
    } catch (error) {
      logger.error('Auth page error', { error });
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to load authentication page'
      });
    }
  }

  /**
   * Handles OAuth callback after successful authentication
   * 
   * @param req Express request object
   * @param res Express response object
   * @returns Promise that resolves when response is sent
   */
  public async handleAuthCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        logger.error('OAuth error during auth', { error, error_description });
        return res.redirect(`/auth?error=${encodeURIComponent(error as string)}`);
      }

      if (!code || state !== 'auth-flow') {
        throw new Error('Invalid OAuth callback parameters');
      }

      await this.completeAuthentication(code as string, res);
    } catch (error) {
      logger.error('Auth callback error', { error });
      res.redirect('/auth?error=Authentication%20failed');
    }
  }

  /**
   * Handles POST requests to logout
   * 
   * @param req Express request object
   * @param res Express response object
   * @returns Promise that resolves when response is sent
   */
  public async handleLogout(req: Request, res: Response): Promise<void> {
    try {
      res.clearCookie('auth_token');
      res.clearCookie('refresh_token');
      
      logger.info('User logged out', { userId: (req as any).user?.id });
      
      res.redirect('/');
    } catch (error) {
      logger.error('Logout error', { error });
      res.redirect('/');
    }
  }

  /**
   * Completes the authentication process by exchanging code for tokens
   * 
   * @param code Authorization code from OAuth provider
   * @param res Express response object
   * @returns Promise that resolves when authentication is complete
   */
  private async completeAuthentication(code: string, res: Response): Promise<void> {
    const baseUrl = tunnelStatus.getBaseUrlOrDefault(process.env.BASE_URL || 'http://localhost:3000');
    const tokenUrl = `${baseUrl}/oauth2/token`;
    const redirectUri = `${baseUrl}/auth/callback`;
    
    logger.info('Attempting token exchange', {
      tokenUrl,
      redirectUri,
      codeLength: code.length
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
      logger.error('Token exchange failed', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorBody
      });
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorBody}`);
    }

    const tokens = await tokenResponse.json() as { 
      access_token: string; 
      refresh_token?: string;
      expires_in?: number;
    };

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: (tokens.expires_in || 3600) * 1000
    };

    res.cookie('auth_token', tokens.access_token, cookieOptions);
    
    if (tokens.refresh_token) {
      res.cookie('refresh_token', tokens.refresh_token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }

    res.redirect('/config');
  }
}

/**
 * Configures authentication routes on the Express router
 * 
 * @param router Express router instance to mount routes on
 */
export function setupRoutes(router: Router): void {
  const authEndpoint = new AuthEndpoint();
  
  router.get('/auth', (req, res) => authEndpoint.handleAuthPage(req, res));
  router.get('/auth/callback', (req, res) => authEndpoint.handleAuthCallback(req, res));
  router.post('/auth/logout', (req, res) => authEndpoint.handleLogout(req, res));
}