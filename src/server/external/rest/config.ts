/**
 * @fileoverview SystemPrompt OS configuration endpoint with permission-based access control
 * @module server/external/rest/config
 */

import type { Request, Response, Router } from 'express';
import { getDatabase } from '@/modules/core/database/index.js';
import { getAuthModule } from '@/modules/core/auth/singleton.js';
import { logger } from '@/utils/logger.js';
import { renderLayout } from '../templates/config/layout.js';
import { renderInitialSetup, getInitialSetupStyles } from '../templates/config/initial-setup.js';
import { renderAdminConfig, getAdminConfigStyles, type AdminConfigData } from '../templates/config/admin-config.js';
import { renderStatusPage, getStatusPageStyles, type StatusPageData } from '../templates/config/status.js';

/**
 * Configuration endpoint handler implementing role-based access control
 * 
 * Provides three distinct views based on system state and user permissions:
 * - Initial setup view: Displayed when no admin users exist in the system
 * - Admin configuration view: Full system management interface for administrators
 * - Status view: Limited system information for non-admin users
 */
export class ConfigEndpoint {
  /**
   * Handles GET requests to the configuration page
   * 
   * Determines which view to render based on:
   * - Existence of admin users in the database
   * - Current user's authentication status
   * - Current user's role assignments
   * 
   * @param req Express request object potentially containing authenticated user information
   * @param res Express response object for sending HTML responses
   * @returns Promise that resolves when response is sent
   */
  public async handleConfigPage(req: Request, res: Response): Promise<void> {
    try {
      const adminExists = await this.checkAdminExists();
      const userContext = this.getUserContext(req);
      const systemStatus = this.getSystemStatus();

      if (!adminExists) {
        await this.renderInitialSetup(res);
      } else if (userContext.isAdmin) {
        await this.renderAdminConfig(res, systemStatus);
      } else {
        await this.renderStatusPage(res, systemStatus);
      }
    } catch (error) {
      logger.error('Config page error', { error });
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to load configuration page'
      });
    }
  }

  /**
   * Handles OAuth callback during initial admin setup
   * 
   * Processes the OAuth response from identity providers and creates
   * the first admin user in the system. This endpoint is only accessible
   * when no admin users exist.
   * 
   * @param req Express request containing OAuth callback parameters
   * @param res Express response object
   * @returns Promise that resolves when response is sent
   */
  public async handleOAuthCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        logger.error('OAuth error during setup', { error, error_description });
        return this.renderError(res, 'Authentication Failed', 
          `Error: ${error}`, error_description as string);
      }

      if (!code || state !== 'setup-flow') {
        throw new Error('Invalid OAuth callback parameters');
      }

      const adminExists = await this.checkAdminExists();
      if (adminExists) {
        return this.renderError(res, 'Setup Already Complete',
          'An administrator account already exists.');
      }

      await this.exchangeCodeForTokens(code as string);
      await this.renderSuccess(res);
    } catch (error) {
      logger.error('Setup OAuth callback error', { error });
      this.renderError(res, 'Setup Error',
        'An error occurred during setup. Please try again.',
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Checks if any admin users exist in the database
   * 
   * @returns Promise resolving to true if at least one admin user exists
   */
  private async checkAdminExists(): Promise<boolean> {
    const db = getDatabase();
    const result = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_users u 
       JOIN auth_user_roles ur ON u.id = ur.user_id 
       JOIN auth_roles r ON ur.role_id = r.id 
       WHERE r.name = 'admin'`
    );
    return (result[0]?.count || 0) > 0;
  }

  /**
   * Extracts user context from the request
   * 
   * @param req Express request potentially containing authenticated user
   * @returns User context including authentication status and admin role
   */
  private getUserContext(req: Request): { isAuthenticated: boolean; isAdmin: boolean } {
    const user = (req as any).user;
    return {
      isAuthenticated: !!user,
      isAdmin: user?.roles?.includes('admin') || false
    };
  }

  /**
   * Retrieves current system status information
   * 
   * @returns System status including URLs and service states
   */
  private getSystemStatus(): { cloudflareUrl: string; tunnelStatus: string } {
    return {
      cloudflareUrl: process.env.BASE_URL || 'Not configured',
      tunnelStatus: process.env.CLOUDFLARE_TUNNEL_TOKEN ? 'Active' : 'Inactive'
    };
  }

  /**
   * Renders the initial setup page for creating the first admin
   * 
   * @param res Express response object
   * @returns Promise that resolves when response is sent
   */
  private async renderInitialSetup(res: Response): Promise<void> {
    const authModule = getAuthModule();
    const providerRegistry = authModule.getProviderRegistry();
    
    if (!providerRegistry) {
      throw new Error('Provider registry not initialized');
    }

    const providers = providerRegistry.getAllProviders();
    const content = renderInitialSetup(providers);
    const html = renderLayout({
      title: 'Setup',
      content,
      styles: getInitialSetupStyles()
    });
    
    res.type('html').send(html);
  }

  /**
   * Renders the admin configuration page
   * 
   * @param res Express response object
   * @param systemStatus Current system status information
   * @returns Promise that resolves when response is sent
   */
  private async renderAdminConfig(res: Response, systemStatus: { cloudflareUrl: string; tunnelStatus: string }): Promise<void> {
    const configData: AdminConfigData = {
      ...systemStatus,
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      googleConfigured: !!process.env.GOOGLE_CLIENT_ID,
      githubConfigured: !!process.env.GITHUB_CLIENT_ID
    };

    const content = renderAdminConfig(configData);
    const html = renderLayout({
      title: 'Configuration',
      content,
      styles: getAdminConfigStyles()
    });
    
    res.type('html').send(html);
  }

  /**
   * Renders the status page for non-admin users
   * 
   * @param res Express response object
   * @param systemStatus Current system status information
   * @returns Promise that resolves when response is sent
   */
  private async renderStatusPage(res: Response, systemStatus: { cloudflareUrl: string; tunnelStatus: string }): Promise<void> {
    const statusData: StatusPageData = systemStatus;
    const content = renderStatusPage(statusData);
    const html = renderLayout({
      title: 'System Status',
      content,
      styles: getStatusPageStyles()
    });
    
    res.type('html').send(html);
  }

  /**
   * Exchanges OAuth authorization code for access tokens
   * 
   * @param code Authorization code from OAuth provider
   * @returns Promise that resolves when token exchange is complete
   */
  private async exchangeCodeForTokens(code: string): Promise<void> {
    const tokenResponse = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: 'setup-client',
        redirect_uri: `${process.env.BASE_URL || 'http://localhost:3000'}/config/oauth/callback`,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json() as { error?: string; error_description?: string };
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error || 'Unknown error'}`);
    }

    const tokens = await tokenResponse.json() as { access_token: string };
    await this.verifyUserCreation(tokens.access_token);
  }

  /**
   * Verifies that user was created successfully
   * 
   * @param accessToken Access token for user verification
   * @returns Promise that resolves when verification is complete
   */
  private async verifyUserCreation(accessToken: string): Promise<void> {
    const userInfoResponse = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}/oauth2/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to verify user creation');
    }
  }

  /**
   * Renders a success page after setup completion
   * 
   * @param res Express response object
   * @returns Promise that resolves when response is sent
   */
  private async renderSuccess(res: Response): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Setup Complete</title>
        <script>setTimeout(() => window.location.href = '/', 3000);</script>
      </head>
      <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1>Setup Complete!</h1>
        <p>Redirecting to dashboard...</p>
      </body>
      </html>
    `;
    res.type('html').send(html);
  }

  /**
   * Renders an error page
   * 
   * @param res Express response object
   * @param title Error page title
   * @param message Primary error message
   * @param details Optional detailed error information
   * @returns void
   */
  private renderError(res: Response, title: string, message: string, details?: string): void {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1>${title}</h1>
        <p>${message}</p>
        ${details ? `<p>${details}</p>` : ''}
        <a href="/config">Try again</a>
      </body>
      </html>
    `;
    res.status(400).type('html').send(html);
  }
}

/**
 * Configures and registers configuration routes on the Express router
 * 
 * @param router Express router instance to mount routes on
 */
export function setupRoutes(router: Router): void {
  const configEndpoint = new ConfigEndpoint();
  
  router.get('/config', (req, res) => configEndpoint.handleConfigPage(req, res));
  router.get('/config/oauth/callback', (req, res) => configEndpoint.handleOAuthCallback(req, res));
}

/**
 * Sets up config routes without authentication (for initial setup)
 * 
 * @param router Express router instance
 */
export function setupPublicRoutes(router: Router): void {
  const configEndpoint = new ConfigEndpoint();
  
  router.get('/config', async (req, res) => {
    const db = await import('@/modules/core/database/index.js').then(m => m.getDatabase());
    const adminCount = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_users u 
       JOIN auth_user_roles ur ON u.id = ur.user_id 
       JOIN auth_roles r ON ur.role_id = r.id 
       WHERE r.name = 'admin'`
    ).then(result => result[0]?.count || 0);
    
    if (adminCount === 0) {
      configEndpoint.handleConfigPage(req, res);
    } else {
      res.redirect('/auth');
    }
  });
}