/**
 * @fileoverview Authentication middleware for validating OAuth2 tokens
 * @module server/external/middleware/auth
 */

import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from '../auth/jwt.js';
import { CONFIG } from '../../config.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    client_id: string;
    scope: string;
  };
}

/**
 * Middleware to validate Bearer tokens
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized', error_description: 'Missing bearer token' });
    }
    
    const token = authHeader.substring(7);
    // Verify token
    const { payload } = await jwtVerify(token, CONFIG.JWT_SECRET);
    
    // Verify issuer and audience
    if (payload.iss !== CONFIG.JWT_ISSUER || payload.aud !== CONFIG.JWT_AUDIENCE) {
      return res.status(401).json({ error: 'unauthorized', error_description: 'Invalid token issuer or audience' });
    }
    
    // Check token type
    if (payload.token_type !== 'access') {
      return res.status(401).json({ error: 'unauthorized', error_description: 'Invalid token type' });
    }
    
    // Attach user info to request
    req.user = {
      sub: payload.sub as string,
      client_id: payload.client_id as string,
      scope: payload.scope as string,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'unauthorized', error_description: 'Invalid token' });
  }
}