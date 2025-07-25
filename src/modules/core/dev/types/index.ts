/**
 * Development module type definitions.
 */

export interface IDevProfile {
  id: number;
  name: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDevSession {
  id: number;
  profileId?: number;
  type: DevSessionType;
  status: DevSessionStatus;
  startedAt: Date;
  endedAt?: Date;
  metadata?: Record<string, unknown>;
}

export enum DevSessionType {
  DEBUG = 'debug',
  REPL = 'repl',
  PROFILE = 'profile',
  TEST = 'test',
  WATCH = 'watch'
}

export enum DevSessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface IDevService {
  initialize(): Promise<void>;
  createProfile(name: string, config?: Record<string, unknown>): Promise<IDevProfile>;
  getProfile(name: string): Promise<IDevProfile | null>;
  startSession(type: DevSessionType, profileId?: number): Promise<IDevSession>;
  endSession(sessionId: number, status: DevSessionStatus): Promise<void>;
}
