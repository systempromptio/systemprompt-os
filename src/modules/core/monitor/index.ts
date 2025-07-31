/**
 * Monitor module - Auto-generated type-safe implementation.
 * @file Monitor module entry point with full Zod validation.
 * @module modules/core/monitor
 */

import { BaseModule, ModulesType } from '@/modules/core/modules/types/index';
import { MonitorService } from '@/modules/core/monitor/services/monitor.service';
import {
  type IMonitorModuleExports,
  MonitorModuleExportsSchema,
  MonitorServiceSchema
} from '@/modules/core/monitor/types/monitor.service.generated';
import type { ZodSchema } from 'zod';

/**
 * Monitor module implementation using BaseModule.
 * Provides monitoring services with full Zod validation.
 */
export class MonitorModule extends BaseModule<IMonitorModuleExports> {
  public readonly name = 'monitor' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'System monitoring and metrics collection';
  public readonly dependencies = ['logger', 'database'] as const;
  private monitorService!: MonitorService;
  get exports(): IMonitorModuleExports {
    return {
      service: () => {
        this.ensureInitialized();
        return this.validateServiceStructure(
          this.monitorService,
          MonitorServiceSchema,
          'MonitorService'
        );
      },
    };
  }

  /**
   * Get the Zod schema for this module's exports.
   * @returns The Zod schema for validating module exports.
   */
  protected getExportsSchema(): ZodSchema {
    return MonitorModuleExportsSchema;
  }

  /**
   * Initialize the module.
   */
  protected async initializeModule(): Promise<void> {
    this.monitorService = MonitorService.getInstance();
    // Initialize method is called internally by the service
  }
}

/**
 * Create and return a new monitor module instance.
 * @returns A new monitor module instance.
 */
export const createModule = (): MonitorModule => {
  return new MonitorModule();
};

/**
 * Export module instance.
 */
export const monitorModule = new MonitorModule();

/**
 * Initialize the monitor module.
 * @returns Promise that resolves when the module is initialized.
 */
export const initialize = async (): Promise<void> => {
  await monitorModule.initialize();
};
