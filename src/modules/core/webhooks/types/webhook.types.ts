/**
 * @fileoverview Type definitions for webhooks module
 * @module modules/core/webhooks/types
 */

/**
 * Webhook event types
 */
export type WebhookEvent = 
  | 'agent.started'
  | 'agent.stopped'
  | 'agent.failed'
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'task.scheduled'
  | 'task.executed'
  | 'task.failed'
  | 'api.key.created'
  | 'api.key.revoked'
  | 'api.limit.exceeded'
  | 'system.health.degraded'
  | 'system.health.restored'
  | 'custom';

/**
 * Webhook HTTP methods
 */
export type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Webhook status
 */
export type WebhookStatus = 'active' | 'inactive' | 'failed' | 'suspended';

/**
 * Webhook retry strategy
 */
export type RetryStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: WebhookMethod;
  events: WebhookEvent[];
  headers?: Record<string, string>;
  auth?: WebhookAuth;
  retry?: RetryConfig;
  timeout?: number;
  status: WebhookStatus;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Webhook authentication configuration
 */
export interface WebhookAuth {
  type: 'none' | 'basic' | 'bearer' | 'api-key' | 'hmac';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    api_key?: string;
    secret?: string;
    header_name?: string;
  };
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  enabled: boolean;
  max_attempts: number;
  strategy: RetryStrategy;
  initial_delay: number; // milliseconds
  max_delay?: number;    // milliseconds
  multiplier?: number;   // for exponential backoff
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  webhook_id: string;
  event: WebhookEvent;
  timestamp: Date;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Webhook delivery record
 */
export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: WebhookEvent;
  url: string;
  method: WebhookMethod;
  headers: Record<string, string>;
  payload: any;
  attempt: number;
  status_code?: number;
  response_body?: string;
  response_headers?: Record<string, string>;
  duration?: number; // milliseconds
  error?: string;
  delivered_at: Date;
  success: boolean;
}

/**
 * Webhook statistics
 */
export interface WebhookStats {
  webhook_id: string;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  average_duration: number;
  last_delivery?: Date;
  last_success?: Date;
  last_failure?: Date;
  failure_rate: number;
}

/**
 * Webhook filter options
 */
export interface WebhookFilter {
  status?: WebhookStatus;
  events?: WebhookEvent[];
  active?: boolean;
}

/**
 * Create webhook DTO
 */
export interface CreateWebhookDto {
  name: string;
  url: string;
  method?: WebhookMethod;
  events: WebhookEvent[];
  headers?: Record<string, string>;
  auth?: WebhookAuth;
  retry?: RetryConfig;
  timeout?: number;
  metadata?: Record<string, any>;
}

/**
 * Update webhook DTO
 */
export interface UpdateWebhookDto {
  name?: string;
  url?: string;
  method?: WebhookMethod;
  events?: WebhookEvent[];
  headers?: Record<string, string>;
  auth?: WebhookAuth;
  retry?: RetryConfig;
  timeout?: number;
  status?: WebhookStatus;
  metadata?: Record<string, any>;
}

/**
 * Webhook test result
 */
export interface WebhookTestResult {
  success: boolean;
  status_code?: number;
  response_body?: string;
  response_headers?: Record<string, string>;
  duration: number;
  error?: string;
}