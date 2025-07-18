/**
 * @file Prompt constants for the MCP server
 * @module constants/prompts
 * 
 * @remarks
 * This module defines available prompts that can be used
 * through the MCP protocol.
 * 
 * @see {@link https://modelcontextprotocol.io/specification/2025-06-18/core/prompts | MCP Prompts Specification}
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Prompt definitions for the MCP server
 * 
 * @remarks
 * Replace these with your own prompt definitions.
 * Prompts provide reusable templates for common interactions.
 */
export const PROMPTS: Prompt[] = [
  {
    name: 'exampleprompt',
    description: 'An example prompt demonstrating the prompt pattern',
    arguments: [
      {
        name: 'topic',
        description: 'The topic to generate content about',
        required: true,
      },
      {
        name: 'style',
        description: 'The writing style to use',
        required: false,
      },
    ],
  },
  {
    name: 'templatehelp',
    description: 'Get help with using this MCP server template',
    arguments: [
      {
        name: 'area',
        description: 'The area you need help with (tools, resources, prompts, etc.)',
        required: false,
      },
    ],
  },
];