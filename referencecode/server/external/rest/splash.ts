/**
 * @fileoverview Splash page endpoint for SystemPrompt OS
 * @module server/external/rest/splash
 */

import type { Request, Response, Router } from 'express';
import { renderSplashPage } from '../templates/splash.js';

/**
 * Splash page endpoint handler providing the main welcome screen
 */
export class SplashEndpoint {
  /**
   * Handles GET requests to the splash/home page
   * 
   * @param req Express request object
   * @param res Express response object
   * @returns Promise that resolves when response is sent
   */
  public async handleSplashPage(_req: Request, res: Response): Promise<void> {
    const html = renderSplashPage();
    res.type('html').send(html);
  }
}

/**
 * Configures splash page routes on the Express router
 * 
 * @param router Express router instance to mount routes on
 */
export function setupRoutes(router: Router): void {
  const splashEndpoint = new SplashEndpoint();
  
  router.get('/', (req, res, next) => {
    // Skip if there's an OAuth callback code
    if (req.query['code']) {
      return next();
    }
    splashEndpoint.handleSplashPage(req, res);
  });
}