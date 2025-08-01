// Auto-generated Zod schemas for webhooks module
// Generated on: 2025-08-01T13:49:54.163Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

// Webhook schema
export const WebhookSchema = z.object({});

// Type inference from schemas
export type Webhook = z.infer<typeof WebhookSchema>;
export type WebhookCreateData = z.infer<typeof WebhookCreateDataSchema>;
export type WebhookUpdateData = z.infer<typeof WebhookUpdateDataSchema>;

// Domain type aliases for easier imports
export type IWebhook = Webhook;
export type IWebhookCreateData = WebhookCreateData;
export type IWebhookUpdateData = WebhookUpdateData;
