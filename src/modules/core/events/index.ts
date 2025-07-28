/**
 * Events module for inter-module communication
 */

import {
  type IModule, ModuleStatusEnum, ModuleTypeEnum
} from '@/modules/core/modules/types/index';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { type IEventsModuleExports, EventNames } from '@/modules/core/events/types/index';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

export class EventsModule implements IModule<IEventsModuleExports> {
  public readonly name = 'events';
  public readonly version = '1.0.0';
  public readonly type = ModuleTypeEnum.CORE;
  public readonly description = 'Event bus for inter-module communication';
  public readonly dependencies = ['logger'] as const;
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private eventBus!: EventBusService;
  private logger!: ILogger;
  private initialized = false;

  get exports(): IEventsModuleExports {
    return {
      eventBus: this.eventBus,
      EventNames
    };
  }

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

  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Events module not initialized');
    }

    this.status = ModuleStatusEnum.RUNNING;
    this.logger.info(LogSource.MODULES, 'Events module started');
  }

  async stop(): Promise<void> {
    this.eventBus.removeAllListeners();
    this.status = ModuleStatusEnum.STOPPED;
    this.logger.info(LogSource.MODULES, 'Events module stopped');
  }

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

export const createModule = (): EventsModule => {
  return new EventsModule();
};

export default EventsModule;