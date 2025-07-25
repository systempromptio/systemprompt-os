/**
 * @file API types and interfaces.
 * @module src/modules/core/api/types
 */

export interface ApiKey {
  id: string;
  key_hash: string;
  key_prefix: string;
  user_id: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  expires_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
  revoked_at: Date | null;
  revoked_reason: string | null;
  metadata: Record<string, any>;
}

export interface CreateApiKeyDto {
  user_id: string;
  name: string;
  scopes?: string[];
  rate_limit?: number;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  key_id?: string;
  user_id?: string;
  scopes?: string[];
  error?: string;
}

export interface RateLimitStatus {
  key_id: string;
  window_start: Date;
  request_count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retry_after?: Date;
}

export interface RateLimitStatusResponse {
  key: string;
  limit: number;
  remaining: number;
  window_size: number;
  reset_at: Date;
}

export interface ApiKeyUsage {
  total_requests: number;
  error_rate: number;
  average_response_time: number;
  top_endpoints: EndpointUsage[];
}

export interface EndpointUsage {
  endpoint: string;
  method: string;
  request_count: number;
  average_response_time: number;
  error_rate: number;
}

export interface CreateApiKeyResult {
  id: string;
  key: string;
  key_prefix: string;
  user_id: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  expires_at: Date | null;
  created_at: Date;
  metadata: Record<string, any>;
}
