// Auto-generated database types for events module
// Generated on: 2025-08-01T13:49:50.977Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

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

// Zod schemas for database row validation
export const EventsRowSchema = z.object({
  id: z.number(),
  event_name: z.string(),
  event_data: z.string().nullable(),
  emitted_at: z.string().datetime().nullable(),
  module_source: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

export const EventSubscriptionsRowSchema = z.object({
  id: z.number(),
  event_name: z.string(),
  subscriber_module: z.string(),
  handler_name: z.string().nullable(),
  subscribed_at: z.string().datetime().nullable(),
  active: z.boolean().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type EventsDatabaseRow = IEventsRow | IEventSubscriptionsRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const EventsDatabaseRowSchema = z.union([EventsRowSchema, EventSubscriptionsRowSchema]);

/**
 * Database table names for this module
 */
export const EVENTS_TABLES = {
  EVENTS: 'events',
  EVENT_SUBSCRIPTIONS: 'event_subscriptions',
} as const;
