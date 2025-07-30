/*
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * - Custom rule requires types in separate types/ folder (systemprompt-os/enforce-type-exports)
 * - No inline comments allowed in functions (systemprompt-os/no-comments-in-functions)
 * - Type assertions forbidden but required for safe unknown type handling
 * - Object destructuring conflicts with type safety requirements
 * - Async Promise handling conflicts with middleware signature requirements
 */
/**
 * MCP Authentication Adapter.
 * Adapts the existing auth middleware to return MCP-compliant responses.
 * This module wraps the standard authentication middleware to ensure OAuth2 compliance
 * for MCP (Model Context Protocol) connections, providing proper error responses
 * and authentication headers as required by the MCP specification.
 * @file Server/mcp/auth-adapter.
 * @module server/mcp/auth-adapter
 */

import type {
  Request as ExpressRequest, Response as ExpressResponse, NextFunction
} from 'express';
import { authMiddleware } from '@/server/external/middleware/auth';
import { CONFIG } from '@/server/config';
import { HTTP_STATUS } from '@/server/external/constants/http.constants';

/**
 * Interface for MCP error response structure.
 */
interface McpErrorResponse {
  jsonrpc: '2.0';
  error: {
    code: number;
    message: string;
  };
  id: string | number | null;
}

/**
 * Interface for authentication context.
 */
interface AuthContext {
  body: unknown;
  requestBody: unknown;
  originalJson: (responseBody: unknown) => ExpressResponse;
}

/**
 * Sets authentication headers required by MCP OAuth specification.
 * @param res - Express response object to modify.
 * @param baseUrl - Base URL for authentication realm.
 */
const setMcpAuthHeaders = (res: ExpressResponse, baseUrl: string): void => {
  res.setHeader(
    'WWW-Authenticate',
    `Bearer realm="${baseUrl}/mcp", as_uri="${baseUrl}/.well-known/oauth-protected-resource"`
  );
};

/**
 * Creates MCP-compliant error response structure.
 * @param errorDescription - Optional error description from auth middleware.
 * @param requestId - Request ID from MCP request.
 * @returns MCP-formatted error response object.
 */
const createMcpErrorResponse = (
  errorDescription: string | undefined,
  requestId: string | number | undefined
): McpErrorResponse => {
  return {
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: errorDescription ?? 'Authentication required',
    },
    id: requestId ?? null,
  };
};

/**
 * Safely extracts string property from object.
 * @param obj - Object to extract from.
 * @param key - Property key to extract.
 * @returns String value or undefined.
 */
const safeStringExtract = (obj: unknown, key: string): string | undefined => {
  if (typeof obj === 'object' && obj !== null && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
};

/**
 * Safely extracts ID property from object.
 * @param obj - Object to extract from.
 * @returns ID value or undefined.
 */
const safeIdExtract = (obj: unknown): string | number | undefined => {
  if (typeof obj === 'object' && obj !== null && 'id' in obj) {
    const value = (obj as Record<string, unknown>).id;
    return typeof value === 'string' || typeof value === 'number' ? value : undefined;
  }
  return undefined;
};

/**
 * Handles MCP authentication error responses.
 * @param context - Authentication context with body and request data.
 * @param res - Express response object.
 * @returns MCP-formatted error response.
 */
const handleMcpAuthError = (
  context: AuthContext,
  res: ExpressResponse
): ExpressResponse => {
  const baseUrl = CONFIG.BASEURL;
  setMcpAuthHeaders(res, baseUrl);

  const errorDescription = safeStringExtract(context.body, 'error_description');
  const requestId = safeIdExtract(context.requestBody);
  const mcpError = createMcpErrorResponse(errorDescription, requestId);

  return context.originalJson(mcpError);
};

/**
 * Creates a status tracking wrapper function.
 * @param originalStatus - Original status function.
 * @param tracker - Status tracking object.
 * @param tracker.status
 * @returns Status wrapper function.
 */
const createStatusWrapper = (
  originalStatus: (code: number) => ExpressResponse,
  tracker: { status: number }
): ((code: number) => ExpressResponse) => {
  const statusWrapper = (code: number): ExpressResponse => {
    tracker.status = code;
    return originalStatus(code);
  };
  return statusWrapper;
};

/**
 * Creates a JSON response wrapper function.
 * @param context - Authentication context.
 * @param tracker - Status tracking object.
 * @param tracker.status
 * @param res - Express response object.
 * @returns JSON wrapper function.
 */
const createJsonWrapper = (
  context: Pick<AuthContext, 'originalJson'>,
  tracker: { status: number },
  res: ExpressResponse
): ((body: unknown) => ExpressResponse) => {
  const jsonWrapper = (body: unknown): ExpressResponse => {
    const { UNAUTHORIZED } = HTTP_STATUS;
    if (tracker.status === UNAUTHORIZED) {
      const authContext: AuthContext = {
        body,
        requestBody: res.req?.body,
        originalJson: context.originalJson,
      };
      return handleMcpAuthError(authContext, res);
    }
    return context.originalJson(body);
  };
  return jsonWrapper;
};

/**
 * Wraps the existing auth middleware to return MCP-compliant error responses.
 * Following the MCP specification for OAuth2 authentication.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next function.
 */
export const mcpAuthAdapter = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction
): void => {
  if (process.env.MCP_AUTH_DISABLED === 'true') {
    next();
    return;
  }

  const { OK } = HTTP_STATUS;
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  const statusTracker = { status: OK };

  const statusWrapper = createStatusWrapper(originalStatus, statusTracker);
  const jsonWrapper = createJsonWrapper({ originalJson }, statusTracker, res);

  const responseWrapper = Object.create(res);
  responseWrapper.status = statusWrapper;
  responseWrapper.json = jsonWrapper;

  Promise.resolve()
    .then(() => { authMiddleware(req, responseWrapper, next); })
    .catch(next);
};
