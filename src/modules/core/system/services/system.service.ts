/* eslint-disable
  logical-assignment-operators,
  @typescript-eslint/no-unnecessary-condition,
  @typescript-eslint/strict-boolean-expressions,
  systemprompt-os/no-block-comments
*/
/**
 * System service implementation - manages system configuration and health.
 * @file System service implementation.
 * @module system/services
 * Provides business logic for system management operations.
 */

import { randomUUID } from 'crypto';
import * as os from 'os';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { SystemRepository } from '@/modules/core/system/repositories/system-repository';
import {
  type ConfigTypeEnum,
  EventSeverityEnum,
  type ISystemHealth,
  type ISystemInfo,
  type ISystemMaintenance,
  type ISystemModule,
  type ISystemService,
  type MaintenanceTypeEnum,
  type ModuleStatusEnum
} from '@/modules/core/system/types/index';

const MILLISECONDS_PER_SECOND = 1000;

/**
 * Service for managing system configuration and health.
 */
export class SystemService implements ISystemService {
  private static instance: SystemService;
  private readonly repository: SystemRepository;
  private logger?: ILogger;
  private initialized = false;
  private readonly startTime: Date;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.repository = SystemRepository.getInstance();
    this.startTime = new Date();
  }

  /**
   * Get singleton instance.
   * @returns The system service instance.
   */
  static getInstance(): SystemService {
    if (!SystemService.instance) {
      SystemService.instance = new SystemService();
    }
    return SystemService.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.repository.initialize();
    await this.initializeDefaults();
    this.initialized = true;
    this.logger?.info(LogSource.SYSTEM, 'SystemService initialized');
  }

  /**
   * Get configuration value.
   * @param key - The configuration key.
   * @returns Promise that resolves to the value or null if not found.
   */
  async getConfig(key: string): Promise<string | null> {
    await this.ensureInitialized();
    const config = await this.repository.findConfigByKey(key);
    return config?.value ?? null;
  }

  /**
   * Set configuration value.
   * @param key - The configuration key.
   * @param value - The configuration value.
   * @param type - The value type.
   * @returns Promise that resolves when set.
   */
  async setConfig(key: string, value: string, type: ConfigTypeEnum): Promise<void> {
    await this.ensureInitialized();

    const existing = await this.repository.findConfigByKey(key);
    if (existing?.isReadonly) {
      throw new Error(`Configuration ${key} is read-only`);
    }

    this.logger?.info(LogSource.SYSTEM, `Setting system config: ${key}`);
    await this.repository.upsertConfig(key, value, type);

    await this.logEvent(
      'config.changed',
      'system',
      EventSeverityEnum.INFO,
      `Configuration ${key} updated`
    );
  }

  /**
   * Delete configuration value.
   * @param key - The configuration key.
   * @returns Promise that resolves when deleted.
   */
  async deleteConfig(key: string): Promise<void> {
    await this.ensureInitialized();

    const existing = await this.repository.findConfigByKey(key);
    if (existing?.isReadonly) {
      throw new Error(`Configuration ${key} is read-only`);
    }

    this.logger?.info(LogSource.SYSTEM, `Deleting system config: ${key}`);
    await this.repository.deleteConfig(key);

    await this.logEvent(
      'config.deleted',
      'system',
      EventSeverityEnum.INFO,
      `Configuration ${key} deleted`
    );
  }

  /**
   * Register a module.
   * @param name - The module name.
   * @param version - The module version.
   * @returns Promise that resolves to the registered module.
   */
  async registerModule(name: string, version: string): Promise<ISystemModule> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.SYSTEM, `Registering module: ${name} v${version}`);
    const module = await this.repository.upsertModule(name, version);

    await this.logEvent(
      'module.registered',
      'system',
      EventSeverityEnum.INFO,
      `Module ${name} v${version} registered`
    );

    return module;
  }

  /**
   * Update module status.
   * @param name - The module name.
   * @param status - The new status.
   * @returns Promise that resolves when updated.
   */
  async updateModuleStatus(name: string, status: ModuleStatusEnum): Promise<void> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.SYSTEM, `Updating module status: ${name} -> ${status}`);
    await this.repository.updateModuleStatus(name, status);

    await this.logEvent(
      'module.status_changed',
      'system',
      status === 'error' ? EventSeverityEnum.ERROR : EventSeverityEnum.INFO,
      `Module ${name} status changed to ${status}`
    );
  }

  /**
   * Get system information.
   * @returns Promise that resolves to system info.
   */
  async getSystemInfo(): Promise<ISystemInfo> {
    await this.ensureInitialized();

    const modules = await this.repository.findAllModules();
    const moduleCounts = {
      total: modules.length,
      active: modules.filter(m => { return m.status === 'active' }).length,
      inactive: modules.filter(m => { return m.status === 'inactive' }).length,
      error: modules.filter(m => { return m.status === 'error' }).length
    };

    const uptime = Math.floor(
      (new Date().getTime() - this.startTime.getTime()) / MILLISECONDS_PER_SECOND
    );

    return {
      version: process.env.SYSTEMPROMPT_VERSION ?? '1.0.0',
      uptime,
      hostname: os.hostname(),
      platform: os.platform(),
      architecture: os.arch(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? 'development',
      modules: moduleCounts
    };
  }

  /**
   * Check system health.
   * @returns Promise that resolves to health status.
   */
  async checkHealth(): Promise<ISystemHealth> {
    await this.ensureInitialized();

    const checks = [];
    const startTime = Date.now();

    try {
      await this.repository.checkDatabase();
      checks.push({
        name: 'database',
        status: 'pass' as const,
        duration: Date.now() - startTime
      });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'fail' as const,
        message: String(error),
        duration: Date.now() - startTime
      });
    }

    const modules = await this.repository.findAllModules();
    const errorModules = modules.filter(m => { return m.status === 'error' });

    if (errorModules.length === 0) {
      checks.push({
        name: 'modules',
        status: 'pass' as const
      });
    } else {
      checks.push({
        name: 'modules',
        status: 'fail' as const,
        message: `${errorModules.length} modules in error state`
      });
    }

    const hasFailures = checks.some(c => { return c.status === 'fail' });
    const status = hasFailures ? 'unhealthy' : 'healthy';

    return {
      status,
      checks,
      timestamp: new Date()
    };
  }

  /**
   * Log a system event.
   * @param eventType - The event type.
   * @param source - The event source.
   * @param severity - The event severity.
   * @param message - The event message.
   * @param metadata - Optional metadata.
   * @returns Promise that resolves when logged.
   */
  async logEvent(
    eventType: string,
    source: string,
    severity: EventSeverityEnum,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.ensureInitialized();
    await this.repository.createEvent(eventType, source, severity, message, metadata);
  }

  /**
   * Start maintenance mode.
   * @param type - The maintenance type.
   * @param reason - The maintenance reason.
   * @returns Promise that resolves to the maintenance record.
   */
  async startMaintenance(
    type: MaintenanceTypeEnum,
    reason: string
  ): Promise<ISystemMaintenance> {
    await this.ensureInitialized();

    const id = randomUUID();
    this.logger?.info(LogSource.SYSTEM, `Starting ${type} maintenance: ${reason}`);

    const maintenance = await this.repository.createMaintenance(id, type, reason);

    await this.logEvent(
      'maintenance.started',
      'system',
      EventSeverityEnum.WARNING,
      `${type} maintenance started: ${reason}`
    );

    return maintenance;
  }

  /**
   * End maintenance mode.
   * @param id - The maintenance ID.
   * @returns Promise that resolves when ended.
   */
  async endMaintenance(id: string): Promise<void> {
    await this.ensureInitialized();

    const maintenance = await this.repository.findMaintenanceById(id);
    if (!maintenance) {
      throw new Error(`Maintenance not found: ${id}`);
    }

    if (maintenance.endedAt) {
      throw new Error(`Maintenance already ended: ${id}`);
    }

    this.logger?.info(LogSource.SYSTEM, `Ending maintenance: ${id}`);
    await this.repository.endMaintenance(id);

    await this.logEvent(
      'maintenance.ended',
      'system',
      EventSeverityEnum.INFO,
      `Maintenance ended: ${maintenance.reason}`
    );
  }

  /**
   * Initialize default configurations.
   * @returns Promise that resolves when initialized.
   */
  private async initializeDefaults(): Promise<void> {
    const defaults = [
      {
 key: 'system.version',
value: '1.0.0',
type: 'string' as ConfigTypeEnum
},
      {
 key: 'system.environment',
value: 'development',
type: 'string' as ConfigTypeEnum
},
      {
 key: 'system.debug',
value: 'false',
type: 'boolean' as ConfigTypeEnum
}
    ];

    for (const config of defaults) {
      const existing = await this.repository.findConfigByKey(config.key);
      if (!existing) {
        await this.repository.upsertConfig(config.key, config.value, config.type);
      }
    }
  }

  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
