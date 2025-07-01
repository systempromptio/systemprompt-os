/**
 * @fileoverview Utility to check if AI tools are available based on environment variables
 * @module utils/tool-availability
 * @since 1.0.0
 * 
 * @remarks
 * This module provides utilities for checking the availability of AI tools
 * (Claude Code and Gemini CLI) based on environment variable configuration.
 * It helps ensure the application can gracefully handle scenarios where
 * one or more AI tools are not available.
 * 
 * @example
 * ```typescript
 * import { validateToolsAvailable, getAvailableTools } from './utils/tool-availability';
 * 
 * // Check if at least one tool is available
 * try {
 *   validateToolsAvailable();
 * } catch (error) {
 *   console.error('No AI tools configured:', error.message);
 * }
 * 
 * // Get list of available tools
 * const tools = getAvailableTools();
 * console.log('Available tools:', tools);
 * ```
 */

/**
 * Represents the availability status of AI tools
 * 
 * @interface ToolAvailability
 * @since 1.0.0
 */
export interface ToolAvailability {
  /**
   * Whether Claude Code CLI is available
   */
  claude: boolean;
  
  /**
   * Whether Gemini CLI is available
   */
  gemini: boolean;
}

/**
 * Get the availability status of AI tools from environment variables
 * 
 * @returns Object indicating which tools are available
 * @since 1.0.0
 * 
 * @remarks
 * Checks the following environment variables:
 * - CLAUDE_AVAILABLE: Set to 'true' if Claude Code is available
 * - GEMINI_AVAILABLE: Set to 'true' if Gemini CLI is available
 * 
 * @example
 * ```typescript
 * const availability = getToolAvailability();
 * if (availability.claude) {
 *   console.log('Claude Code is available');
 * }
 * ```
 */
export function getToolAvailability(): ToolAvailability {
  return {
    claude: process.env.CLAUDE_AVAILABLE === 'true',
    gemini: process.env.GEMINI_AVAILABLE === 'true'
  };
}

/**
 * Check if a specific tool is available
 * 
 * @param tool - The tool identifier to check
 * @returns True if the tool is available, false otherwise
 * @since 1.0.0
 * 
 * @example
 * ```typescript
 * if (isToolAvailable('CLAUDECODE')) {
 *   // Create task with Claude Code
 * } else if (isToolAvailable('GEMINICLI')) {
 *   // Fall back to Gemini CLI
 * }
 * ```
 */
export function isToolAvailable(tool: 'CLAUDECODE' | 'GEMINICLI'): boolean {
  const availability = getToolAvailability();
  
  switch (tool) {
    case 'CLAUDECODE':
      return availability.claude;
    case 'GEMINICLI':
      return availability.gemini;
    default:
      return false;
  }
}

/**
 * Get available tools as an array
 * 
 * @returns Array of available tool identifiers
 * @since 1.0.0
 * 
 * @example
 * ```typescript
 * const tools = getAvailableTools();
 * // Returns: ['CLAUDECODE', 'GEMINICLI'] if both are available
 * // Returns: ['CLAUDECODE'] if only Claude is available
 * // Returns: [] if no tools are available
 * ```
 */
export function getAvailableTools(): Array<'CLAUDECODE' | 'GEMINICLI'> {
  const tools: Array<'CLAUDECODE' | 'GEMINICLI'> = [];
  const availability = getToolAvailability();
  
  if (availability.claude) {
    tools.push('CLAUDECODE');
  }
  if (availability.gemini) {
    tools.push('GEMINICLI');
  }
  
  return tools;
}

/**
 * Validate that at least one tool is available
 * 
 * @throws {Error} If no AI tools are available
 * @since 1.0.0
 * 
 * @remarks
 * This function should be called during application startup to ensure
 * at least one AI tool is configured. It provides a clear error message
 * if no tools are available.
 * 
 * @example
 * ```typescript
 * // In server initialization
 * try {
 *   validateToolsAvailable();
 *   console.log('AI tools validated successfully');
 * } catch (error) {
 *   console.error('Startup failed:', error.message);
 *   process.exit(1);
 * }
 * ```
 */
export function validateToolsAvailable(): void {
  const availability = getToolAvailability();
  
  if (!availability.claude && !availability.gemini) {
    throw new Error('No AI tools are available. At least one of Claude or Gemini must be configured.');
  }
}