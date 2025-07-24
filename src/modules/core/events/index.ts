/**
 * Core events module - provides event bus system.
 * @file Core events module - provides event bus system.
 * @module modules/core/events
 */

import { EventBusService } from '@/modules/core/events/services/event-bus.service.js';
import type { IEventBusService } from '@/modules/core/events/types/index.js';

/**
 * Events module implementation.
 * @class EventsModule
 */
export class EventsModule {
  public readonly name = 'events';
  public readonly type = 'core' as const;
  public readonly version = '1.0.0';
  public readonly description = 'Event bus system for SystemPrompt OS';
  public readonly dependencies: string[] = [];
  public status: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
  private eventBusService?: EventBusService;
  private initialized = false;
  private started = false;

  /**
   * Initialize the events module.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Events module already initialized');
    }

    try {
      this.eventBusService = EventBusService.getInstance();
      await this.eventBusService.initialize();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize events module: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start the events module.
   * @returns {Promise<void>} Promise that resolves when started.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Events module not initialized');
    }

    if (this.started) {
      throw new Error('Events module already started');
    }

    this.started = true;
    this.status = 'running';
  }

  /**
   * Stop the events module.
   * @returns {Promise<void>} Promise that resolves when stopped.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.eventBusService?.removeAllListeners();
      this.started = false;
      this.status = 'stopped';
    }
  }

  /**
   * Perform health check on the events module.
   * @returns {Promise<{ healthy: boolean; message?: string }>} Health check result.
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
  }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Events module not initialized',
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: 'Events module not started',
      };
    }
    return {
      healthy: true,
      message: 'Events module is healthy',
    };
  }

  /**
   * Get the event bus service.
   * @returns {IEventBusService} Event bus service instance.
   * @throws {Error} If module not initialized.
   */
  getService(): IEventBusService {
    if (!this.eventBusService) {
      throw new Error('Events module not initialized');
    }
    return this.eventBusService;
  }
}

/**
 * Factory function for creating the module.
 * @returns {EventsModule} Events module instance.
 */
export const createModule = (): EventsModule => {
  return new EventsModule();
};

/**
 * Initialize function for core module pattern.
 * @returns {Promise<EventsModule>} Initialized events module.
 */
export const initialize = async (): Promise<EventsModule> => {
  const eventsModule = new EventsModule();
  await eventsModule.initialize();
  return eventsModule;
};

/**
 * Get event bus service instance.
 * @returns {IEventBusService} Event bus service instance.
 */
export const getEventBusService = (): IEventBusService => {
  return EventBusService.getInstance();
};

/**
 * Re-export EventBusService.
 */
export { EventBusService };

/**
 * Default export of initialize for module pattern.
 */
export default initialize;
