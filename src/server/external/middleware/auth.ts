/**
 * @fileoverview Authentication middleware for validating OAuth2 tokens
 * @module server/external/middleware/auth
 */

import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from '../auth/jwt.js';
import { CONFIG } from '../../config.js';

// Use Express.User type from global declaration

/**
 * Middleware to validate Bearer tokens
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized', error_description: 'Missing bearer token' });
      return;
    }
    
    const token = authHeader.substring(7);
    // Verify token with issuer and audience validation
    const { payload } = await jwtVerify(token, {
      issuer: CONFIG.JWTISSUER,
      audience: CONFIG.JWTAUDIENCE
    });
    
    // Check token type
    if (payload.tokentype !== 'access') {
      res.status(401).json({ error: 'unauthorized', error_description: 'Invalid token type' });
      return;
    }
    
    // Extract user data from token payload
    const userData = payload.user as any;
    
    // Attach user info to request
    req.user = {
      id: payload.sub as string,
      sub: payload.sub as string,
      email: userData?.email || payload.email as string || '',
      roles: userData?.roles || payload.roles as string[] || [],
      clientid: payload.clientid as string,
      scope: payload.scope as string,
    };
    
    next();
  } catch (error) {
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
    
    res.status(401).json({ error: 'unauthorized', error_description: errorDescription });
  }
}