/**
 * @fileoverview OAuth2 UserInfo endpoint
 * @module server/external/rest/oauth2/userinfo
 */

import { Request, Response } from 'express';
import { OAuth2Error } from './errors.js';
import { getDatabase } from '@/modules/core/database/index.js';
import { AuthRepository } from '@/modules/core/auth/database/repository.js';

export interface UserInfo {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  agent_id?: string;
  agent_type?: string;
  picture?: string;
}

export class UserInfoEndpoint {
  /**
   * GET /oauth2/userinfo
   * Returns information about the authenticated user
   */
  getUserInfo = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      const error = OAuth2Error.unauthorizedClient('Unauthorized');
      res.status(error.code).json(error.toJSON());
      return;
    }
    
    // Fetch actual user data from database
    const db = getDatabase();
    const authRepo = new AuthRepository(db);
    const user = await authRepo.getUserById(req.user.id);
    
    if (!user) {
      const error = OAuth2Error.invalidRequest('User not found');
      res.status(error.code).json(error.toJSON());
      return;
    }
    
    // Build userInfo response
    const userInfo: UserInfo = {
      sub: user.id,
      name: user.name || undefined,
      preferred_username: user.email.split('@')[0],
      email: user.email,
      email_verified: true, // OAuth users are verified by provider
      agent_id: `agent-${user.id}`,
      agent_type: 'autonomous',
      picture: user.avatarUrl || undefined,
    };
    
    // Filter response based on requested scopes
    const scopes = req.user.scope?.split(' ') || [];
    const response: Partial<UserInfo> = { sub: userInfo.sub };
    
    if (scopes.includes('profile')) {
      response.name = userInfo.name;
      response.preferred_username = userInfo.preferred_username;
      response.picture = userInfo.picture;
    }
    
    if (scopes.includes('email')) {
      response.email = userInfo.email;
      response.email_verified = userInfo.email_verified;
    }
    
    // Custom scopes for systemprompt-os
    if (scopes.includes('agent')) {
      response.agent_id = userInfo.agent_id;
      response.agent_type = userInfo.agent_type;
    }
    
    res.json(response);
  };
}