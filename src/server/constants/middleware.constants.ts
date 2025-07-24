/**
 * Middleware constants.
 */

export const DEFAULT_MAX_REQUESTS = 100;
export const HTTP_BAD_REQUEST = 400;
export const HTTP_PAYLOAD_TOO_LARGE = 413;
export const HTTP_TOO_MANY_REQUESTS = 429;
export const INCREMENT_VALUE = 1;
export const MCP_ERROR_CODE = -32602;
export const MCP_INVALID_REQUEST = 'Invalid request';
export const ONE_MINUTE_MS = 60000;
export const ONE_SECOND_MS = 1000;
export const RADIX_DECIMAL = 10;
export const TEN_MB_BYTES = 10 * 1024 * 1024;

// Rate limiting storage
interface RateData {
  count: number;
  resetTime: number;
}

export const REQUEST_COUNTS = new Map<string, RateData>();
