/**
 * EventBus service for inter-module communication
 */

import { EventEmitter } from 'events';
import type { IEventBus, IEventHandler } from '@/modules/core/events/types/index';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

export class EventBusService implements IEventBus {
  private static instance: EventBusService | null = null;
  private readonly emitter: EventEmitter;
  private readonly logger: ILogger;
  private readonly handlers: Map<string, Set<Function>>;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Increase for module communications
    this.logger = LoggerService.getInstance();
    this.handlers = new Map();
  }

  /**
   * Get singleton instance of EventBusService
   */
  static getInstance(): EventBusService {
    EventBusService.instance ??= new EventBusService();
    return EventBusService.instance;
  }

  /**
   * Emit an event with data
   */
  emit<T = any>(event: string, data: T): void {
    this.logger.debug(LogSource.MODULES, `Event emitted: ${event}`, { 
      data: data as Record<string, unknown> | undefined 
    });
    this.emitter.emit(event, data);
  }

  /**
   * Subscribe to an event
   */
  on<T = any>(event: string, handler: IEventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    
    this.handlers.get(event)!.add(handler);
    
    const wrappedHandler = async (data: T) => {
      try {
        await handler(data);
      } catch (error) {
        this.logger.error(LogSource.MODULES, `Error in event handler for ${event}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
    
    this.emitter.on(event, wrappedHandler);
    this.logger.debug(LogSource.MODULES, `Event handler registered: ${event}`);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: Function): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
    
    this.emitter.removeListener(event, handler as any);
    this.logger.debug(LogSource.MODULES, `Event handler removed: ${event}`);
  }

  /**
   * Subscribe to an event once
   */
  once<T = any>(event: string, handler: IEventHandler<T>): void {
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
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
      this.emitter.removeAllListeners(event);
    } else {
      this.handlers.clear();
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }
}