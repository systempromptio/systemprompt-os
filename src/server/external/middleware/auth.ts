/**
 * @file Authentication middleware for validating OAuth2 tokens.
 * @module server/external/middleware/auth
 */

import type {
 NextFunction, Request, Response
} from 'express';
import { jwtVerify } from '@/server/external/auth/jwt.js';
import { CONFIG } from '@/server/config.js';
import type { AccessTokenPayload, AuthUser } from '@/server/external/types/auth.js';
import { LoggerService } from '@/modules/core/logger/index.js';

const logger = LoggerService.getInstance();

/**
 * Options for auth middleware.
 */
export interface AuthMiddlewareOptions {
    redirectToLogin?: boolean;
    requiredRoles?: string[];
}

/**
 * Creates authentication middleware with options.
 * @param options
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Extract token from Authorization header or cookie
      let token: string | undefined;

      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.cookies?.['auth_token']) {
        token = req.cookies['auth_token'];
      }

      if (!token) {
        if (options.redirectToLogin) {
          // For web requests, redirect to login
          res.redirect('/auth'); return;
        }
        res
          .status(401)
          .json({
 error: 'unauthorized',
error_description: 'Missing authentication token'
});
        return;
      }
      // Verify token with issuer and audience validation
      const { payload } = await jwtVerify(token, {
        issuer: CONFIG.JWTISSUER,
        audience: CONFIG.JWTAUDIENCE,
      });

      const tokenPayload = payload as AccessTokenPayload;

      // Check token type
      if (tokenPayload.tokentype !== 'access') {
        if (options.redirectToLogin) {
          res.redirect('/auth'); return;
        }
        res.status(401).json({
 error: 'unauthorized',
error_description: 'Invalid token type'
});
        return;
      }

      // Extract user data from strongly typed payload
      const authUser: AuthUser = {
        id: tokenPayload.sub,
        email: tokenPayload.user?.email || tokenPayload.email || '',
        roles: tokenPayload.user?.roles || tokenPayload.roles || [],
        ...tokenPayload.clientid !== undefined && { clientId: tokenPayload.clientid },
        ...tokenPayload.scope !== undefined && { scope: tokenPayload.scope },
      };

      // Check required roles if specified
      if (options.requiredRoles && options.requiredRoles.length > 0) {
        const hasRequiredRole = options.requiredRoles.some((role) => { return authUser.roles.includes(role) });
        if (!hasRequiredRole) {
          logger.warn('Access denied - missing required role', {
            userId: authUser.id,
            requiredRoles: options.requiredRoles,
            userRoles: authUser.roles,
          });
          res
            .status(403)
            .json({
 error: 'forbidden',
error_description: 'Insufficient permissions'
});
          return;
        }
      }

      // Attach user info to request
      req.user = {
        id: authUser.id,
        sub: authUser.id,
        email: authUser.email,
        roles: authUser.roles,
        ...authUser.clientId !== undefined && { clientid: authUser.clientId },
        ...authUser.scope !== undefined && { scope: authUser.scope },
      };

      next();
    } catch (error) {
      logger.error('Auth middleware error', { error });

      if (options.redirectToLogin) {
        // For web requests, redirect to login
        res.redirect('/auth'); return;
      }

      let errorDescription = 'Invalid token';

      if (error instanceof Error) {
        if (error.message === 'Invalid issuer' || error.message === 'Invalid audience') {
          errorDescription = 'Invalid token issuer or audience';
        } else if (error.message === 'Token expired') {
          errorDescription = 'Token has expired';
        } else if (error.message === 'Invalid signature') {
          errorDescription = 'Invalid token signature';
        }
      }

      res.status(401).json({
 error: 'unauthorized',
error_description: errorDescription
});
    }
  };
}

/**
 * Default auth middleware for API endpoints.
 */
export const authMiddleware = createAuthMiddleware();
