/**
 * @fileoverview MCP resource definitions and server information
 * @module constants/resources
 */

import type { Resource } from "@modelcontextprotocol/sdk/types.js";

/**
 * Available MCP resources
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
 */
export const SERVER_INFO = {
  /**
   * Server display name
   */
  name: "Coding Agent MCP Server",
  
  /**
   * Server version
   */
  version: "0.01",
  
  /**
   * Server description
   */
  description: "Orchestrator for Claude Code and Gemini CLI",
};
