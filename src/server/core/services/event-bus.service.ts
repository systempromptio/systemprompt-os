/**
 * Event Bus Service.
 * Provides event-driven communication for the server.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface EventBusConfig {
  maxListeners?: number;
  wildcard?: boolean;
}

export interface EmitAndWaitOptions {
  timeout?: number;
  retries?: number;
}

export class EventBus extends EventEmitter {
  private readonly wildcardHandlers: Map<string, Set<Function>> = new Map();
  private readonly pendingRequests: Map<string, {
    resolve: Function;
    reject: Function;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private readonly activeAsyncHandlers: Set<Promise<any>> = new Set();
  private readonly wildcardEnabled: boolean;

  constructor(config: EventBusConfig = {}) {
    super();

    if (config.maxListeners) {
      this.setMaxListeners(config.maxListeners);
    }

    this.wildcardEnabled = config.wildcard || false;
  }

  /**
   * Override emit to track async handlers.
   */
  emit(event: string | symbol, ...args: any[]): boolean {
    // Let the parent handle the emit
    const result = super.emit(event, ...args);
    
    // Get all listeners that were just called
    const listeners = this.listeners(event);
    
    // Track any promises from the last emit
    // Note: This is a workaround since we can't intercept the actual handler calls
    // We'll track promises through a different method
    
    // Handle wildcard listeners if enabled
    if (this.wildcardEnabled && typeof event === 'string') {
      for (const [pattern, handlers] of this.wildcardHandlers) {
        if (this.matchesWildcard(event, pattern)) {
          handlers.forEach(handler => {
            try {
              const result = handler(...args);
              if (result instanceof Promise) {
                this.trackAsyncHandler(result);
              }
            } catch (error) {
              console.error(`Error in wildcard handler for ${pattern}:`, error);
            }
          });
        }
      }
    }
    
    return result;
  }

  /**
   * Listen for events with wildcard support.
   * @param event
   * @param listener
   */
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (typeof event === 'string' && event.includes('*')) {
      if (!this.wildcardHandlers.has(event)) {
        this.wildcardHandlers.set(event, new Set());
      }
      this.wildcardHandlers.get(event)!.add(listener);
      return this;
    }

    // Wrap the listener to track async handlers
    const wrappedListener = (...args: any[]) => {
      try {
        const result = listener(...args);
        if (result instanceof Promise) {
          this.trackAsyncHandler(result);
        }
        return result;
      } catch (error) {
        throw error;
      }
    };
    
    // Store original listener reference for removal
    (wrappedListener as any).__originalListener = listener;

    return super.on(event, wrappedListener);
  }

  /**
   * Listen once for events.
   * @param event
   * @param listener
   */
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    // Wrap the listener to track async handlers
    const wrappedListener = (...args: any[]) => {
      try {
        const result = listener(...args);
        if (result instanceof Promise) {
          this.trackAsyncHandler(result);
        }
        return result;
      } catch (error) {
        throw error;
      }
    };
    
    // Store original listener reference
    (wrappedListener as any).__originalListener = listener;

    return super.once(event, wrappedListener);
  }

  /**
   * Remove listener.
   * @param event
   * @param listener
   */
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    // Find wrapped listener with matching original
    const listeners = this.listeners(event);
    const wrappedListener = listeners.find(l => (l as any).__originalListener === listener);
    
    if (wrappedListener) {
      return super.removeListener(event, wrappedListener);
    }
    return super.removeListener(event, listener);
  }

  /**
   * Remove wildcard listener.
   * @param event
   * @param listener
   */
  off(event: string | symbol, listener?: (...args: any[]) => void): this {
    if (typeof event === 'string' && event.includes('*') && listener) {
      const handlers = this.wildcardHandlers.get(event);
      if (handlers) {
        handlers.delete(listener);
        if (handlers.size === 0) {
          this.wildcardHandlers.delete(event);
        }
      }
      return this;
    }

    // If no listener provided, remove all listeners for this event
    if (!listener) {
      return this.removeAllListeners(event);
    }
    
    return this.removeListener(event, listener);
  }

  /**
   * Emit event and wait for response.
   * @param event
   * @param data
   * @param options
   */
  async emitAndWait(
    event: string,
    data: any,
    options: EmitAndWaitOptions = {}
  ): Promise<any> {
    const { timeout = 5000, retries = 0 } = options;

    data.requestId ||= uuidv4();

    const responseEvent = `response.${data.requestId}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.waitForResponse(
          event,
          responseEvent,
          data,
          timeout
        );
        return response;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await new Promise(resolve => { return setTimeout(resolve, 100 * (attempt + 1)) });
      }
    }

    throw new Error('Failed after retries');
  }

  /**
   * Wait for a response to an event.
   * @param event
   * @param responseEvent
   * @param data
   * @param timeout
   */
  private async waitForResponse(
    event: string,
    responseEvent: string,
    data: any,
    timeout: number
  ): Promise<any> {
    return await new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(data.requestId);
        this.removeAllListeners(responseEvent);
        reject(new Error(`Request timeout: ${event}`));
      }, timeout);

      this.pendingRequests.set(data.requestId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      this.once(responseEvent, (response: any) => {
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(data.requestId);

        // Always resolve with the response, let the caller handle errors
        resolve(response);
      });

      this.emit(event, data);
    });
  }

  /**
   * Check if event matches wildcard pattern.
   * @param event
   * @param pattern
   */
  private matchesWildcard(event: string, pattern: string): boolean {
    const regex = new RegExp(
      `^${pattern.split('*').map(s => { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') })
.join('.*')}$`
    );
    return regex.test(event);
  }

  /**
   * Get number of pending events.
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Clear all pending requests.
   */
  clearPending(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Request cleared'));
    }
    this.pendingRequests.clear();
  }
  
  /**
   * Wait for all active async handlers to complete.
   * @param timeout Maximum time to wait
   */
  async waitForActiveHandlers(timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (this.activeAsyncHandlers.size > 0 && Date.now() - startTime < timeout) {
      // Wait for any of the active handlers to complete
      const handlers = Array.from(this.activeAsyncHandlers);
      if (handlers.length > 0) {
        await Promise.race([
          Promise.all(handlers).catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 100))
        ]);
      }
    }
    
    // Clear any remaining handlers after timeout
    this.activeAsyncHandlers.clear();
  }
  
  /**
   * Track an async handler.
   * @param promise
   */
  private trackAsyncHandler(promise: Promise<any>): void {
    this.activeAsyncHandlers.add(promise);
    
    // Remove from tracking when complete
    promise
      .then(() => this.activeAsyncHandlers.delete(promise))
      .catch(() => this.activeAsyncHandlers.delete(promise));
  }
}