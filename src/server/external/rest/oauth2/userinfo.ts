/**
 * @file OAuth2 UserInfo endpoint.
 * @module server/external/rest/oauth2/userinfo
 */

import type { Request, Response } from 'express';
import { OAuth2Error } from '@/server/external/rest/oauth2/errors';
import { AuthRepository } from '@/modules/core/auth/database/repository';

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
   * Returns information about the authenticated user.
   * @param req
   * @param res
   */
  getUserInfo = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      const error = OAuth2Error.unauthorizedClient('Unauthorized');
      res.status(error.code).json(error.toJSON());
      return;
    }

    const authRepo = AuthRepository.getInstance();
    const user = await authRepo.getIUserById(req.user.id);

    if (!user) {
      const error = OAuth2Error.invalidRequest('User not found');
      res.status(error.code).json(error.toJSON());
      return;
    }

    const userInfo: UserInfo = {
      sub: user.id,
      ...user.name && { name: user.name },
      ...user.email.split('@')[0] && { preferred_username: user.email.split('@')[0] },
      email: user.email,
      email_verified: true,
      agent_id: `agent-${user.id}`,
      agent_type: 'autonomous',
      ...user.avatarUrl && { picture: user.avatarUrl },
    };

    const scopes = req.user.scope?.split(' ') || [];
    const response: Partial<UserInfo> = { sub: userInfo.sub };

    if (scopes.includes('profile')) {
      if (userInfo.name) {
        response.name = userInfo.name;
      }
      if (userInfo.preferred_username) {
        response.preferred_username = userInfo.preferred_username;
      }
      if (userInfo.picture) {
        response.picture = userInfo.picture;
      }
    }

    if (scopes.includes('email')) {
      if (userInfo.email) {
        response.email = userInfo.email;
      }
      if (userInfo.email_verified !== undefined) {
        response.email_verified = userInfo.email_verified;
      }
    }

    if (scopes.includes('agent')) {
      if (userInfo.agent_id) {
        response.agent_id = userInfo.agent_id;
      }
      if (userInfo.agent_type) {
        response.agent_type = userInfo.agent_type;
      }
    }

    res.json(response);
  };
}
