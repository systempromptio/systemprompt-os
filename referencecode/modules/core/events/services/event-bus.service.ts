import { Service, Inject } from 'typedi';
import { EventEmitter } from 'events';
import type { IEventBus } from '../types/index.js';
import type { ILogger } from '../../logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';

/**
 * Internal event bus for module communication
 */
@Service()
export class EventBus implements IEventBus {
  private readonly emitter: EventEmitter;
  private readonly wildcardListeners: Map<string, Set<(...args: any[]) => any>>;

  constructor(@Inject(TYPES.Logger) private readonly logger: ILogger) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Increase max listeners
    this.wildcardListeners = new Map();
  }

  /**
   * Emit an event
   */
  emit(eventType: string, data?: unknown): boolean {
    this.logger.debug('Emitting event', { eventType, data });

    // Emit to exact listeners
    const hasListeners = this.emitter.emit(eventType, data);

    // Emit to wildcard listeners
    const hasWildcardListeners = this.emitToWildcardListeners(eventType, data);

    return hasListeners || hasWildcardListeners;
  }

  /**
   * Register an event handler
   */
  on(eventPattern: string, handler: (data: unknown) => void | Promise<void>): void {
    if (eventPattern.includes('*')) {
      // Wildcard pattern
      if (!this.wildcardListeners.has(eventPattern)) {
        this.wildcardListeners.set(eventPattern, new Set());
      }
      this.wildcardListeners.get(eventPattern)!.add(handler);
    } else {
      // Exact pattern
      this.emitter.on(eventPattern, handler);
    }
  }

  /**
   * Register a one-time event handler
   */
  once(eventPattern: string, handler: (data: unknown) => void | Promise<void>): void {
    const wrappedHandler = (data: unknown) => {
      handler(data);
      this.off(eventPattern, wrappedHandler);
    };
    this.on(eventPattern, wrappedHandler);
  }

  /**
   * Unregister an event handler
   */
  off(eventPattern: string, handler: (data: unknown) => void | Promise<void>): void {
    if (eventPattern.includes('*')) {
      // Wildcard pattern
      const listeners = this.wildcardListeners.get(eventPattern);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          this.wildcardListeners.delete(eventPattern);
        }
      }
    } else {
      // Exact pattern
      this.emitter.off(eventPattern, handler);
    }
  }

  /**
   * Emit to wildcard listeners
   */
  private emitToWildcardListeners(eventType: string, data: unknown): boolean {
    let hasListeners = false;
    for (const [pattern, listeners] of this.wildcardListeners) {
      if (this.matchesPattern(eventType, pattern)) {
        hasListeners = true;
        for (const listener of listeners) {
          try {
            listener(data);
          } catch (error) {
            this.logger.error('Wildcard listener error', {
              pattern,
              eventType,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }
    }
    return hasListeners;
  }

  /**
   * Check if event type matches a wildcard pattern
   */
  private matchesPattern(eventType: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .split('.')
      .map((part) => (part === '*' ? '[^.]+' : part))
      .join('\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventType);
  }

  /**
   * Get all registered event patterns
   */
  getEventPatterns(): string[] {
    const exactEvents = this.emitter.eventNames().map((e) => String(e));
    const wildcardEvents = Array.from(this.wildcardListeners.keys());
    return [...exactEvents, ...wildcardEvents];
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
    this.wildcardListeners.clear();
  }
}
