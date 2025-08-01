/**
 * Manual types for events module - minimally justified types that cannot be auto-generated.
 * JUSTIFICATION: Event payload types and interfaces need manual definition as they represent
 * domain-specific data structures that cross module boundaries and cannot be inferred from database schema.
 */

/**
 * Event bus interface for inter-module communication.
 * JUSTIFICATION: Core event bus contract that other modules depend on.
 */
export interface IEventBus {
    emit(event: string, data: unknown): void;
    on(event: string, handler: (data: unknown) => void | Promise<void>): () => void;
    off(event: string, handler: (data: unknown) => void | Promise<void>): void;
    once(event: string, handler: (data: unknown) => void | Promise<void>): void;
}

/**
 * Event handler interface.
 * JUSTIFICATION: Type safety for event handler functions across modules.
 */
export interface IEventHandler {
  (data: unknown): void | Promise<void>;
}

/**
 * Event names enumeration for all system events.
 * JUSTIFICATION: Centralized event name registry to prevent typos and ensure consistency.
 * Uses const enum for performance as these are compile-time constants.
 */
export const enum EventNames {
  // Task Events
  TASK_CREATED = 'task.created',
  TASK_ASSIGNED = 'task.assigned',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_STATUS_CHANGED = 'task.status.changed',
  TASK_UPDATED = 'task.updated',
  TASK_CANCELLED = 'task.cancelled',

  // Agent Events
  AGENT_CREATED = 'agent.created',
  AGENT_STARTED = 'agent.started',
  AGENT_STOPPED = 'agent.stopped',
  AGENT_AVAILABLE = 'agent.available',
  AGENT_BUSY = 'agent.busy',
  AGENT_IDLE = 'agent.idle',
  AGENT_DELETED = 'agent.deleted',
  AGENT_STATUS_CHANGED = 'agent.status.changed',

  // User Events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_STATUS_CHANGED = 'user.status.changed',

  // Auth Events
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  SESSION_CREATED = 'auth.session.created',
  SESSION_EXPIRED = 'auth.session.expired',
  TOKEN_CREATED = 'auth.token.created',
  TOKEN_REVOKED = 'auth.token.revoked',
}

/**
 * Events module exports interface.
 * JUSTIFICATION: Defines the contract that other modules can expect from the events module.
 */
export interface IEventsModuleExports {
  eventBus: IEventBus;
  EventNames: typeof EventNames;
}

/**
 * Event payload interfaces.
 * JUSTIFICATION: Type safety for event data structures passed between modules.
 */

// User event payloads
export interface UserCreatedEvent {
  userId: string;
  username: string;
  email: string;
  timestamp: Date;
}

export interface UserUpdatedEvent {
  userId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
}

export interface UserDeletedEvent {
  userId: string;
  timestamp: Date;
}

export interface UserStatusChangedEvent {
  userId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: Date;
}

export interface UserDataRequestEvent {
  requestId: string;
  username?: string;
  email?: string;
  userId?: string;
}

export interface UserDataResponseEvent {
  requestId: string;
  user: {
    id: string;
    username: string;
    email: string;
    status: string;
    emailVerified: boolean;
  } | null;
}

export interface UserCreateOAuthRequestEvent {
  requestId: string;
  provider: string;
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface UserCreateOAuthResponseEvent {
  requestId: string;
  success: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string;
    roles: string[];
  };
  error?: string;
}

// Auth event payloads
export interface LoginSuccessEvent {
  userId: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface LoginFailedEvent {
  username?: string;
  email?: string;
  reason: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface LogoutEvent {
  userId: string;
  sessionId: string;
  timestamp: Date;
}

export interface SessionCreatedEvent {
  sessionId: string;
  userId: string;
  type: 'web' | 'api' | 'oauth';
  expiresAt: Date;
  timestamp: Date;
}

export interface SessionExpiredEvent {
  sessionId: string;
  userId: string;
  timestamp: Date;
}

export interface TokenCreatedEvent {
  tokenId: string;
  userId: string;
  type: 'api' | 'personal' | 'service';
  name: string;
  expiresAt?: Date;
  timestamp: Date;
}

export interface TokenRevokedEvent {
  tokenId: string;
  userId: string;
  reason?: string;
  timestamp: Date;
}

/**
 * User Events enumeration for user-related events.
 * Uses const enum for performance as these are compile-time constants.
 */
export const enum UserEvents {
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_STATUS_CHANGED = 'user.status.changed',
  USER_DATA_REQUEST = 'user.data.request',
  USER_DATA_RESPONSE = 'user.data.response',
  USER_CREATE_OAUTH_REQUEST = 'user.create.oauth.request',
  USER_CREATE_OAUTH_RESPONSE = 'user.create.oauth.response',
}

/**
 * Auth Events enumeration for authentication-related events.
 * Uses const enum for performance as these are compile-time constants.
 */
export const enum AuthEvents {
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  SESSION_CREATED = 'auth.session.created',
  SESSION_EXPIRED = 'auth.session.expired',
  SESSION_REVOKED = 'auth.session.revoked',
  TOKEN_CREATED = 'auth.token.created',
  TOKEN_REVOKED = 'auth.token.revoked',
  PASSWORD_CHANGED = 'auth.password.changed',
  PASSWORD_RESET_REQUESTED = 'auth.password.reset.requested',
  MFA_ENABLED = 'auth.mfa.enabled',
  MFA_DISABLED = 'auth.mfa.disabled',
}

/**
 * Dev Events enumeration for development-related events.
 * Uses const enum for performance as these are compile-time constants.
 */
export const enum DevEvents {
  REPORT_WRITE_REQUEST = 'dev.report.write.request',
}

/**
 * Dev report event payloads.
 */
export interface DevReportRequestEvent {
  requestId: string;
  report: {
    timestamp: string;
    command: 'lint' | 'typecheck' | 'test';
    module?: string;
    target?: string;
    success: boolean;
    duration: number;
    [key: string]: unknown;
  };
}