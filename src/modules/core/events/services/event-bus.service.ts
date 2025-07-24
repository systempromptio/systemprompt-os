/**
 * Event bus service implementation.
 * @module modules/core/events/services/event-bus.service
 */

import type {
 EventEntry, EventHandler, EventSubscription, IEventBusService
} from '@/modules/core/events/types/index.js';

/**
 * Service for managing events.
 * @class EventBusService
 */
export class EventBusService implements IEventBusService {
  private static instance: EventBusService;
  private readonly subscriptions: Map<string, EventSubscription[]> = new Map();
  private history: EventEntry[] = [];
  private nextId = 1;
  private initialized = false;

  /**
   * Get singleton instance.
   * @returns {EventBusService} Service instance.
   */
  static getInstance(): EventBusService {
    EventBusService.instance ||= new EventBusService();
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
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name.
   * @param {EventHandler} handler - Event handler.
   * @returns {string} Subscription ID.
   */
  on(event: string, handler: EventHandler): string {
    const id = `sub_${this.nextId++}`;
    const subscription: EventSubscription = {
      id,
      event,
      handler,
      once: false,
    };

    const subs = this.subscriptions.get(event) || [];
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
    const id = `sub_${this.nextId++}`;
    const subscription: EventSubscription = {
      id,
      event,
      handler,
      once: true,
    };

    const subs = this.subscriptions.get(event) || [];
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
    if (!subs) { return; }

    const filtered = subs.filter(sub => {
      if (typeof handlerOrId === 'string') {
        return sub.id !== handlerOrId;
      }
      return sub.handler !== handlerOrId;
    });

    if (filtered.length > 0) {
      this.subscriptions.set(event, filtered);
    } else {
      this.subscriptions.delete(event);
    }
  }

  /**
   * Emit an event.
   * @param {string} event - Event name.
   * @param {any} data - Event data.
   * @returns {Promise<void>} Promise that resolves when all handlers complete.
   */
  async emit(event: string, data?: any): Promise<void> {
    // Record in history
    this.history.push({
      id: `evt_${this.nextId++}`,
      event,
      data,
      timestamp: new Date(),
    });

    // Keep history size limited
    if (this.history.length > 1000) {
      this.history = this.history.slice(-1000);
    }

    const subs = this.subscriptions.get(event);
    if (!subs) { return; }

    const promises: Promise<void>[] = [];
    const toRemove: string[] = [];

    for (const sub of subs) {
      const promise = Promise.resolve(sub.handler(data));
      promises.push(promise);

      if (sub.once) {
        toRemove.push(sub.id);
      }
    }

    // Wait for all handlers
    await Promise.all(promises);

    // Remove once handlers
    if (toRemove.length > 0) {
      const remaining = subs.filter(sub => { return !toRemove.includes(sub.id) });
      if (remaining.length > 0) {
        this.subscriptions.set(event, remaining);
      } else {
        this.subscriptions.delete(event);
      }
    }
  }

  /**
   * Remove all listeners for an event.
   * @param {string} event - Event name.
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.subscriptions.delete(event);
    } else {
      this.subscriptions.clear();
    }
  }

  /**
   * Get all listeners for an event.
   * @param {string} event - Event name.
   * @returns {EventSubscription[]} Event subscriptions.
   */
  getListeners(event?: string): EventSubscription[] {
    if (event) {
      return this.subscriptions.get(event) || [];
    }

    const all: EventSubscription[] = [];
    for (const subs of this.subscriptions.values()) {
      all.push(...subs);
    }
    return all;
  }

  /**
   * Get event history.
   * @param {number} limit - Number of events to retrieve.
   * @returns {EventEntry[]} Event entries.
   */
  getHistory(limit: number = 10): EventEntry[] {
    return this.history.slice(-limit);
  }
}
