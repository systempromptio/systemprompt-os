/**
 * Event bus service implementation.
 * @module modules/core/events/services/event-bus.service
 */

import type {
 EventHandler, IEventBusService, IEventEntry, IEventSubscription
} from '@/modules/core/events/types/index.js';

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const EMPTY_LENGTH = 0 as const;
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const HISTORY_LIMIT = 1000 as const;
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const INITIAL_ID = 1 as const;
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const HISTORY_KEEP_SIZE = -1000 as const;
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const DEFAULT_HISTORY_LIMIT = 10 as const;

/**
 * Service for managing events.
 * @class EventBusService
 */
export class EventBusService implements IEventBusService {
  private static readonly historyLimit = HISTORY_LIMIT;
  private static readonly initialId = INITIAL_ID;
  private static readonly historyKeepSize = HISTORY_KEEP_SIZE;
  private static readonly defaultHistoryLimit = DEFAULT_HISTORY_LIMIT;
  private static instance: EventBusService | undefined;
  private readonly subscriptions: Map<string, IEventSubscription[]> = new Map();
  private history: IEventEntry[] = [];
  private nextId = EventBusService.initialId;
  private initialized = false;

  /**
   * Private constructor for singleton pattern.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns {EventBusService} Service instance.
   */
  static getInstance(): EventBusService {
    EventBusService.instance ??= new EventBusService();
    return EventBusService.instance;
  }

  /**
   * Initialize the service.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    await Promise.resolve();
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name.
   * @param {EventHandler} handler - Event handler.
   * @returns {string} Subscription ID.
   */
  on(event: string, handler: EventHandler): string {
    const id = `sub_${String(this.nextId)}`;
    this.nextId += 1;
    const subscription: IEventSubscription = {
      id,
      event,
      handler,
      once: false,
    };

    const subs = this.subscriptions.get(event) ?? [];
    subs.push(subscription);
    this.subscriptions.set(event, subs);

    return id;
  }

  /**
   * Subscribe to an event once.
   * @param {string} event - Event name.
   * @param {EventHandler} handler - Event handler.
   * @returns {string} Subscription ID.
   */
  once(event: string, handler: EventHandler): string {
    const id = `sub_${String(this.nextId)}`;
    this.nextId += 1;
    const subscription: IEventSubscription = {
      id,
      event,
      handler,
      once: true,
    };

    const subs = this.subscriptions.get(event) ?? [];
    subs.push(subscription);
    this.subscriptions.set(event, subs);

    return id;
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event - Event name.
   * @param {string | EventHandler} handlerOrId - Handler function or subscription ID.
   */
  off(event: string, handlerOrId: string | EventHandler): void {
    const subs = this.subscriptions.get(event);
    if (subs === undefined) { return; }

    const filtered = subs.filter((sub): boolean => {
      if (typeof handlerOrId === 'string') {
        return sub.id !== handlerOrId;
      }
      return sub.handler !== handlerOrId;
    });

    if (filtered.length > EMPTY_LENGTH) {
      this.subscriptions.set(event, filtered);
    } else {
      this.subscriptions.delete(event);
    }
  }

  /**
   * Emit an event.
   * @param {string} event - Event name.
   * @param {unknown} payload - Event payload.
   * @returns {Promise<void>} Promise that resolves when all handlers complete.
   */
  async emit(event: string, payload?: unknown): Promise<void> {
    this.addToHistory(event, payload);

    const subs = this.subscriptions.get(event);
    if (subs === undefined) { return; }

    const promises: Promise<void>[] = [];
    const toRemove: string[] = [];

    for (const sub of subs) {
      promises.push(Promise.resolve(sub.handler(payload)));
      if (sub.once) {
        toRemove.push(sub.id);
      }
    }

    await Promise.all(promises);
    this.cleanupOnceHandlers(event, toRemove);
  }

  /**
   * Remove all listeners for an event.
   * @param {string} event - Event name.
   */
  removeAllListeners(event?: string): void {
    if (typeof event === 'string' && event.length > EMPTY_LENGTH) {
      this.subscriptions.delete(event);
    } else {
      this.subscriptions.clear();
    }
  }

  /**
   * Get all listeners for an event.
   * @param {string} event - Event name.
   * @returns {IEventSubscription[]} Event subscriptions.
   */
  getListeners(event?: string): IEventSubscription[] {
    if (typeof event === 'string' && event.length > EMPTY_LENGTH) {
      return this.subscriptions.get(event) ?? [];
    }

    const all: IEventSubscription[] = [];
    for (const subs of this.subscriptions.values()) {
      all.push(...subs);
    }
    return all;
  }

  /**
   * Get event history.
   * @param {number} limit - Number of events to retrieve.
   * @returns {IEventEntry[]} Event entries.
   */
  getHistory(limit: number = EventBusService.defaultHistoryLimit): IEventEntry[] {
    return this.history.slice(-limit);
  }

  /**
   * Add event to history.
   * @param {string} event - Event name.
   * @param {unknown} payload - Event payload.
   * @private
   */
  private addToHistory(event: string, payload?: unknown): void {
    this.history.push({
      id: `evt_${String(this.nextId)}`,
      event,
      payload,
      timestamp: new Date(),
    });
    this.nextId += 1;

    if (this.history.length > EventBusService.historyLimit) {
      this.history = this.history.slice(EventBusService.historyKeepSize);
    }
  }

  /**
   * Clean up once handlers.
   * @param {string} event - Event name.
   * @param {string[]} toRemove - IDs to remove.
   * @private
   */
  private cleanupOnceHandlers(event: string, toRemove: string[]): void {
    const subs = this.subscriptions.get(event);
    if (subs === undefined) { return; }

    if (toRemove.length > EMPTY_LENGTH) {
      const remaining = subs.filter((sub): boolean => { return !toRemove.includes(sub.id) });
      if (remaining.length > EMPTY_LENGTH) {
        this.subscriptions.set(event, remaining);
      } else {
        this.subscriptions.delete(event);
      }
    }
  }
}
