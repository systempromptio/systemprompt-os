/**
 * @fileoverview Base event type definitions and utilities
 * @module types/events/base
 * @since 1.0.0
 */

import { EventEmitter } from 'events';

/**
 * Generic event listener function type
 * @since 1.0.0
 */
export type EventListenerFn = (...args: any[]) => void;

/**
 * Map of event names to their listener functions
 * @since 1.0.0
 */
export type EventMap = Record<string, EventListenerFn>;

/**
 * Type-safe event emitter implementation
 * @class
 * @extends {EventEmitter}
 * @template TEventMap - Map of event types
 * @since 1.0.0
 */
export class TypedEventEmitterImpl<_TEventMap extends EventMap = EventMap> extends EventEmitter {
  // Type-safe event emitter implementation
}

/**
 * Metadata attached to all domain events
 * @interface
 * @since 1.0.0
 */
export interface EventMetadata {
  /**
   * When the event occurred
   * @since 1.0.0
   */
  readonly timestamp: Date;
  
  /**
   * Source system or component that generated the event
   * @since 1.0.0
   */
  readonly source: string;
  
  /**
   * ID to correlate related events across services
   * @since 1.0.0
   */
  readonly correlationId?: string;
  
  /**
   * ID of the event that caused this event
   * @since 1.0.0
   */
  readonly causationId?: string;
  
  /**
   * ID of the user who triggered the event
   * @since 1.0.0
   */
  readonly userId?: string;
}

/**
 * Base structure for all domain events
 * @interface
 * @template T - Type of event data payload
 * @since 1.0.0
 */
export interface DomainEvent<T = unknown> {
  /**
   * Unique event identifier
   * @since 1.0.0
   */
  readonly id: string;
  
  /**
   * Event type/name for routing and handling
   * @since 1.0.0
   */
  readonly type: string;
  
  /**
   * Event-specific data payload
   * @since 1.0.0
   */
  readonly data: T;
  
  /**
   * Event metadata for tracking and correlation
   * @since 1.0.0
   */
  readonly metadata: EventMetadata;
}

/**
 * Interface for event handler implementations
 * @interface
 * @template T - Type of event data handled
 * @since 1.0.0
 */
export interface EventHandler<T = unknown> {
  /**
   * Handles a domain event
   * @param {DomainEvent<T>} event - Event to handle
   * @returns {Promise<void> | void} Optional promise for async handling
   * @since 1.0.0
   */
  handle(event: DomainEvent<T>): Promise<void> | void;
}

/**
 * Event bus for publishing and subscribing to domain events
 * @interface
 * @since 1.0.0
 */
export interface EventBus {
  /**
   * Publishes an event to all subscribers
   * @template T - Type of event data
   * @param {DomainEvent<T>} event - Event to publish
   * @returns {Promise<void>} Promise that resolves when published
   * @since 1.0.0
   */
  publish<T>(event: DomainEvent<T>): Promise<void>;
  
  /**
   * Subscribes to events of a specific type
   * @template T - Type of event data
   * @param {string} eventType - Type of events to subscribe to
   * @param {EventHandler<T>} handler - Handler for the events
   * @since 1.0.0
   */
  subscribe<T>(eventType: string, handler: EventHandler<T>): void;
  
  /**
   * Unsubscribes from events of a specific type
   * @template T - Type of event data
   * @param {string} eventType - Type of events to unsubscribe from
   * @param {EventHandler<T>} handler - Handler to remove
   * @since 1.0.0
   */
  unsubscribe<T>(eventType: string, handler: EventHandler<T>): void;
}

/**
 * Creates a new domain event with generated ID and metadata
 * @template T - Type of event data
 * @param {string} type - Event type/name
 * @param {T} data - Event data payload
 * @param {Partial<EventMetadata>} [metadata] - Optional metadata overrides
 * @returns {DomainEvent<T>} Created domain event
 * @since 1.0.0
 * @example
 * ```typescript
 * const event = createDomainEvent('user.created', { id: '123', name: 'John' });
 * ```
 */
export function createDomainEvent<T>(
  type: string,
  data: T,
  metadata?: Partial<EventMetadata>
): DomainEvent<T> {
  return {
    id: generateEventId(),
    type,
    data,
    metadata: {
      timestamp: new Date(),
      source: metadata?.source || 'system',
      correlationId: metadata?.correlationId,
      causationId: metadata?.causationId,
      userId: metadata?.userId
    }
  };
}

/**
 * Generates a unique event ID
 * @returns {string} Unique event identifier
 * @since 1.0.0
 * @private
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Type alias for typed event emitter
 * @template T - Event map type
 * @since 1.0.0
 */
export type TypedEventEmitter<T extends EventMap = EventMap> = TypedEventEmitterImpl<T>;