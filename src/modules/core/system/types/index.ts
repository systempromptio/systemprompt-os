/**
 * Configuration type enumeration.
 */
export const enum ConfigTypeEnum {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json'
}

/**
 * Module status enumeration.
 */
export const enum ModuleStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

/**
 * Event severity enumeration.
 */
export const enum EventSeverityEnum {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Maintenance type enumeration.
 */
export const enum MaintenanceTypeEnum {
  SCHEDULED = 'scheduled',
  EMERGENCY = 'emergency'
}

/**
 * System configuration entity.
 */
export interface ISystemConfig {
  key: string;
  value: string;
  type: ConfigTypeEnum;
  description?: string;
  isSecret: boolean;
  isReadonly: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * System module entity.
 */
export interface ISystemModule {
  name: string;
  version: string;
  status: ModuleStatusEnum;
  enabled: boolean;
  metadata?: Record<string, unknown>;
  initializedAt?: Date;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * System event entity.
 */
export interface ISystemEvent {
  id: number;
  eventType: string;
  source: string;
  severity: EventSeverityEnum;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * System maintenance entity.
 */
export interface ISystemMaintenance {
  id: string;
  type: MaintenanceTypeEnum;
  reason: string;
  startedAt: Date;
  endedAt?: Date;
  createdBy?: string;
  notes?: string;
}

/**
 * System information.
 */
export interface ISystemInfo {
  version: string;
  uptime: number;
  hostname: string;
  platform: string;
  architecture: string;
  nodeVersion: string;
  environment: string;
  modules: {
    total: number;
    active: number;
    inactive: number;
    error: number;
  };
}

/**
 * System health status.
 */
export interface ISystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail';
    message?: string;
    duration?: number;
  }>;
  timestamp: Date;
}

/**
 * System service interface.
 */
export interface ISystemService {
  getConfig(key: string): Promise<string | null>;
  setConfig(key: string, value: string, type: ConfigTypeEnum): Promise<void>;
  deleteConfig(key: string): Promise<void>;
  registerModule(name: string, version: string): Promise<ISystemModule>;
  updateModuleStatus(name: string, status: ModuleStatusEnum): Promise<void>;
  getSystemInfo(): Promise<ISystemInfo>;
  checkHealth(): Promise<ISystemHealth>;
  logEvent(
    eventType: string,
    source: string,
    severity: EventSeverityEnum,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;
  startMaintenance(type: MaintenanceTypeEnum, reason: string): Promise<ISystemMaintenance>;
  endMaintenance(id: string): Promise<void>;
}
