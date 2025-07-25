/**
 * @file SystemPrompt OS configuration endpoint with permission-based access control.
 * @module server/external/rest/config
 */

import type { Request, Response } from 'express';
import type { Router } from 'express';
import { getDatabase } from '@/modules/core/database/index';
import { getAuthModule } from '@/modules/core/auth/singleton';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';

const logger = LoggerService.getInstance();
import { renderLayout } from '@/server/external/templates/config/layout';
import {
  getInitialSetupStyles,
  renderInitialSetup,
} from '@/server/external/templates/config/initial-setup';
import {
  type AdminConfigData,
  getAdminConfigStyles,
  renderAdminConfig,
} from '@/server/external/templates/config/admin-config';
import {
  type StatusPageData,
  getStatusPageStyles,
  renderStatusPage,
} from '@/server/external/templates/config/status';

/**
 * Configuration endpoint handler implementing role-based access control.
 * Provides three distinct views based on system state and user permissions:
 * - Initial setup view: Displayed when no admin users exist in the system
 * - Admin configuration view: Full system management interface for administrators
 * - Status view: Limited system information for non-admin users.
 */
export class ConfigEndpoint {
  /**
   * Handles GET requests to the configuration page.
   * Determines which view to render based on:
   * - Existence of admin users in the database
   * - Current user's authentication status
   * - Current user's role assignments.
   * @param req - Express request object potentially containing authenticated user information.
   * @param res - Express response object for sending HTML responses.
   * @returns Promise that resolves when response is sent.
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
      logger.error(LogSource.SERVER, 'Config page error', {
 error: error instanceof Error ? error : new Error(String(error)),
category: 'config'
});
      res.status(500).json({
        error: 'servererror',
        error_description: 'Failed to load configuration page',
      });
    }
  }

  /**
   * Checks if any admin users exist in the database.
   * @returns Promise resolving to true if at least one admin user exists.
   */
  private async checkAdminExists(): Promise<boolean> {
    const db = getDatabase();
    const result = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM auth_users u 
       JOIN auth_user_roles ur ON u.id = ur.user_id 
       JOIN auth_roles r ON ur.role_id = r.id 
       WHERE r.name = 'admin'`,
    );
    return (result[0]?.count || 0) > 0;
  }

  /**
   * Extracts user context from the request.
   * @param req - Express request potentially containing authenticated user.
   * @returns User context including authentication status and admin role.
   */
  private getUserContext(req: Request): { isAuthenticated: boolean; isAdmin: boolean } {
    const { user } = req as any;
    return {
      isAuthenticated: Boolean(user),
      isAdmin: user?.roles?.includes('admin') || false,
    };
  }

  /**
   * Retrieves current system status information.
   * @returns System status including URLs and service states.
   */
  private getSystemStatus(): { cloudflareUrl: string; tunnelStatus: string } {
    return {
      cloudflareUrl: process.env['BASE_URL'] || 'Not configured',
      tunnelStatus: process.env['CLOUDFLARE_TUNNEL_TOKEN'] ? 'Active' : 'Inactive',
    };
  }

  /**
   * Renders the initial setup page for creating the first admin.
   * @param res - Express response object.
   * @returns Promise that resolves when response is sent.
   */
  private async renderInitialSetup(res: Response): Promise<void> {
    const authModule = getAuthModule();
    const providerRegistry = authModule.exports.getProviderRegistry();

    if (!providerRegistry) {
      throw new Error('Provider registry not initialized');
    }

    const providers = providerRegistry.getAllProviders();
    const content = renderInitialSetup(providers);
    const html = renderLayout({
      title: 'Setup',
      content,
      styles: getInitialSetupStyles(),
    });

    res.type('html').send(html);
  }

  /**
   * Renders the admin configuration page.
   * @param res - Express response object.
   * @param systemStatus - Current system status information.
   * @param systemStatus.cloudflareUrl
   * @param systemStatus.tunnelStatus
   * @returns Promise that resolves when response is sent.
   */
  private async renderAdminConfig(
    res: Response,
    systemStatus: { cloudflareUrl: string; tunnelStatus: string },
  ): Promise<void> {
    const configData: AdminConfigData = {
      ...systemStatus,
      version: '0.1.0',
      environment: process.env['NODE_ENV'] || 'development',
      googleConfigured: Boolean(process.env['GOOGLE_CLIENT_ID']),
      githubConfigured: Boolean(process.env['GITHUB_CLIENT_ID']),
    };

    const content = renderAdminConfig(configData);
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configuration - SystemPrompt OS</title>
        <style>${getAdminConfigStyles()}</style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;

    res.type('html').send(html);
  }

  /**
   * Renders the status page for non-admin users.
   * @param res - Express response object.
   * @param systemStatus - Current system status information.
   * @param systemStatus.cloudflareUrl
   * @param systemStatus.tunnelStatus
   * @returns Promise that resolves when response is sent.
   */
  private async renderStatusPage(
    res: Response,
    systemStatus: { cloudflareUrl: string; tunnelStatus: string },
  ): Promise<void> {
    const statusData: StatusPageData = systemStatus;
    const content = renderStatusPage(statusData);
    const html = renderLayout({
      title: 'System Status',
      content,
      styles: getStatusPageStyles(),
    });

    res.type('html').send(html);
  }
}

/**
 * Configures and registers configuration routes on the Express router.
 * @param router - Express router instance to mount routes on.
 */
export function setupRoutes(router: Router): void {
  const configEndpoint = new ConfigEndpoint();

  router.get('/config', async (req, res) => {
    await configEndpoint.handleConfigPage(req, res);
  });
}

/**
 * Sets up config routes without authentication (for initial setup).
 * @param router - Express router instance.
 */
export function setupPublicRoutes(router: Router): void {
  const configEndpoint = new ConfigEndpoint();

  router.get('/config', async (req, res) => {
    const db = await import('@/modules/core/database/index.js').then((m) => {
      return m.getDatabase();
    });
    const adminCount = await db
      .query<{ count: number }>(
        `SELECT COUNT(*) as count FROM auth_users u 
       JOIN auth_user_roles ur ON u.id = ur.user_id 
       JOIN auth_roles r ON ur.role_id = r.id 
       WHERE r.name = 'admin'`,
      )
      .then((result: { count: number }[]) => {
        return result[0]?.count || 0;
      });

    if (adminCount === 0) {
      configEndpoint.handleConfigPage(req, res);
    } else {
      res.redirect('/auth');
    }
  });
}
