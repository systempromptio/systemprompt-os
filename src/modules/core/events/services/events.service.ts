/**
 * EventBus service for inter-module communication.
 */

import { EventEmitter } from 'events';
import type { IEventHandler, IEventBus } from '@/modules/core/events/types/manual';
import type { IEventBusService } from '@/modules/core/events/types/events.service.generated';
import { type ILogger, LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { EventsRepository } from '@/modules/core/events/repositories/events.repository';

export class EventBusService implements IEventBus, IEventBusService {
  private static instance: EventBusService | null = null;
  private readonly emitter: EventEmitter;
  private readonly logger: ILogger;
  private readonly handlerMap: Map<Function, Function>;
  private readonly repository: EventsRepository | null = null;
  private persistEvents = true;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    this.logger = LoggerService.getInstance();
    this.handlerMap = new Map();

    try {
      this.repository = EventsRepository.getInstance();
    } catch {
      this.persistEvents = false;
    }
  }

  /**
   * Get singleton instance of EventBusService.
   */
  static getInstance(): EventBusService {
    EventBusService.instance ??= new EventBusService();
    return EventBusService.instance;
  }

  /**
   * Emit an event with data.
   * @param event
   * @param data
   */
  emit<T = any>(event: string, data: T): void {
    this.logger.debug(LogSource.MODULES, `Event emitted: ${event}`, {
      data: data as Record<string, unknown> | undefined
    });

    if (this.persistEvents && this.repository) {
      this.persistEvent(event, data).catch(error => {
        this.logger.error(LogSource.MODULES, `Failed to persist event: ${event}`, { error });
      });
    }

    this.emitter.emit(event, data);
  }

  /**
   * Persist event to database via repository.
   * @param eventName
   * @param data
   */
  private async persistEvent(eventName: string, data: unknown): Promise<void> {
    if (!this.repository) { return; }

    try {
      await this.repository.createEvent(eventName, data, 'system');
    } catch (error) {
      if (error instanceof Error && error.message.includes('no such table')) {
        this.persistEvents = false;
        this.logger.debug(LogSource.MODULES, 'Events table not found, disabling event persistence');
      } else {
        throw error;
      }
    }
  }

  /**
   * Subscribe to an event.
   * @param event
   * @param handler
   * @returns Unsubscribe function.
   */
  on<T = unknown>(event: string, handler: IEventHandler): () => void {
    const wrappedHandler = async (data: T) => {
      try {
        await handler(data);
      } catch (error) {
        this.logger.error(LogSource.MODULES, `Error in event handler for ${event}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    this.handlerMap.set(handler as Function, wrappedHandler);

    this.emitter.on(event, wrappedHandler);
    this.logger.debug(LogSource.MODULES, `Event handler registered: ${event}`);

    return () => { this.off(event, handler as Function); };
  }

  /**
   * Unsubscribe from an event.
   * @param event
   * @param handler
   */
  off(event: string, handler: Function): void;
  off(event: string, handler: (data: unknown) => void | Promise<void>): void;
  off(event: string, handler: Function | ((data: unknown) => void | Promise<void>)): void {
    const wrappedHandler = this.handlerMap.get(handler as Function);
    if (wrappedHandler) {
      this.emitter.removeListener(event, wrappedHandler as any);
      this.handlerMap.delete(handler as Function);
    }

    this.logger.debug(LogSource.MODULES, `Event handler removed: ${event}`);
  }

  /**
   * Subscribe to an event once.
   * @param event
   * @param handler
   */
  once<T = unknown>(event: string, handler: (data: unknown) => void | Promise<void>): void {
    const wrappedHandler = async (data: T) => {
      try {
        await handler(data);
      } catch (error) {
        this.logger.error(LogSource.MODULES, `Error in one-time event handler for ${event}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    this.emitter.once(event, wrappedHandler);
    this.logger.debug(LogSource.MODULES, `One-time event handler registered: ${event}`);
  }

  /**
   * Remove all listeners for an event.
   * @param event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.emitter.removeAllListeners(event);
      for (const [originalHandler, wrappedHandler] of this.handlerMap.entries()) {
        if (this.emitter.listeners(event).includes(wrappedHandler as any)) {
          this.handlerMap.delete(originalHandler);
        }
      }
    } else {
      this.handlerMap.clear();
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get the number of listeners for an event.
   * @param event
   */
  listenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Get event statistics for CLI and monitoring.
   */
  async getEventStats(): Promise<{ total_events: number }> {
    if (!this.repository) {
      return { total_events: 0 };
    }
    return await this.repository.getEventStats();
  }

  /**
   * Get recent events for CLI display.
   * @param limit
   */
  async getRecentEvents(limit: number = 10): Promise<any[]> {
    if (!this.repository) {
      return [];
    }
    return await this.repository.getRecentEvents(limit);
  }

  /**
   * Get events by name for CLI filtering.
   * @param eventName
   * @param limit
   */
  async getEventsByName(eventName: string, limit: number = 10): Promise<any[]> {
    if (!this.repository) {
      return [];
    }
    return await this.repository.getEventsByName(eventName, limit);
  }

  /**
   * Get a single event by ID for CLI display.
   * @param eventId
   */
  async getEventById(eventId: string): Promise<any | null> {
    if (!this.repository) {
      return null;
    }

    const {db} = (this.repository as any);
    if (db) {
      const events = await db.query('SELECT * FROM events WHERE id = ?', [eventId]);
      return events && events.length > 0 ? events[0] : null;
    }
    return null;
  }

  /**
   * Get active subscriptions for CLI display.
   */
  async getActiveSubscriptions(): Promise<Array<{ event_name: string; subscriber_count: number }>> {
    if (!this.repository) {
      return [];
    }
    return await this.repository.getActiveSubscriptions();
  }

  /**
   * Clear all events from storage (for CLI maintenance).
   */
  async clearEvents(): Promise<void> {
    if (!this.repository) {
      return;
    }

    const {db} = (this.repository as any);
    if (db) {
      await db.execute('DELETE FROM events');
      this.logger.info(LogSource.MODULES, 'All events cleared from storage');
    }
  }

  /**
   * Clear all subscriptions from storage (for CLI maintenance).
   */
  async clearSubscriptions(): Promise<void> {
    if (!this.repository) {
      return;
    }

    const {db} = (this.repository as any);
    if (db) {
      await db.execute('DELETE FROM event_subscriptions');
      this.logger.info(LogSource.MODULES, 'All subscriptions cleared from storage');
    }
  }

  /**
   * Get service status for CLI reporting.
   */
  getServiceStatus(): { healthy: boolean; uptime: string; listeners: number } {
    const startTime = process.uptime();
    const uptime = `${Math.floor(startTime / 60)}m ${Math.floor(startTime % 60)}s`;

    return {
      healthy: true,
      uptime,
      listeners: this.emitter.eventNames().length
    };
  }

  /**
   * Reset singleton instance for testing purposes.
   */
  static reset(): void {
    if (EventBusService.instance !== null) {
      EventBusService.instance.removeAllListeners();
      EventBusService.instance = null;
    }
  }
}
