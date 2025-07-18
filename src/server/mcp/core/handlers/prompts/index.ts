/**
 * @fileoverview Central registry for all coding prompts
 * @module handlers/prompts
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';
import { BUGFIXING_PROMPTS } from './bug-fixing.js';
import { UNITTESTING_PROMPTS } from './unit-testing.js';
import { REACTCOMPONENT_PROMPTS } from './react-components.js';
import { REDDITPOST_PROMPTS } from './reddit-post.js';

/**
 * All available coding prompts organized by category
 * Limited to one prompt per category for simplicity
 */
export const CODINGPROMPTS: Prompt[] = [
  ...BUGFIXING_PROMPTS,
  ...UNITTESTING_PROMPTS,
  ...REACTCOMPONENT_PROMPTS,
  ...REDDITPOST_PROMPTS,
];

/**
 * Export individual prompt categories for direct access
 */
export {
  BUGFIXING_PROMPTS,
  UNITTESTING_PROMPTS,
  REACTCOMPONENT_PROMPTS,
  REDDITPOST_PROMPTS,
};