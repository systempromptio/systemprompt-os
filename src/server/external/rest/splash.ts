/**
 * @file Splash page endpoint for SystemPrompt OS.
 * @module server/external/rest/splash
 */

import type {
 Request, Response, Router
} from 'express';
import { renderSplashPage } from '@/server/external/templates/splash';

/**
 * Splash page endpoint handler providing the main welcome screen.
 */
export class SplashEndpoint {
  /**
   * Handles GET requests to the splash/home page.
   * @param req - Express request object.
   * @param _req
   * @param res - Express response object.
   * @returns Promise that resolves when response is sent.
   */
  public async handleSplashPage(_req: Request, res: Response): Promise<void> {
    const html = renderSplashPage();
    res.type('html').send(html);
  }
}

/**
 * Configures splash page routes on the Express router.
 * @param router - Express router instance to mount routes on.
 */
export function setupRoutes(router: Router): void {
  const splashEndpoint = new SplashEndpoint();

  router.get('/', (req, res, next) => {
    if (req.query['code']) {
      next(); return;
    }
    splashEndpoint.handleSplashPage(req, res);
  });
}
