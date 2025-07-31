/**
 * Authentication middleware for validating OAuth2 tokens.
 * Uses the ServerAuthAdapter to validate tokens through auth module services.
 * Supports both Bearer token authentication and cookie-based authentication.
 * @file Authentication middleware for validating OAuth2 tokens.
 * @module server/external/middleware/auth
 */

import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from 'express';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { ServerAuthAdapter } from '@/server/services/auth-adapter.service';
import type {
  AuthFailureParams,
  AuthMiddlewareOptions,
  AuthUser,
} from '@/server/external/types/auth';

const logger = LoggerService.getInstance();
const authAdapter = ServerAuthAdapter.getInstance();

/**
 * Extracts JWT token from request using auth adapter.
 * @param req - Express request object.
 * @returns JWT token string or undefined.
 */
const extractToken = (req: ExpressRequest): string | undefined => {
  const token = authAdapter.extractTokenFromRequest(req);
  return token || undefined;
};

/**
 * Handles authentication failure response.
 * @param params - Authentication failure parameters.
 */
const handleAuthFailure = (params: AuthFailureParams): void => {
  const {
 res, options, statusCode, error, errorDescription
} = params;

  if (options.redirectToLogin === true) {
    res.redirect('/auth');
    return;
  }

  res.status(statusCode).json({
    error,
    error_description: errorDescription,
  });
};

/**
 * Validates user roles against required roles.
 * @param authUser - Authenticated user object.
 * @param requiredRoles - Array of required roles.
 * @returns True if user has required role.
 */
const hasRequiredRole = (
  authUser: AuthUser,
  requiredRoles: string[]
): boolean => {
  return requiredRoles.some((role): boolean => { return authUser.roles.includes(role) });
};

/**
 * Creates AuthUser from token validation result.
 * @param userId - User ID from token.
 * @param scopes - Token scopes.
 * @returns AuthUser object.
 */
const createAuthUser = (userId: string, scopes?: string[]): AuthUser => {
  const authUser: AuthUser = {
    id: userId,
    email: '',
    roles: []
  };

  if (scopes && scopes.length > 0) {
    authUser.scope = scopes.join(' ');
  }

  return authUser;
};

/**
 * Checks if user has required roles.
 * @param authUser - Authenticated user.
 * @param options - Middleware options.
 * @returns True if user has required roles or no roles are required.
 */
const checkRequiredRoles = (
  authUser: AuthUser,
  options: AuthMiddlewareOptions
): boolean => {
  if (
    options.requiredRoles === undefined
    || options.requiredRoles.length === 0
  ) {
    return true;
  }

  return hasRequiredRole(authUser, options.requiredRoles);
};

/**
 * Handles successful authentication.
 * @param req - Express request object.
 * @param authUser - Authenticated user.
 * @param next - Next middleware function.
 */
const handleAuthSuccess = (
  req: ExpressRequest,
  authUser: AuthUser,
  next: NextFunction
): void => {
  const userInfo = {
    id: authUser.id,
    sub: authUser.id,
    email: authUser.email,
    roles: authUser.roles,
    ...authUser.clientId !== undefined && { clientid: authUser.clientId },
    ...authUser.scope !== undefined && { scope: authUser.scope },
  };

  Object.assign(req, { user: userInfo });

  next();
};

/**
 * Handles missing authentication token.
 * @param res - Express response object.
 * @param options - Auth middleware options.
 */
const handleMissingToken = (res: ExpressResponse, options: AuthMiddlewareOptions): void => {
  handleAuthFailure({
    res,
    options,
    statusCode: 401,
    error: 'unauthorized',
    errorDescription: 'Missing authentication token',
  });
};

/**
 * Handles insufficient permissions.
 * @param res - Express response object.
 * @param options - Auth middleware options.
 * @param authUser - Authenticated user.
 */
const handleInsufficientPermissions = (
  res: ExpressResponse,
  options: AuthMiddlewareOptions,
  authUser: AuthUser
): void => {
  logger.warn(LogSource.AUTH, 'Access denied - missing required role', {
    userId: authUser.id,
    requiredRoles: options.requiredRoles,
    userRoles: authUser.roles,
  });

  handleAuthFailure({
    res,
    options,
    statusCode: 403,
    error: 'forbidden',
    errorDescription: 'Insufficient permissions',
  });
};

/**
 * Handles authentication errors.
 * @param res - Express response object.
 * @param options - Auth middleware options.
 * @param error - The error that occurred.
 */
const handleAuthError = (
  res: ExpressResponse,
  options: AuthMiddlewareOptions,
  error: unknown
): void => {
  const errorForLogging = error instanceof Error ? error : String(error);
  logger.error(LogSource.AUTH, 'Auth middleware error', { error: errorForLogging });

  const errorDescription = getErrorDescription(error);

  handleAuthFailure({
    res,
    options,
    statusCode: 401,
    error: 'unauthorized',
    errorDescription,
  });
};

/**
 * Creates authentication middleware with options.
 * @param options - Configuration options for the authentication middleware.
 * @returns Express middleware function for authentication.
 */
export const createAuthMiddleware = (
  options: AuthMiddlewareOptions = {}
): ((
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction
) => void) => {
  return async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!authAdapter.initialized) {
        try {
          authAdapter.initialize();
        } catch (error) {
          logger.warn(LogSource.AUTH, 'Auth adapter initialization failed, treating as unauthenticated', { error });
          handleMissingToken(res, options);
          return;
        }
      }

      const token = extractToken(req);

      if (token === undefined) {
        handleMissingToken(res, options);
        return;
      }

      const httpResult = await authAdapter.validateTokenWithHttpResponse(token);

      if (!httpResult.success) {
        handleAuthFailure({
          res,
          options,
          statusCode: httpResult.statusCode,
          error: httpResult.error || 'unauthorized',
          errorDescription: httpResult.errorDescription || 'Invalid token',
        });
        return;
      }

      const authUser = createAuthUser(httpResult.user!, httpResult.scopes);

      if (!checkRequiredRoles(authUser, options)) {
        handleInsufficientPermissions(res, options, authUser);
        return;
      }

      handleAuthSuccess(req, authUser, next);
    } catch (error) {
      handleAuthError(res, options, error);
    }
  };
};

/**
 * Default auth middleware for API endpoints.
 */
export const authMiddleware = createAuthMiddleware();
