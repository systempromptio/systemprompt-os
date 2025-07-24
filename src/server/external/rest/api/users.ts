/**
 * @file User API endpoints.
 * @module server/external/rest/api/users
 */

import type {
 Request, Response, Router
} from 'express';
import { getDatabase } from '@/modules/core/database/index.js';

/**
 * User API endpoints.
 */
export class UsersAPI {
  /**
   * Get count of users in the system
   * Used to determine if this is initial setup.
   * @param _req
   * @param res
   */
  public async getUserCount(_req: Request, res: Response): Promise<void> {
    try {
      const db = getDatabase();
      const result = await db.query<{ count: number }>('SELECT COUNT(*) as count FROM auth_users');

      res.json({ count: result[0]?.count || 0 });
    } catch {
      res.status(500).json({
        error: 'servererror',
        error_description: 'Failed to get user count',
      });
    }
  }
}

/**
 * Sets up user API routes.
 * @param router - Express router instance.
 */
export function setupRoutes(router: Router): void {
  const usersAPI = new UsersAPI();

  router.get('/api/users/count', async (req, res) => { await usersAPI.getUserCount(req, res); });
}
