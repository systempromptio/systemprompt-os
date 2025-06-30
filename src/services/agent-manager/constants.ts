/**
 * @file Constants for Agent Manager service
 * @module services/agent-manager/constants
 */

export const SESSION_ID_PREFIXES = {
  CLAUDE: 'agent_claude_'
} as const;

export const LOG_PREFIXES = {
  SESSION_CREATED: '',
  SESSION_CONTEXT: '',
  SESSION_ENDING: '',
  SESSION_TERMINATED: '',
  SESSION_ERROR: 'Error:',
  COMMAND_SENT: '',
  COMMAND_ERROR: 'Error:',
  RESPONSE_RECEIVED: '',
  RESPONSE_PREVIEW: ''
} as const;

export const DEFAULT_MAX_TURNS = 30;
export const RESPONSE_PREVIEW_LENGTH = 500;

export const ERROR_CODES = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  UNKNOWN_SESSION_TYPE: 'UNKNOWN_SESSION_TYPE',
  COMMAND_FAILED: 'COMMAND_FAILED'
} as const;