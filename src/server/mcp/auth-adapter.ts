/**
 * @file MCP Authentication Adapter.
 * @module server/mcp/auth-adapter
 * Adapts the existing auth middleware to return MCP-compliant responses.
 */

import type {
 Request as ExpressRequest, Response as ExpressResponse, NextFunction
} from 'express';
import { authMiddleware } from '@/server/external/middleware/auth.js';
import { CONFIG } from '@/server/config.js';
import { tunnelStatus } from '@/modules/core/auth/tunnel-status.js';

/**
 * HTTP Status Codes.
 */
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;

/**
 * Wraps the existing auth middleware to return MCP-compliant error responses.
 * Following the MCP specification for OAuth2 authentication.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next function.
 */
export const mcpAuthAdapter = function (req: ExpressRequest, res: ExpressResponse, next: NextFunction): void {
  if (process.env['MCP_AUTH_DISABLED'] === 'true') {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let statusCode = HTTP_OK;

  res.status = function (code: number) {
    statusCode = code;
    return originalStatus(code);
  };

  res.json = function (body: unknown) {
    if (statusCode === HTTP_UNAUTHORIZED) {
      const baseUrl = tunnelStatus.getBaseUrlOrDefault(CONFIG.BASEURL);
      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="${baseUrl}/mcp", `
          + `as_uri="${baseUrl}/.well-known/oauth-protected-resource"`,
      );

      const authBody = body as { error_description?: string };
      const requestBody = req.body as { id?: unknown } | undefined;
      const mcpError = {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: authBody.error_description || 'Authentication required',
        },
        id: requestBody?.id || null,
      };
      return originalJson(mcpError);
    }
    return originalJson(body);
  };

  authMiddleware(req, res, next);
};
