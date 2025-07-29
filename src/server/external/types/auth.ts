/**
 * Authenticated user information extracted from JWT.
 */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  clientId?: string;
  scope?: string;
}

/**
 * JWT payload structure for access tokens.
 */
export interface AccessTokenPayload {
  sub: string;
  email?: string;
  clientid?: string;
  scope?: string;
  tokentype: 'access';
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
    roles?: string[];
  };
  roles?: string[];
}

/**
 * Cookie options for auth tokens.
 */
export interface AuthCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path?: string;
}

/**
 * Options for auth middleware configuration.
 */
export interface AuthMiddlewareOptions {
  redirectToLogin?: boolean;
  requiredRoles?: string[];
}

/**
 * Parameters for handling authentication failures.
 */
export interface AuthFailureParams {
  res: import('express').Response;
  options: AuthMiddlewareOptions;
  statusCode: number;
  error: string;
  errorDescription: string;
}
