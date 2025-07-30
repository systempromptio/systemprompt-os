// Auto-generated database types for events module
// Generated on: 2025-07-30T22:16:41.628Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: events
 * Do not modify this file manually - it will be overwritten
 */
export interface IEventsRow {
  id: number;
  event_name: string;
  event_data: string | null;
  emitted_at: string | null;
  module_source: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Generated from database table: event_subscriptions
 * Do not modify this file manually - it will be overwritten
 */
export interface IEventSubscriptionsRow {
  id: number;
  event_name: string;
  subscriber_module: string;
  handler_name: string | null;
  subscribed_at: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type EventsDatabaseRow = IEventsRow | IEventSubscriptionsRow;

/**
 * Database table names for this module
 */
export const EVENTS_TABLES = {
  EVENTS: 'events',
  EVENTSUBSCRIPTIONS: 'event_subscriptions',
} as const;
