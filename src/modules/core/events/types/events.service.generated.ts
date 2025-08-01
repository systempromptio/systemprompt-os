// Auto-generated service schemas for events module
// Generated on: 2025-08-01T10:21:29.000Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';
import { ModulesType } from '@/modules/core/modules/types/manual';

// Zod schema for EventBusService
export const EventBusServiceSchema = z.object({
  emit: z.function()
    .args(z.string(), z.unknown())
    .returns(z.void()),
  on: z.function()
    .args(z.string(), z.function().args(z.unknown()).returns(z.union([z.void(), z.promise(z.void())])))
    .returns(z.function().returns(z.void())),
  off: z.function()
    .args(z.string(), z.function())
    .returns(z.void()),
  once: z.function()
    .args(z.string(), z.function().args(z.unknown()).returns(z.union([z.void(), z.promise(z.void())])))
    .returns(z.void()),
  removeAllListeners: z.function()
    .args(z.string().optional())
    .returns(z.void()),
  listenerCount: z.function()
    .args(z.string())
    .returns(z.number()),
});

// Zod schema for IEventsModuleExports  
export const EventsModuleExportsSchema = z.object({
  eventBus: EventBusServiceSchema,
  EventNames: z.any(),
});

// Zod schema for complete module
export const EventsModuleSchema = createModuleSchema(EventsModuleExportsSchema).extend({
  name: z.literal('events'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});

// TypeScript interfaces inferred from schemas
export type IEventBusService = z.infer<typeof EventBusServiceSchema>;
export type IEventsModuleExports = z.infer<typeof EventsModuleExportsSchema>;