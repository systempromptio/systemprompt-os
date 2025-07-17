/**
 * @fileoverview OAuth2 UserInfo endpoint
 * @module server/external/rest/oauth2/userinfo
 */

import { Request, Response } from 'express';

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

// Extended request type to include user from auth middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    client_id: string;
    scope: string;
  };
}

export class UserInfoEndpoint {
  /**
   * GET /oauth2/userinfo
   * Returns information about the authenticated user
   */
  getUserInfo = async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    
    // TODO: Fetch actual user data from database
    // For now, return mock data based on the authenticated user
    const userInfo: UserInfo = {
      sub: req.user.sub,
      name: `User ${req.user.sub}`,
      preferred_username: `user_${req.user.sub}`,
      email: `${req.user.sub}@systemprompt.local`,
      email_verified: true,
      agent_id: `agent-${req.user.sub}`,
      agent_type: 'autonomous',
    };
    
    // Filter response based on requested scopes
    const scopes = req.user.scope.split(' ');
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