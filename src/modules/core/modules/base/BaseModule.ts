/**
 * Base module abstract class that provides common functionality for all modules.
 * @file BaseModule - Abstract base class for all system modules.
 * @module modules/base
 */

import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import type {HealthStatus, ModulesType} from '@/modules/core/modules/types/index';
import {
  BaseModuleSchema,
  type IModule,
  ModulesStatus,
  createModuleSchema
} from '@/modules/core/modules/types/index';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Abstract base class for all modules in the system.
 * Provides common validation, lifecycle management, and error handling.
 * @template TExports - The type of exports this module provides.
 */
export abstract class BaseModule<TExports = unknown> implements IModule<TExports> {
  // Required abstract properties that each module must define
  public abstract readonly name: string;
  public abstract readonly type: ModulesType;
  public abstract readonly version: string;
  public abstract readonly description: string;
  public abstract readonly dependencies?: readonly string[];

  // Common state management
  public status: ModulesStatus = ModulesStatus.PENDING;
  private logger!: ILogger;
  protected initialized = false;

  // Abstract methods that each module must implement
  public abstract get exports(): TExports;

  /**
   * Get the Zod schema for validating this module's exports.
   * Each module must define its own export schema.
   */
  protected abstract getExportsSchema(): ZodSchema<TExports>;

  /**
   * Get the full Zod schema for validating this specific module.
   * Override this to add module-specific validation beyond the base schema.
   */
  protected getModuleSchema(): ZodSchema<this> {
    return createModuleSchema(this.getExportsSchema()) as unknown as ZodSchema<this>;
  }

  /**
   * Module-specific initialization logic.
   * Called by the base initialize() method after common setup.
   */
  protected abstract initializeModule(): Promise<void>;

  /**
   * Initialize the module with common setup and validation.
   * @throws {Error} If the module is already initialized or initialization fails.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error(`${this.name} module already initialized`);
    }

    this.logger = LoggerService.getInstance();

    try {
      this.status = ModulesStatus.INITIALIZING;

      this.validateIModuleImplementation();

      await this.initializeModule();

      this.initialized = true;
      this.status = ModulesStatus.RUNNING;
      this.logger.info(this.getLogSource(), `${this.name} module initialized and ready`);
    } catch (error) {
      this.status = ModulesStatus.ERROR;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(this.getLogSource(), `Failed to initialize ${this.name} module`, { error: errorMessage });
      throw new Error(`Failed to initialize ${this.name} module: ${errorMessage}`);
    }
  }

  /**
   * Start the module operations. Optional method - required for critical modules.
   * Default implementation does nothing. Override in subclasses that need start logic.
   */
  public async start?(): Promise<void> {
    this.logger?.debug?.(this.getLogSource(), `${this.name} module start() called (no-op)`);
  }

  /**
   * Stop the module and cleanup resources. Optional method.
   * Default implementation does nothing. Override in subclasses that need cleanup.
   */
  public async stop?(): Promise<void> {
    this.logger?.debug?.(this.getLogSource(), `${this.name} module stop() called (no-op)`);
  }

  /**
   * Health check for the module. Optional method.
   * Default implementation returns healthy. Override for custom health checks.
   */
  public async health?(): Promise<HealthStatus> {
    return {
      status: this.status === ModulesStatus.RUNNING ? 'healthy' : 'unhealthy',
      message: `${this.name} module status: ${this.status}`
    };
  }

  /**
   * Validate that this class properly implements IModule interface using Zod.
   * @throws {Error} If IModule interface validation fails.
   */
  protected validateIModuleImplementation(): void {
    try {
      BaseModuleSchema.parse(this);
      this.logger?.debug?.(this.getLogSource(), `${this.name} module IModule implementation validation passed`);
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map(issue =>
          { return `${issue.path.join('.')}: ${issue.message}` }).join(', ');
        this.logger?.error(this.getLogSource(), `${this.name} module IModule validation failed`, { issues });
        throw new Error(`${this.name} module IModule validation failed: ${issues}`);
      }
      throw new Error(`${this.name} module IModule validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate module-specific requirements using the module's schema.
   * @throws {Error} If module validation fails.
   */
  protected validateModuleSpecific(): void {
    try {
      const schema = this.getModuleSchema();
      schema.parse(this);
      this.logger?.debug?.(this.getLogSource(), `${this.name} module specific validation passed`);
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map(issue =>
          { return `${issue.path.join('.')}: ${issue.message}` }).join(', ');
        this.logger?.error(this.getLogSource(), `${this.name} module specific validation failed`, { issues });
        throw new Error(`${this.name} module specific validation failed: ${issues}`);
      }
      throw new Error(`${this.name} module validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Comprehensive validation of both IModule implementation and module-specific requirements.
   * @throws {Error} If any validation fails.
   */
  public validateModule(): void {
    this.validateIModuleImplementation();

    this.validateModuleSpecific();

    this.validateExports();

    this.logger?.debug?.(this.getLogSource(), `Complete ${this.name} module validation passed`);
  }

  /**
   * Validate module exports using Zod.
   * @throws {Error} If exports validation fails.
   */
  protected validateExports(): void {
    try {
      const schema = this.getExportsSchema();
      schema.parse(this.exports);
      this.logger?.debug?.(this.getLogSource(), `${this.name} module exports validation passed`);
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map(issue =>
          { return `${issue.path.join('.')}: ${issue.message}` }).join(', ');
        this.logger?.error(this.getLogSource(), `${this.name} module exports validation failed`, { issues });
        throw new Error(`${this.name} module exports validation failed: ${issues}`);
      }
      throw new Error(`${this.name} module exports validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure module is initialized before operations.
   * @throws {Error} If module is not initialized.
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`${this.name} module not initialized`);
    }
  }

  /**
   * Get the log source for this module.
   * Override to provide a custom log source.
   */
  protected getLogSource(): LogSource {
    return LogSource.SYSTEM;
  }

  /**
   * Validate that a service has required methods using Zod.
   * Note: This validates the shape/structure, not the full service instance.
   * @param service - The service instance to validate.
   * @param schema - Zod schema that validates required methods exist.
   * @param serviceName - Name for error messages.
   * @returns The original service instance if validation passes.
   */
  protected validateServiceStructure<T>(service: T, schema: ZodSchema, serviceName: string): T {
    try {
      schema.parse(service);
      return service;
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map(issue =>
          { return `${issue.path.join('.')}: ${issue.message}` }).join(', ');
        this.logger?.error(this.getLogSource(), `${serviceName} structure validation failed`, { issues });
        throw new Error(`${serviceName} structure validation failed: ${issues}`);
      }
      throw new Error(`${serviceName} validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Factory function to create a module with full validation.
 * @param ModuleClass - The module class constructor.
 * @returns A new instance of the module.
 */
export function createValidatedModule<T extends IModule>(
  ModuleClass: new () => T
): T {
  const module = new ModuleClass();

  if ('validateModule' in module && typeof module.validateModule === 'function') {
    module.validateModule();
  }

  return module;
}
