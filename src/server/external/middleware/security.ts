/**
 * Security headers middleware.
 * @description Adds security headers to all responses.
 * @module server/external/middleware/security
 */

import type {
 Request as ExpressRequest, Response as ExpressResponse, NextFunction
} from 'express';

/**
 * Security headers middleware.
 * Adds common security headers to protect against various attacks.
 * @param _req - Express request object.
 * @param res - Express response object.
 * @param next - Express next function.
 * @returns Void.
 */
export const securityHeaders = (_req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
  res.setHeader('X-Frame-Options', 'DENY');

  res.setHeader('X-Content-Type-Options', 'nosniff');

  res.setHeader('X-XSS-Protection', '1; mode=block');

  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';"
  );

  next();
};
