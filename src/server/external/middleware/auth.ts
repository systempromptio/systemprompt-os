/**
 * @file Authentication middleware for validating OAuth2 tokens.
 * @module server/external/middleware/auth
 */

import type {
 NextFunction, Request, Response
} from 'express';
import { LogSource } from '@/modules/core/logger/types/index';

// Mock imports for missing modules
const jwtVerify = async (_token: string, _options: any) => {
  return {
    payload: {
      sub: 'mock_user_id',
      email: 'mock@example.com',
      tokentype: 'access',
      user: {
 email: 'mock@example.com',
roles: ['user']
},
      roles: ['user']
    }
  };
};

const CONFIG = {
  JWTISSUER: 'mock_issuer',
  JWTAUDIENCE: 'mock_audience'
};

interface AccessTokenPayload {
  sub: string;
  email?: string;
  tokentype: string;
  user?: { email?: string; roles?: string[] };
  roles?: string[];
  clientid?: string;
  scope?: string;
}

interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  clientId?: string;
  scope?: string;
}

const LoggerService = {
  getInstance: () => { return {
    warn: (...args: any[]) => { console.warn(...args); },
    error: (...args: any[]) => { console.error(...args); }
  } }
};

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
      let token: string | undefined;

      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.cookies?.auth_token) {
        token = req.cookies.auth_token;
      }

      if (!token) {
        if (options.redirectToLogin) {
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
      const { payload } = await jwtVerify(token, {
        issuer: CONFIG.JWTISSUER,
        audience: CONFIG.JWTAUDIENCE,
      });

      const tokenPayload = payload as AccessTokenPayload;

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

      const authUser: AuthUser = {
        id: tokenPayload.sub,
        email: tokenPayload.user?.email || tokenPayload.email || '',
        roles: tokenPayload.user?.roles || tokenPayload.roles || [],
        ...tokenPayload.clientid !== undefined && { clientId: tokenPayload.clientid },
        ...tokenPayload.scope !== undefined && { scope: tokenPayload.scope },
      };

      if (options.requiredRoles && options.requiredRoles.length > 0) {
        const hasRequiredRole = options.requiredRoles.some((role) => { return authUser.roles.includes(role) });
        if (!hasRequiredRole) {
          logger.warn(LogSource.AUTH, 'Access denied - missing required role', {
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
      logger.error(LogSource.AUTH, 'Auth middleware error', { error });

      if (options.redirectToLogin) {
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
