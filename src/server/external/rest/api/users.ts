/**
 * @fileoverview User API endpoints
 * @module server/external/rest/api/users
 */

import type { Request, Response, Router } from 'express';
import { getDatabase } from '@/modules/core/database/index.js';

/**
 * User API endpoints
 */
export class UsersAPI {
  /**
   * Get count of users in the system
   * Used to determine if this is initial setup
   */
  public async getUserCount(_req: Request, res: Response): Promise<void> {
    try {
      const db = getDatabase();
      const result = await db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM auth_users'
      );
      
      res.json({ count: result[0]?.count || 0 });
    } catch (error) {
      res.status(500).json({ 
        error: 'server_error',
        error_description: 'Failed to get user count' 
      });
    }
  }
}

/**
 * Sets up user API routes
 * 
 * @param router Express router instance
 */
export function setupRoutes(router: Router): void {
  const usersAPI = new UsersAPI();
  
  router.get('/api/users/count', (req, res) => usersAPI.getUserCount(req, res));
}