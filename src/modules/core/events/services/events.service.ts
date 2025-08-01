/**
 * EventBus service for inter-module communication.
 */

import { EventEmitter } from 'events';
import type { IEventBus, IEventHandler } from '@/modules/core/events/types/manual';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { EventsRepository } from '@/modules/core/events/repositories/events.repository';

export class EventBusService implements IEventBus {
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

    this.handlerMap.set(handler, wrappedHandler);

    this.emitter.on(event, wrappedHandler);
    this.logger.debug(LogSource.MODULES, `Event handler registered: ${event}`);

    return () => { this.off(event, handler); };
  }

  /**
   * Unsubscribe from an event.
   * @param event
   * @param handler
   */
  off(event: string, handler: Function): void {
    const wrappedHandler = this.handlerMap.get(handler);
    if (wrappedHandler) {
      this.emitter.removeListener(event, wrappedHandler as any);
      this.handlerMap.delete(handler);
    }

    this.logger.debug(LogSource.MODULES, `Event handler removed: ${event}`);
  }

  /**
   * Subscribe to an event once.
   * @param event
   * @param handler
   */
  once<T = unknown>(event: string, handler: IEventHandler): void {
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
   * Reset singleton instance for testing purposes.
   */
  static reset(): void {
    if (EventBusService.instance !== null) {
      EventBusService.instance.removeAllListeners();
      EventBusService.instance = null;
    }
  }
}
