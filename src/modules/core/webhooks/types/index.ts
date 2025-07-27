/**
 * Webhooks module types.
 * @file Central export point for all webhook types.
 * @module modules/core/webhooks/types
 */

export type * from '@/modules/core/webhooks/types/webhook.types';

/**
 * Basic webhook service interface.
 */
export interface IWebhookService {
  initialize(): Promise<void>;
}

/**
 * Strongly typed exports interface for Webhooks module.
 */
export interface IWebhooksModuleExports {
  readonly service: () => IWebhookService;
}
