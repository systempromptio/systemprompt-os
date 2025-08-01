/**
 * Monitor module - Auto-generated type-safe implementation.
 * @file Monitor module entry point with full Zod validation.
 * @module modules/core/monitor
 */

import {
 BaseModule, ModulesStatus, ModulesType
} from '@/modules/core/modules/types/index';

const {
  RUNNING,
  STOPPED,
  ERROR
} = ModulesStatus;
import { MonitorService } from '@/modules/core/monitor/services/monitor.service';
import {
  type IMonitorModuleExports,
  type IMonitorService,
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
      service: (): IMonitorService => {
        this.ensureInitialized();
        const validatedService = this.validateServiceStructure(
          this.monitorService,
          MonitorServiceSchema,
          'MonitorService'
        );
        return validatedService as IMonitorService;
      },
    };
  }
  /**
   * Perform health check for the monitor module.
   * @returns Health check result.
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    checks: {
      database: boolean;
      service: boolean;
      status: string;
    };
  }> {
    try {
      const serviceOk = Boolean(this.monitorService);

      const systemMetrics = await this.monitorService.getSystemMetrics();
      const metricsOk = Boolean(systemMetrics);

      const healthy = serviceOk && metricsOk;

      return {
        healthy,
        message: healthy ? 'Monitor module is healthy' : 'Monitor module has issues',
        checks: {
          database: metricsOk,
          service: serviceOk,
          status: this.status.toLowerCase(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Monitor module health check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        checks: {
          database: false,
          service: false,
          status: this.status.toLowerCase(),
        },
      };
    }
  }

  /**
   * Get module information.
   * @returns Module information.
   */
  public getInfo(): {
    name: string;
    version: string;
    type: string;
    status: string;
    description: string;
    dependencies: readonly string[];
  } {
    return {
      name: this.name,
      version: this.version,
      type: this.type,
      status: this.status.toLowerCase(),
      description: this.description,
      dependencies: this.dependencies,
    };
  }

  /**
   * Start the monitor module.
   * @returns Promise that resolves when the module is started.
   */
  public async start(): Promise<void> {
    const { status } = this;
    if (status === RUNNING) {
      return;
    }

    try {
      const { initialized } = this;
      if (!initialized) {
        await this.initialize();
      }

      this.status = RUNNING;
    } catch (error) {
      this.status = ERROR;
      throw error;
    }
  }

  /**
   * Stop the monitor module.
   * @returns Promise that resolves when the module is stopped.
   */
  public async stop(): Promise<void> {
    const { status } = this;
    if (status === STOPPED) {
      return;
    }

    try {
      this.status = STOPPED;
      await Promise.resolve();
    } catch (error) {
      this.status = ERROR;
      throw error;
    }
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
    await Promise.resolve();
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
