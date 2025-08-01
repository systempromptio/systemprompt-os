// Auto-generated Zod schemas for events module
// Generated on: 2025-08-01T09:36:21.889Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { EventsRowSchema } from './database.generated';

// Event schema - directly use database row schema
export const EventSchema = EventsRowSchema;

export const EventCreateDataSchema = z.object({
  event_name: z.string(),
  event_data: z.string().nullable(),
  emitted_at: z.string().nullable(),
  module_source: z.string().nullable(),
});

export const EventUpdateDataSchema = z.object({
  event_name: z.string().optional(),
  event_data: z.string().nullable().optional(),
  emitted_at: z.string().nullable().optional(),
  module_source: z.string().nullable().optional(),
});

// Type inference from schemas
export type Event = z.infer<typeof EventSchema>;
export type EventCreateData = z.infer<typeof EventCreateDataSchema>;
export type EventUpdateData = z.infer<typeof EventUpdateDataSchema>;

// Domain type aliases for easier imports
export type IEvent = Event;
export type IEventCreateData = EventCreateData;
export type IEventUpdateData = EventUpdateData;
