/**
 * @fileoverview MCP resource definitions and server information
 * @module constants/resources
 * @since 1.0.0
 */

import type { Resource } from "@modelcontextprotocol/sdk/types.js";

/**
 * Available MCP resources
 * @since 1.0.0
 */
export const RESOURCES: Resource[] = [
  {
    uri: "agent://status",
    name: "Status",
    mimeType: "application/json",
    description: "Current status and capabilities of the coding agent",
  },
  {
    uri: "agent://tasks",
    name: "Tasks",
    mimeType: "application/json",
    description: "List of all managed tasks",
  },
];

/**
 * MCP server information
 * @since 1.0.0
 */
export const SERVER_INFO = {
  /**
   * Server display name
   * @since 1.0.0
   */
  name: "Coding Agent MCP Server",
  
  /**
   * Server version
   * @since 1.0.0
   */
  version: "1.0.0",
  
  /**
   * Server description
   * @since 1.0.0
   */
  description: "Orchestrator for Claude Code and Gemini CLI",
};
