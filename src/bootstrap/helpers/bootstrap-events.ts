/**
 * Bootstrap Event Emitter for SystemPrompt OS.
 * Provides event-driven monitoring of the bootstrap process.
 * @module bootstrap/helpers/bootstrap-events
 */

import { EventEmitter } from 'events';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { BootstrapPhaseEnum } from '@/types/bootstrap';

export interface BootstrapPhaseEvent {
  phase: BootstrapPhaseEnum;
  timestamp: Date;
  duration?: number | undefined;
}

export interface ModuleLifecycleEvent {
  module: string;
  event: 'initialize' | 'start' | 'stop' | 'health_check';
  timestamp: Date;
  success: boolean;
  error?: string | undefined;
  duration?: number | undefined;
}

export interface BootstrapErrorEvent {
  phase: BootstrapPhaseEnum;
  module?: string | undefined;
  error: Error;
  timestamp: Date;
  critical: boolean;
}

export type BootstrapEventMap = {
  'phase:start': BootstrapPhaseEvent;
  'phase:complete': BootstrapPhaseEvent;
  'module:lifecycle': ModuleLifecycleEvent;
  'bootstrap:error': BootstrapErrorEvent;
  'bootstrap:complete': { timestamp: Date; totalDuration: number; moduleCount: number };
};

/**
 * Event emitter for bootstrap process monitoring.
 */
export class BootstrapEventEmitter extends EventEmitter {
  private readonly logger = LoggerService.getInstance();
  private readonly phaseStartTimes = new Map<BootstrapPhaseEnum, number>();
  private bootstrapStartTime?: number;

  constructor() {
    super();
    this.setupInternalListeners();
  }

  /**
   * Emit phase start event.
   * @param phase - The bootstrap phase starting
   */
  emitPhaseStart(phase: BootstrapPhaseEnum): void {
    const timestamp = new Date();
    this.phaseStartTimes.set(phase, Date.now());

    const event: BootstrapPhaseEvent = {
      phase,
      timestamp
    };

    this.emit('phase:start', event);
    this.logger.debug(LogSource.BOOTSTRAP, `Phase started: ${phase}`, {
      category: 'events',
      phase
    });
  }

  /**
   * Emit phase complete event.
   * @param phase - The bootstrap phase completed
   */
  emitPhaseComplete(phase: BootstrapPhaseEnum): void {
    const timestamp = new Date();
    const startTime = this.phaseStartTimes.get(phase);
    const duration = startTime ? Date.now() - startTime : undefined;

    const event: BootstrapPhaseEvent = {
      phase,
      timestamp,
      duration
    };

    this.emit('phase:complete', event);
    this.logger.debug(LogSource.BOOTSTRAP, `Phase completed: ${phase}`, {
      category: 'events',
      phase,
      duration: duration
    });
  }

  /**
   * Emit module lifecycle event.
   * @param module - Module name
   * @param event - Lifecycle event type
   * @param success - Whether the operation succeeded
   * @param error - Error message if failed
   * @param duration - Operation duration in milliseconds
   */
  emitModuleLifecycle(
    module: string,
    event: ModuleLifecycleEvent['event'],
    success: boolean,
    error?: string,
    duration?: number
  ): void {
    const lifecycleEvent: ModuleLifecycleEvent = {
      module,
      event,
      timestamp: new Date(),
      success,
      error,
      duration
    };

    this.emit('module:lifecycle', lifecycleEvent);
    
    const logLevel = success ? 'debug' : 'warn';
    this.logger[logLevel](LogSource.BOOTSTRAP, `Module ${event}: ${module}`, {
      category: 'events',
      module,
      event,
      success,
      error,
      duration: duration ? duration : undefined
    });
  }

  /**
   * Emit bootstrap error event.
   * @param phase - Current bootstrap phase
   * @param error - The error that occurred
   * @param module - Module name if error is module-specific
   * @param critical - Whether the error is critical
   */
  emitBootstrapError(
    phase: BootstrapPhaseEnum,
    error: Error,
    module?: string,
    critical: boolean = false
  ): void {
    const errorEvent: BootstrapErrorEvent = {
      phase,
      module,
      error,
      timestamp: new Date(),
      critical
    };

    this.emit('bootstrap:error', errorEvent);
    
    this.logger.error(LogSource.BOOTSTRAP, 'Bootstrap error', {
      category: 'events',
      phase,
      module,
      error: error.message,
      critical
    });
  }

  /**
   * Start tracking bootstrap process.
   */
  startBootstrap(): void {
    this.bootstrapStartTime = Date.now();
  }

  /**
   * Emit bootstrap complete event.
   * @param moduleCount - Number of modules loaded
   */
  emitBootstrapComplete(moduleCount: number): void {
    const timestamp = new Date();
    const totalDuration = this.bootstrapStartTime 
      ? Date.now() - this.bootstrapStartTime 
      : 0;

    this.emit('bootstrap:complete', {
      timestamp,
      totalDuration,
      moduleCount
    });

    this.logger.info(LogSource.BOOTSTRAP, 'Bootstrap completed', {
      category: 'events',
      totalDuration: `${totalDuration}ms`,
      moduleCount
    });
  }

  /**
   * Setup internal event listeners for logging.
   */
  private setupInternalListeners(): void {
    // Log all events for debugging
    this.on('phase:start', (event) => {
      this.logger.debug(LogSource.BOOTSTRAP, 'Event: phase:start', {
        category: 'events',
        phase: event.phase
      });
    });

    this.on('phase:complete', (event) => {
      this.logger.debug(LogSource.BOOTSTRAP, 'Event: phase:complete', {
        category: 'events',
        phase: event.phase,
        duration: event.duration
      });
    });

    this.on('module:lifecycle', (event) => {
      this.logger.debug(LogSource.BOOTSTRAP, 'Event: module:lifecycle', {
        category: 'events',
        module: event.module,
        event: event.event,
        success: event.success
      });
    });

    this.on('bootstrap:error', (event) => {
      this.logger.error(LogSource.BOOTSTRAP, 'Event: bootstrap:error', {
        category: 'events',
        phase: event.phase,
        module: event.module,
        critical: event.critical,
        error: event.error.message
      });
    });
  }

  /**
   * Type-safe event listener registration.
   */
  override on<K extends keyof BootstrapEventMap>(
    event: K,
    listener: (arg: BootstrapEventMap[K]) => void
  ): this {
    return super.on(event, listener);
  }

  /**
   * Type-safe event emission.
   */
  override emit<K extends keyof BootstrapEventMap>(
    event: K,
    arg: BootstrapEventMap[K]
  ): boolean {
    return super.emit(event, arg);
  }
}