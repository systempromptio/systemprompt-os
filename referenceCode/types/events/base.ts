/**
 * @fileoverview Base event type definitions and utilities
 * @module types/events/base
 */

import { EventEmitter } from 'events';

/**
 * Generic event listener function type
 */
export type EventListenerFn = (...args: any[]) => void;

/**
 * Map of event names to their listener functions
 */
export type EventMap = Record<string, EventListenerFn>;

/**
 * Type-safe event emitter implementation
 * @class
 * @extends {EventEmitter}
 * @template TEventMap - Map of event types
 */
export class TypedEventEmitterImpl<_TEventMap extends EventMap = EventMap> extends EventEmitter {
  // Type-safe event emitter implementation
}

/**
 * Metadata attached to all domain events
 * @interface
 */
export interface EventMetadata {
  /**
   * When the event occurred
   */
  readonly timestamp: Date;
  
  /**
   * Source system or component that generated the event
   */
  readonly source: string;
  
  /**
   * ID to correlate related events across services
   */
  readonly correlationId?: string;
  
  /**
   * ID of the event that caused this event
   */
  readonly causationId?: string;
  
  /**
   * ID of the user who triggered the event
   */
  readonly userId?: string;
}

/**
 * Base structure for all domain events
 * @interface
 * @template T - Type of event data payload
 */
export interface DomainEvent<T = unknown> {
  /**
   * Unique event identifier
   */
  readonly id: string;
  
  /**
   * Event type/name for routing and handling
   */
  readonly type: string;
  
  /**
   * Event-specific data payload
   */
  readonly data: T;
  
  /**
   * Event metadata for tracking and correlation
   */
  readonly metadata: EventMetadata;
}

/**
 * Interface for event handler implementations
 * @interface
 * @template T - Type of event data handled
 */
export interface EventHandler<T = unknown> {
  /**
   * Handles a domain event
   * @param {DomainEvent<T>} event - Event to handle
   * @returns {Promise<void> | void} Optional promise for async handling
   */
  handle(event: DomainEvent<T>): Promise<void> | void;
}

/**
 * Event bus for publishing and subscribing to domain events
 * @interface
 */
export interface EventBus {
  /**
   * Publishes an event to all subscribers
   * @template T - Type of event data
   * @param {DomainEvent<T>} event - Event to publish
   * @returns {Promise<void>} Promise that resolves when published
   */
  publish<T>(event: DomainEvent<T>): Promise<void>;
  
  /**
   * Subscribes to events of a specific type
   * @template T - Type of event data
   * @param {string} eventType - Type of events to subscribe to
   * @param {EventHandler<T>} handler - Handler for the events
   */
  subscribe<T>(eventType: string, handler: EventHandler<T>): void;
  
  /**
   * Unsubscribes from events of a specific type
   * @template T - Type of event data
   * @param {string} eventType - Type of events to unsubscribe from
   * @param {EventHandler<T>} handler - Handler to remove
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
 * @private
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Type alias for typed event emitter
 * @template T - Event map type
 */
export type TypedEventEmitter<T extends EventMap = EventMap> = TypedEventEmitterImpl<T>;