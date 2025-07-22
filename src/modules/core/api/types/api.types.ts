/**
 * @fileoverview Type definitions for the API module
 * @module modules/core/api/types
 */

export interface ApiKey {
  id: string;
  key_hash: string;
  key_prefix: string;
  user_id: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  expires_at?: Date;
  last_used_at?: Date;
  created_at: Date;
  revoked_at?: Date;
  revoked_reason?: string;
  metadata?: Record<string, any>;
}

export interface CreateApiKeyDto {
  user_id: string;
  name: string;
  scopes?: string[];
  rate_limit?: number;
  expires_in?: number; // milliseconds
  metadata?: Record<string, any>;
}

export interface ApiKeyInfo {
  id: string;
  key?: string; // Only returned on creation
  key_prefix: string;
  user_id: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  expires_at?: Date;
  last_used_at?: Date;
  created_at: Date;
  is_active: boolean;
  usage?: ApiKeyUsage;
}

export interface ApiKeyUsage {
  key_id: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  last_request_at?: Date;
  period_start: Date;
  period_end: Date;
}

export interface RateLimitStatus {
  key: string;
  limit: number;
  remaining: number;
  reset_at: Date;
  window_start: Date;
  window_size: number;
}

export interface RateLimitCheck {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: Date;
  retry_after?: number; // seconds
}

export interface ApiRequest {
  key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time: number;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

export interface ApiKeyValidation {
  valid: boolean;
  key_id?: string;
  user_id?: string;
  scopes?: string[];
  rate_limit?: number;
  error?: string;
}

export interface UsageStats {
  period: string;
  total_requests: number;
  unique_keys: number;
  average_response_time: number;
  error_rate: number;
  top_endpoints: EndpointStats[];
  hourly_breakdown?: HourlyStats[];
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  request_count: number;
  average_response_time: number;
  error_rate: number;
}

export interface HourlyStats {
  hour: string;
  requests: number;
  errors: number;
  average_response_time: number;
}