// LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues: Rule conflict between jsdoc/require-jsdoc (requires JSDoc on getter) and systemprompt-os/no-blank-lines-between-properties (treats JSDoc as blank line between properties).
/**
 * Events module for inter-module communication.
 */

import {
  type IModule, ModulesStatus, ModulesType
} from '@/modules/core/modules/types/manual';
import { EventBusService } from '@/modules/core/events/services/events.service';
import { EventNamesObject, type IEventsModuleExports } from '@/modules/core/events/types/manual';
import { type ILogger, LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
// CLI commands are registered through the cliCommands getter
import { command as statusCommand } from '@/modules/core/events/cli/status';

/**
 * Events module implementation providing event bus functionality for inter-module communication.
 * Manages event subscription, emission, and cleanup across the system.
 */
export class EventsModule implements IModule<IEventsModuleExports> {
  public readonly name = 'events';
  public readonly version = '1.0.0';
  public readonly type = ModulesType.CORE;
  public readonly description = 'Event bus for inter-module communication';
  public readonly dependencies = ['logger', 'database'] as const;
  public status: ModulesStatus = ModulesStatus.PENDING;
  private eventBus!: EventBusService;
  private logger!: ILogger;
  private initialized = false;
  public get exports(): IEventsModuleExports {
    return {
      eventBus: this.eventBus,
      EventNames: EventNamesObject
    };
  }
  public get cliCommands() {
    return [statusCommand];
  }
  /**
   * Initializes the events module by setting up logger and event bus instances.
   * @throws Error if already initialized or if initialization fails.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Events module already initialized');
    }

    try {
      this.logger = LoggerService.getInstance();
      this.eventBus = EventBusService.getInstance();

      this.initialized = true;
      this.logger.info(LogSource.MODULES, 'Events module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize Events module: ${errorMessage}`);
    }
  }

  /**
   * Starts the events module by setting status to running.
   * @throws Error if module is not initialized.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Events module not initialized');
    }

    this.status = ModulesStatus.RUNNING;
    this.logger.info(LogSource.MODULES, 'Events module started');
  }

  /**
   * Stops the events module by removing all listeners and setting status to stopped.
   */
  async stop(): Promise<void> {
    this.eventBus.removeAllListeners();
    this.status = ModulesStatus.STOPPED;
    this.logger.info(LogSource.MODULES, 'Events module stopped');
  }

  /**
   * Performs health check on the events module.
   * @returns Health status object with healthy flag and optional message.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'Events module not initialized'
      };
    }

    return {
      healthy: true,
      message: 'Events module is healthy'
    };
  }
}

/**
 * Creates a new instance of the events module.
 * @returns A new EventsModule instance.
 */
export const createModule = (): EventsModule => {
  return new EventsModule();
};

/**
 * Initializes the events module by creating and returning a new instance.
 * @returns A new EventsModule instance.
 */
export const initialize = (): EventsModule => {
  return createModule();
};

/**
 * Gets the Events module with type safety and validation.
 * This should only be used after bootstrap when the module loader is available.
 * @returns The Events module with guaranteed typed exports.
 * @throws {Error} If Events module is not available or missing required exports.
 */
export function getEventsModule(): IModule<IEventsModuleExports> {
  const { getModuleRegistry } = require('/var/www/html/systemprompt-os/src/modules/loader');
  const { ModuleName } = require('/var/www/html/systemprompt-os/src/modules/types/module-names.types');

  const registry = getModuleRegistry();
  const eventsModule = registry.get(ModuleName.EVENTS);

  if (!eventsModule.exports?.eventBus) {
    throw new Error('Events module missing required eventBus export');
  }

  if (!eventsModule.exports?.EventNames) {
    throw new Error('Events module missing required EventNames export');
  }

  return eventsModule as IModule<IEventsModuleExports>;
}

export default EventsModule;
