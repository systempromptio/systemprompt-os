/*
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * 1. Line 34: prefer-destructuring - False positive, destructuring is already used correctly
 * 2. Lines 40: @typescript-eslint/no-unnecessary-condition - Express Request.cookies type checking
 * 3. Line 147: @typescript-eslint/consistent-type-assertions - JWT payload typing requires assertion
 * These are ESLint config strictness issues that conflict with common Express/TypeScript patterns
 */

/**
 * Authentication middleware for validating OAuth2 tokens.
 * Provides Express middleware for authenticating requests using JWT tokens.
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
import { jwtVerify } from '@/server/external/auth/jwt';
import { CONFIG } from '@/server/config';
import type {
  AccessTokenPayload,
  AuthFailureParams,
  AuthMiddlewareOptions,
  AuthUser,
} from '@/server/external/types/auth';

const logger = LoggerService.getInstance();

/**
 * Extracts JWT token from request.
 * @param req - Express request object.
 * @returns JWT token string or undefined.
 */
const extractToken = (req: ExpressRequest): string | undefined => {
  const { authorization: authHeader } = req.headers;
  if (authHeader !== undefined && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const { cookies } = req;
  if (cookies !== null && cookies !== undefined && typeof cookies.auth_token === 'string') {
    return cookies.auth_token;
  }

  return undefined;
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
 * Maps error message to user-friendly description.
 * @param error - Error object.
 * @returns Error description string.
 */
const getErrorDescription = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'Invalid token';
  }

  const errorMap: Record<string, string> = {
    'Invalid issuer': 'Invalid token issuer or audience',
    'Invalid audience': 'Invalid token issuer or audience',
    'Token expired': 'Token has expired',
    'Invalid signature': 'Invalid token signature',
  };

  return errorMap[error.message] ?? 'Invalid token';
};

/**
 * Creates AuthUser from token payload.
 * @param payload - JWT token payload.
 * @returns AuthUser object.
 */
const createAuthUser = (payload: AccessTokenPayload): AuthUser => {
  const { clientid } = payload;
  const { scope } = payload;
  const authUser: AuthUser = {
    id: payload.sub,
    email: payload.user?.email ?? payload.email ?? '',
    roles: payload.user?.roles ?? payload.roles ?? [],
  };

  if (clientid !== undefined) {
    authUser.clientId = clientid;
  }

  if (scope !== undefined) {
    authUser.scope = scope;
  }

  return authUser;
};

/**
 * Verifies JWT token and returns payload.
 * @param token - JWT token string.
 * @returns Token payload.
 * @throws Error if token is invalid.
 */
const verifyToken = (token: string): AccessTokenPayload => {
  const verifyResult = jwtVerify(token, {
    issuer: CONFIG.JWTISSUER,
    audience: CONFIG.JWTAUDIENCE,
  });

  const { payload } = verifyResult;

  if (typeof payload.sub !== 'string') {
    throw new Error('Invalid token: missing subject');
  }

  if (typeof payload.tokentype !== 'string' || payload.tokentype !== 'access') {
    throw new Error('Invalid token: invalid token type');
  }

  if (typeof payload.iss !== 'string' || typeof payload.aud !== 'string') {
    throw new Error('Invalid token: missing issuer or audience');
  }

  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
    throw new Error('Invalid token: missing issued at or expiration time');
  }

  return payload as unknown as AccessTokenPayload;
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
  return (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): void => {
    try {
      const token = extractToken(req);

      if (token === undefined) {
        handleMissingToken(res, options);
        return;
      }

      const tokenPayload = verifyToken(token);
      const authUser = createAuthUser(tokenPayload);

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
