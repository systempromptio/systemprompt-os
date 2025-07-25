/**
 * @file OAuth callback handler endpoint.
 * @module server/external/rest/callback
 */

import type {
 Request, Response, Router
} from 'express';
import { renderCallbackHandler } from '@/server/external/templates/auth/callback';

/**
 * OAuth callback handler endpoint.
 * Serves a client-side page that completes the OAuth flow by:
 * 1. Extracting the authorization code from URL parameters
 * 2. Exchanging it for tokens via the /oauth2/token endpoint
 * 3. Storing tokens and redirecting to the appropriate page.
 */
export class CallbackEndpoint {
  /**
   * Handles GET requests to the root callback page.
   * @param req - Express request object.
   * @param _req
   * @param res - Express response object.
   */
  public handleCallback(_req: Request, res: Response): void {
    const html = renderCallbackHandler();
    res.type('html').send(html);
  }
}

/**
 * Sets up the callback route.
 * @param router - Express router instance.
 */
export function setupRoutes(router: Router): void {
  const callbackEndpoint = new CallbackEndpoint();

  router.get('/', (req, res, next) => {
    if (req.query['code']) {
      callbackEndpoint.handleCallback(req, res);
    } else {
      next();
    }
  });
}
