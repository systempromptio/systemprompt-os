/**
 * @fileoverview Type definitions for the prompts module
 * @module prompts/types
 */

import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Database representation of a prompt
 */
export interface DBPrompt {
  id: number;
  name: string;
  description: string;
  arguments?: string;
  messages: string;
  created_at: string;
  updated_at: string;
}

/**
 * Prompt argument definition
 */
export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Extended prompt type that includes messages
 */
export interface PromptWithMessages extends Prompt {
  messages: PromptMessage[];
}

/**
 * Data required to create a new prompt
 */
export interface CreatePromptData {
  name: string;
  description: string;
  arguments?: PromptArgument[];
  messages: PromptMessage[];
}

/**
 * Data for updating an existing prompt
 */
export interface UpdatePromptData {
  description?: string;
  arguments?: PromptArgument[];
  messages?: PromptMessage[];
}