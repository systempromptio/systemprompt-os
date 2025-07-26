/**
 * Authentication configuration for webhooks.
 */
export interface WebhookAuth {
  type: 'bearer' | 'basic' | 'api_key';
  credentials: {
    token?: string;
    username?: string;
    password?: string;
    api_key?: string;
  };
}

/**
 * Retry configuration for webhook deliveries.
 */
export interface WebhookRetry {
  enabled: boolean;
  max_attempts?: number;
  strategy?: 'linear' | 'exponential';
  initial_delay?: number;
  multiplier?: number;
  max_delay?: number;
}

/**
 * Webhook configuration.
 */
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  events: string[];
  headers?: Record<string, string>;
  status: 'active' | 'inactive' | 'paused';
  timeout?: number;
  auth?: WebhookAuth;
  retry?: WebhookRetry;
  created_at: Date;
  updated_at: Date;
}

/**
 * Webhook payload structure.
 */
export interface WebhookPayload {
  webhook_id: string;
  event: string;
  timestamp: Date;
  data: Record<string, any>;
}

/**
 * Webhook delivery result.
 */
export interface WebhookDeliveryResult {
  success: boolean;
  status_code?: number;
  response_body?: string;
  error?: string;
  duration: number;
  attempt?: number;
}

/**
 * Webhook delivery record for persistence.
 */
export interface WebhookDeliveryRecord {
  id?: string;
  webhook_id: string;
  payload_id?: string;
  attempt: number;
  success: boolean;
  status_code?: number;
  response_body?: string;
  error?: string;
  duration: number;
  delivered_at: Date;
}

/**
 * Webhook delivery options.
 */
export interface WebhookDeliveryOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Main webhook interface used by the service.
 */
export interface Webhook {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  events: string[];
  headers?: Record<string, string>;
  status: 'active' | 'inactive' | 'paused';
  timeout?: number;
  auth?: WebhookAuth;
  retry?: WebhookRetry;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create webhook DTO.
 */
export interface CreateWebhookDto {
  name: string;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  events: string[];
  headers?: Record<string, string>;
  status?: 'active' | 'inactive' | 'paused';
  timeout?: number;
  auth?: WebhookAuth;
  retry?: WebhookRetry;
}

/**
 * Update webhook DTO.
 */
export interface UpdateWebhookDto {
  name?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  events?: string[];
  headers?: Record<string, string>;
  status?: 'active' | 'inactive' | 'paused';
  timeout?: number;
  auth?: WebhookAuth;
  retry?: WebhookRetry;
}

/**
 * Webhook delivery entity for persistence.
 */
export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  payload_id?: string;
  attempt: number;
  success: boolean;
  status_code?: number;
  response_body?: string;
  error?: string;
  duration: number;
  delivered_at: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Webhook event types.
 */
export type WebhookEvent = string;

/**
 * Webhook event payload structure.
 */
export interface WebhookEventPayload {
  webhook_id: string;
  event: WebhookEvent;
  data: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Webhook statistics.
 */
export interface WebhookStats {
  total_webhooks: number;
  active_webhooks: number;
  inactive_webhooks: number;
  paused_webhooks: number;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  average_response_time: number;
}
