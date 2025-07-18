/**
 * @fileoverview MCP Authentication Adapter
 * @module server/mcp/auth-adapter
 * 
 * Adapts the existing auth middleware to return MCP-compliant responses
 */

import { Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../external/middleware/auth.js';
import { CONFIG } from '../config.js';

/**
 * Wraps the existing auth middleware to return MCP-compliant error responses
 * Following the MCP specification for OAuth2 authentication
 */
export function mcpAuthAdapter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Allow disabling auth for development
  if (process.env.MCP_AUTH_DISABLED === 'true') {
    return next();
  }

  // Create a custom response handler to intercept auth errors
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let statusCode = 200;

  // Override status to capture the status code
  res.status = function(code: number) {
    statusCode = code;
    return originalStatus(code);
  };

  // Override json to transform auth errors to MCP format
  res.json = function(body: any) {
    if (statusCode === 401) {
      // Transform to MCP-compliant error response
      const mcpError = {
        jsonrpc: '2.0',
        error: {
          code: -32001, // Authentication required
          message: body.error_description || 'Authentication required',
          data: {
            // Include OAuth2 configuration for client
            oauth2: {
              authorization_uri: `${CONFIG.BASEURL}/oauth2/authorize`,
              token_uri: `${CONFIG.BASEURL}/oauth2/token`,
              scopes_supported: ['openid', 'email', 'profile'],
              response_types_supported: ['code'],
              grant_types_supported: ['authorization_code', 'refresh_token'],
              code_challenge_methods_supported: ['S256', 'plain']
            }
          }
        },
        id: req.body?.id || null
      };
      return originalJson(mcpError);
    }
    // Not an auth error, return as-is
    return originalJson(body);
  };

  // Call the existing auth middleware
  authMiddleware(req as AuthenticatedRequest, res, next);
}