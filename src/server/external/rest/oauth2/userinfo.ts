/**
 * OAuth2 UserInfo endpoint implementation.
 * @file OAuth2 UserInfo endpoint.
 * @module server/external/rest/oauth2/userinfo
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { OAuth2Error } from '@/server/external/rest/oauth2/errors';
import { AuthRepository } from '@/modules/core/auth/database/repository';

/**
 * UserInfoEndpoint handles OAuth2 user information requests.
 */
export class UserInfoEndpoint {
  /**
   * GET /oauth2/userinfo
   * Returns information about the authenticated user.
   * @param req - Express request object with authenticated user.
   * @param res - Express response object.
   */
  getUserInfo = async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'No access token provided'
      });
      return;
    }

    if (req.user == null) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid or expired token'
      });
      return;
    }

    const authRepo = AuthRepository.getInstance();
    const user = await authRepo.getIUserById(req.user.id);

    if (user == null) {
      const error = OAuth2Error.invalidRequest('User not found');
      res.status(error.code).json(error.toJSON());
      return;
    }

    const emailUsername = user.email.split('@')[0];
    const userInfo = {
      sub: user.id,
      ...user.name != null && user.name !== '' && { name: user.name },
      ...emailUsername !== '' && { preferred_username: emailUsername },
      email: user.email,
      email_verified: true,
      agent_id: `agent-${user.id}`,
      agent_type: 'autonomous',
      ...user.avatarUrl != null && user.avatarUrl !== '' && { picture: user.avatarUrl },
    };

    const scopes = req.user.scope?.split(' ') ?? [];
    const response = { sub: userInfo.sub } as Record<string, unknown>;

    if (scopes.includes('profile')) {
      if (userInfo.name != null) {
        response.name = userInfo.name;
      }
      if (userInfo.preferred_username != null) {
        response.preferred_username = userInfo.preferred_username;
      }
      if (userInfo.picture != null) {
        response.picture = userInfo.picture;
      }
    }

    if (scopes.includes('email')) {
      response.email = userInfo.email;
      response.email_verified = userInfo.email_verified;
    }

    if (scopes.includes('agent')) {
      response.agent_id = userInfo.agent_id;
      response.agent_type = userInfo.agent_type;
    }

    res.json(response);
  };
}
