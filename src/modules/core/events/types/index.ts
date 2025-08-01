/**
 * Events module types index.
 * 
 * TEMPORARY: This file re-exports types to maintain backward compatibility
 * with existing imports across the codebase. According to module rules,
 * direct imports should be preferred, but this maintains system stability.
 */

export type {
  IEventBus,
  IEventHandler,
  IEventsModuleExports,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  UserStatusChangedEvent,
  UserDataRequestEvent,
  UserDataResponseEvent,
  UserCreateOAuthRequestEvent,
  UserCreateOAuthResponseEvent,
  LoginSuccessEvent,
  LoginFailedEvent,
  LogoutEvent,
  SessionCreatedEvent,
  SessionExpiredEvent,
  TokenCreatedEvent,
  TokenRevokedEvent,
  DevReportRequestEvent
} from '@/modules/core/events/types/manual';

export {
  EventNames,
  UserEvents,
  AuthEvents,
  DevEvents
} from '@/modules/core/events/types/manual';

export type {
  IEventsRow,
  IEventSubscriptionsRow
} from '@/modules/core/events/types/database.generated';
