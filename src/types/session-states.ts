/**
 * @fileoverview Shared session state definitions and mappings
 * @module types/session-states
 * 
 * @remarks
 * This file provides a unified interface for session states across the system,
 * mapping between Claude Code CLI states and internal system states.
 */

/**
 * Claude Code Service session states
 * @remarks
 * These states directly correspond to the Claude Code CLI's internal states
 */
export const CLAUDE_CODE_STATES = {
  /** Session is initializing */
  INITIALIZING: 'initializing',
  /** Session is ready to accept commands */
  READY: 'ready',
  /** Session is processing a command */
  BUSY: 'busy',
  /** Session encountered an error */
  ERROR: 'error',
  /** Session has been terminated */
  TERMINATED: 'terminated'
} as const;

/**
 * Claude Code state type
 */
export type ClaudeCodeState = typeof CLAUDE_CODE_STATES[keyof typeof CLAUDE_CODE_STATES];

/**
 * Agent Manager session states
 * @remarks
 * These states represent the system's view of agent sessions
 */
export const AGENT_STATES = {
  /** Agent is starting up */
  STARTING: 'starting',
  /** Agent is active and ready */
  ACTIVE: 'active',
  /** Agent is processing a request */
  BUSY: 'busy',
  /** Agent encountered an error */
  ERROR: 'error',
  /** Agent has been terminated */
  TERMINATED: 'terminated'
} as const;

/**
 * Agent state type
 */
export type AgentState = typeof AGENT_STATES[keyof typeof AGENT_STATES];

/**
 * Orchestrator session states
 * @remarks
 * Simplified states for external API reporting
 */
export const ORCHESTRATOR_STATES = {
  /** Session is active */
  ACTIVE: 'active',
  /** Session is busy */
  BUSY: 'busy',
  /** Session is terminated */
  TERMINATED: 'terminated'
} as const;

/**
 * Orchestrator state type
 */
export type OrchestratorState = typeof ORCHESTRATOR_STATES[keyof typeof ORCHESTRATOR_STATES];

/**
 * Maps Claude Code states to Agent Manager states
 */
export const CLAUDE_TO_AGENT_STATE_MAP: Record<ClaudeCodeState, AgentState> = {
  [CLAUDE_CODE_STATES.INITIALIZING]: AGENT_STATES.STARTING,
  [CLAUDE_CODE_STATES.READY]: AGENT_STATES.ACTIVE,
  [CLAUDE_CODE_STATES.BUSY]: AGENT_STATES.BUSY,
  [CLAUDE_CODE_STATES.ERROR]: AGENT_STATES.ERROR,
  [CLAUDE_CODE_STATES.TERMINATED]: AGENT_STATES.TERMINATED
};

/**
 * Maps Agent Manager states to Orchestrator states
 */
export const AGENT_TO_ORCHESTRATOR_STATE_MAP: Record<AgentState, OrchestratorState | null> = {
  [AGENT_STATES.STARTING]: null, // Not exposed in orchestrator
  [AGENT_STATES.ACTIVE]: ORCHESTRATOR_STATES.ACTIVE,
  [AGENT_STATES.BUSY]: ORCHESTRATOR_STATES.BUSY,
  [AGENT_STATES.ERROR]: null, // Not directly mapped
  [AGENT_STATES.TERMINATED]: ORCHESTRATOR_STATES.TERMINATED
};

/**
 * States that can accept new commands
 */
export const COMMAND_ACCEPTING_STATES: readonly AgentState[] = [
  AGENT_STATES.ACTIVE,
  AGENT_STATES.BUSY
] as const;

/**
 * Terminal states that cannot transition further
 */
export const TERMINAL_STATES: readonly AgentState[] = [
  AGENT_STATES.ERROR,
  AGENT_STATES.TERMINATED
] as const;

/**
 * Type guard to check if a state can accept commands
 * @param {AgentState} state - State to check
 * @returns {boolean} True if state can accept commands
 */
export function canAcceptCommands(state: AgentState): boolean {
  return COMMAND_ACCEPTING_STATES.includes(state);
}

/**
 * Type guard to check if a state is terminal
 * @param {AgentState} state - State to check
 * @returns {boolean} True if state is terminal
 */
export function isTerminalState(state: AgentState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * Convert Claude Code state to Agent Manager state
 * @param {ClaudeCodeState} claudeState - Claude Code state
 * @returns {AgentState} Corresponding Agent state
 */
export function claudeToAgentState(claudeState: ClaudeCodeState): AgentState {
  return CLAUDE_TO_AGENT_STATE_MAP[claudeState];
}

/**
 * Convert Agent Manager state to Orchestrator state
 * @param {AgentState} agentState - Agent Manager state
 * @returns {OrchestratorState | null} Corresponding Orchestrator state or null
 */
export function agentToOrchestratorState(agentState: AgentState): OrchestratorState | null {
  return AGENT_TO_ORCHESTRATOR_STATE_MAP[agentState];
}

/**
 * Session state transition validation
 * @param {AgentState} from - Current state
 * @param {AgentState} to - Target state
 * @returns {boolean} True if transition is valid
 * @example
 * ```typescript
 * if (isValidStateTransition(currentState, newState)) {
 *   // Perform transition
 * }
 * ```
 */
export function isValidStateTransition(from: AgentState, to: AgentState): boolean {
  // Terminal states cannot transition
  if (isTerminalState(from)) {
    return false;
  }

  // Define valid transitions
  const validTransitions: Record<AgentState, AgentState[]> = {
    [AGENT_STATES.STARTING]: [AGENT_STATES.ACTIVE, AGENT_STATES.ERROR, AGENT_STATES.TERMINATED],
    [AGENT_STATES.ACTIVE]: [AGENT_STATES.BUSY, AGENT_STATES.ERROR, AGENT_STATES.TERMINATED],
    [AGENT_STATES.BUSY]: [AGENT_STATES.ACTIVE, AGENT_STATES.ERROR, AGENT_STATES.TERMINATED],
    [AGENT_STATES.ERROR]: [AGENT_STATES.TERMINATED],
    [AGENT_STATES.TERMINATED]: []
  };

  return validTransitions[from]?.includes(to) ?? false;
}