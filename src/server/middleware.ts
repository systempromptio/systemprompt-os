/**
 * Express middleware for MCP server including rate limiting, protocol validation,
 * and request size limits. Provides security and validation layers for the MCP protocol.
 * @file Express middleware for MCP server including rate limiting, protocol validation,
 * and request size limits. Provides security and validation layers for the MCP protocol.
 * @module server/middleware
 */

import { LogSource, LoggerService } from '@/modules/core/logger/index.js';
import type { IExpressHandler } from '@/server/types/middleware.types.js';
import {
  DEFAULT_MAX_REQUESTS,
  HTTP_BAD_REQUEST,
  HTTP_PAYLOAD_TOO_LARGE,
  HTTP_TOO_MANY_REQUESTS,
  INCREMENT_VALUE,
  MCP_ERROR_CODE,
  MCP_INVALID_REQUEST,
  ONE_MINUTE_MS,
  ONE_SECOND_MS,
  RADIX_DECIMAL,
  REQUEST_COUNTS,
  TEN_MB_BYTES
} from '@/server/constants/middleware.constants.js';

/**
 * Get logger instance.
 * @returns Logger service instance.
 */
const getLogger = (): LoggerService => {
  return LoggerService.getInstance();
};

/**
 * Rate limiting middleware for MCP endpoints.
 * @param windowMs - Time window in milliseconds ( default: 60000ms = 1 minute).
 * @param maxRequests - Maximum requests allowed per window ( default: 100).
 * @returns Express middleware function.
 * @example
 * ```typescript
 * app.use('/mcp', rateLimitMiddleware(60000, 100));
 * ```
 */
export const rateLimitMiddleware = (
  windowMs: number = ONE_MINUTE_MS,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
): IExpressHandler => {
  return (req, res, next): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const logger = getLogger();

    let rateData = REQUEST_COUNTS.get(key);
    if (rateData === undefined || now > rateData.resetTime) {
      rateData = {
        count: 0,
        resetTime: now + windowMs,
      };
      REQUEST_COUNTS.set(key, rateData);
    }

    if (rateData.count >= maxRequests) {
      logger.warn(LogSource.SERVER, 'Rate limit exceeded', {
        ip: key,
        count: rateData.count,
      });
      res.status(HTTP_TOO_MANY_REQUESTS).json({
        jsonrpc: '2.0',
        error: {
          code: MCP_ERROR_CODE,
          message: 'Too many requests',
          information: {
            retryAfter: Math.ceil((rateData.resetTime - now) / ONE_SECOND_MS),
          },
        },
        id: null,
      });
      return;
    }

    rateData.count += INCREMENT_VALUE;
    next();
  };
};

/**
 * Validate MCP protocol version.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next function.
 */
export const validateProtocolVersion: IExpressHandler = (req, res, next): void => {
  const { headers } = req;
  const { 'mcp-protocol-version': versionHeader } = headers;
  const logger = getLogger();

  if (versionHeader === undefined) {
    next();
    return;
  }

  const supportedVersions = ['2025-06-18', '2025-03-26', '2024-11-05'];
  const version = String(versionHeader);

  if (!supportedVersions.includes(version)) {
    logger.warn(LogSource.SERVER, 'Unsupported protocol version', { version });
    res.status(HTTP_BAD_REQUEST).json({
      jsonrpc: '2.0',
      error: {
        code: MCP_INVALID_REQUEST,
        message: 'Unsupported protocol version',
        information: {
          supported: supportedVersions,
          requested: version,
        },
      },
      id: null,
    });
    return;
  }

  next();
};

/**
 * Request size limit middleware.
 * @param maxSize - Maximum request size in bytes ( default: 10MB).
 * @returns Express middleware function.
 * @example
 * ```typescript
 * app.use('/mcp', requestSizeLimit(10 * 1024 * 1024));
 * ```
 */
export const requestSizeLimit = (maxSize: number = TEN_MB_BYTES): IExpressHandler => {
  return (req, res, next): void => {
    const contentLengthHeader = req.headers['content-length'] ?? '0';
    const contentLength = parseInt(contentLengthHeader, RADIX_DECIMAL);
    const logger = getLogger();

    if (contentLength > maxSize) {
      logger.warn(LogSource.SERVER, 'Request too large', {
        size: contentLength,
        maxSize,
      });
      res.status(HTTP_PAYLOAD_TOO_LARGE).json({
        jsonrpc: '2.0',
        error: {
          code: MCP_ERROR_CODE,
          message: 'Request entity too large',
          information: {
            maxSize,
            received: contentLength,
          },
        },
        id: null,
      });
      return;
    }

    next();
  };
};

/**
 * Clean up old rate limit entries periodically.
 */
const cleanupInterval = setInterval((): void => {
  const now = Date.now();

  REQUEST_COUNTS.forEach((rateData, key): void => {
    if (now > rateData.resetTime) {
      REQUEST_COUNTS.delete(key);
    }
  });
}, ONE_MINUTE_MS);

/**
 * Cleanup function for testing.
 */
export const cleanup = (): void => {
  clearInterval(cleanupInterval);
  REQUEST_COUNTS.clear();
};
