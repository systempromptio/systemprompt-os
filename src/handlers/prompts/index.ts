/**
 * @fileoverview Central registry for all coding prompts
 * @module handlers/prompts
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';
import { BUG_FIXING_PROMPTS } from './bug-fixing.js';
import { UNIT_TESTING_PROMPTS } from './unit-testing.js';
import { REACT_COMPONENT_PROMPTS } from './react-components.js';
import { REDDIT_POST_PROMPTS } from './reddit-post.js';

/**
 * All available coding prompts organized by category
 * Limited to one prompt per category for simplicity
 */
export const CODING_PROMPTS: Prompt[] = [
  ...BUG_FIXING_PROMPTS,
  ...UNIT_TESTING_PROMPTS,
  ...REACT_COMPONENT_PROMPTS,
  ...REDDIT_POST_PROMPTS,
];

/**
 * Export individual prompt categories for direct access
 */
export {
  BUG_FIXING_PROMPTS,
  UNIT_TESTING_PROMPTS,
  REACT_COMPONENT_PROMPTS,
  REDDIT_POST_PROMPTS,
};