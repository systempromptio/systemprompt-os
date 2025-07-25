const logger = LoggerService.getInstance();/**
 * @fileoverview Express middleware for MCP server including rate limiting, protocol validation,
 * and request size limits. Provides security and validation layers for the MCP protocol.
 * @module server/middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';

const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware for MCP endpoints
 * @param windowMs - Time window in milliseconds ( default: 60000ms = 1 minute)
 * @param maxRequests - Maximum requests allowed per window ( default: 100)
 * @returns Express middleware function
 * @example
 * ```typescript
 * app.use('/mcp', rateLimitMiddleware(60000, 100));
 * ```
 */
export function rateLimitMiddleware(
  windowMs: number = 60000,
  maxRequests: number = 100,
) {
  return ( req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    let rateData = requestCounts.get( key);
    if (!rateData || now > rateData.resetTime) {
      rateData = { count: 0, resetTime: now + windowMs };
      requestCounts.set(key, rateData);
    }

    if (rateData.count >= maxRequests) {
      logger.warn('Rate limit exceeded', { ip: key, count: rateData.count });
      res.status(429).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Too many requests',
          data: { retryAfter: Math.ceil((rateData.resetTime - now) / 1000) },
        },
        id: null,
      });
      return;
    }

    rateData.count++;
    next();
  };
}

/**
 * Validate MCP protocol version
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function validateProtocolVersion( req: Request, res: Response, next: NextFunction): void {
  const version = req.headers['mcp-protocol-version'];

  if (!version) {
    next();
    return;
  }

  const supportedVersions = ['2025-06-18', '2025-03-26', '2024-11-05'];
  if (!supportedVersions.includes(version as string)) {
    logger.warn('Unsupported protocol version', { version });
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Unsupported protocol version',
        data: { supported: supportedVersions, requested: version },
      },
      id: null,
    });
    return;
  }

  next();
}

/**
 * Request size limit middleware
 * @param maxSize - Maximum request size in bytes ( default: 10MB)
 * @returns Express middleware function
 * @example
 * ```typescript
 * app.use('/mcp', requestSizeLimit(10 * 1024 * 1024));
 * ```
 */
export function requestSizeLimit( maxSize: number = 10 * 1024 * 1024) {
  return ( req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSize) {
      logger.warn('Request too large', { size: contentLength, maxSize });
      res.status(413).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Request entity too large',
          data: { maxSize, received: contentLength },
        },
        id: null,
      });
      return;
    }

    next();
  };
}

/**
 * Clean up old rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete( key);
    }
  }
}, 60000);