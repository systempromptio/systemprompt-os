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
    try {
      console.log('Rendering splash page...');
      const html = renderSplashPage();
      console.log('HTML generated, length:', html.length);
      res.type('html').send(html);
    } catch (error) {
      console.error('Error in handleSplashPage:', error);
      throw error;
    }
  }
}

/**
 * Configures splash page routes on the Express router.
 * @param router - Express router instance to mount routes on.
 */
export function setupRoutes(router: Router): void {
  const splashEndpoint = new SplashEndpoint();

  router.get('/', async (req, res, next) => {
    console.log('GET / route hit, query:', req.query);
    try {
      if (req.query.code) {
        console.log('Has code query param, passing to next handler');
        next(); return;
      }
      console.log('Calling handleSplashPage...');
      await splashEndpoint.handleSplashPage(req, res);
    } catch (error) {
      console.error('Error in splash route:', error);
      next(error);
    }
  });
}
