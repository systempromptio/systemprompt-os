/**
 * Development profile interface.
 */
export interface IDevProfile {
  id: number;
  name: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Development session types.
 */
export const enum DevSessionType {
  REPL = 'repl',
  PROFILE = 'profile',
  TEST = 'test',
  WATCH = 'watch',
  LINT = 'lint',
  TYPECHECK = 'typecheck'
}

/**
 * Development session status types.
 */
export const enum DevSessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Development session interface.
 */
export interface IDevSession {
  id: number;
  profileId?: number;
  type: DevSessionType;
  status: DevSessionStatus;
  startedAt: Date;
  endedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Development service interface.
 */
export interface IDevService {
  initialize(): Promise<void>;
  createProfile(name: string, config?: Record<string, unknown>): Promise<IDevProfile>;
  getProfile(name: string): Promise<IDevProfile | null>;
  startSession(type: DevSessionType, profileId?: number): Promise<IDevSession>;
  endSession(sessionId: number, status: DevSessionStatus): Promise<void>;
}

import type { DevService } from '@/modules/core/dev/services/dev.service';

/**
 * Strongly typed exports interface for Dev module.
 */
export interface IDevModuleExports {
  readonly service: () => DevService;
}

/**
 * Module generator options.
 */
export interface IModuleGeneratorOptions {
  name: string;
  type: 'service' | 'utility' | 'integration';
  description: string;
  needsDatabase: boolean;
  needsCli: boolean;
  dependencies: string[];
  isCustom?: boolean;
}

/**
 * Module file template.
 */
export interface IModuleFileTemplate {
  path: string;
  content: string;
}

/**
 * Module generator service interface.
 */
export interface IModuleGeneratorService {
  generateModule(options: IModuleGeneratorOptions): Promise<void>;
  validateModuleName(name: string): boolean;
  getModulePath(name: string, isCustom?: boolean): string;
}
