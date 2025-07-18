/**
 * @file Resource constants for the MCP server
 * @module constants/resources
 * 
 * @remarks
 * This module defines available resources that can be accessed
 * through the MCP protocol.
 * 
 * @see {@link https://modelcontextprotocol.io/specification/2025-06-18/core/resources | MCP Resources Specification}
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';

/**
 * Resource definitions for the MCP server
 * 
 * @remarks
 * Replace these with your own resource definitions.
 * Resources provide read-only access to data.
 */
export const RESOURCES: Resource[] = [
  {
    uri: "template://example",
    name: "Example Resource",
    description: "An example resource demonstrating the resource pattern",
    mimeType: "text/plain",
  },
  {
    uri: "template://config",
    name: "Template Configuration",
    description: "Template server configuration and settings",
    mimeType: "application/json",
  },
  {
    uri: "template://guidelines",
    name: "Template Guidelines",
    description: "Guidelines for using this MCP server template",
    mimeType: "text/markdown",
  },
];