/**
 * Session State Types - STUB IMPLEMENTATION
 * TODO: Define proper session state types
 */

export const SessionStates = {
  IDLE: 'idle',
  ACTIVE: 'active',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export type SessionState = typeof SessionStates[keyof typeof SessionStates];

export interface SessionContext {
  id: string;
  state: SessionState;
  metadata?: Record<string, any>;
}