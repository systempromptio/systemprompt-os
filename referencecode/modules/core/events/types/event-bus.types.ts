/**
 * Event bus type definitions
 */

/**
 * Event handler function type
 */
export type EventHandlerFunction = (data: unknown) => void | Promise<void>;

/**
 * Event bus interface
 */
export interface IEventBus {
  /**
   * Emit an event
   */
  emit(event: string, data?: unknown): boolean;

  /**
   * Listen for an event
   */
  on(event: string, handler: EventHandlerFunction): void;

  /**
   * Listen for an event once
   */
  once(event: string, handler: EventHandlerFunction): void;

  /**
   * Remove event listener
   */
  off(event: string, handler: EventHandlerFunction): void;

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void;
}
