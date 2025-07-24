/**
 * @file MCP Server configuration and capabilities.
 * @module constants/server/server-config
 * @remarks
 * This module defines the server metadata and capabilities for the MCP server.
 * It declares what features the server supports and provides metadata about
 * the server implementation.
 * @see {@link https://modelcontextprotocol.io/specification/2025-06-18/server | MCP Server Specification}
 */

import type { Implementation, ServerCapabilities } from "@modelcontextprotocol/sdk/types.js";
import { CONFIG } from '@/server/config.js';

/**
 * Server implementation metadata.
 * @remarks
 * Provides identifying information about this MCP server implementation.
 */
export const serverConfig: Implementation = {
  name: CONFIG.SERVERNAME,
  version: CONFIG.SERVERVERSION,
};

/**
 * Server capabilities declaration.
 * @remarks
 * This declares all MCP capabilities that this server supports.
 * Each capability corresponds to a feature in the MCP specification:
 * - tools: Interactive functions the AI can call
 * - sampling: AI content generation with human approval
 * - prompts: Predefined prompt templates
 * - resources: Dynamic content the AI can read
 * - logging: Server-side logging capability
 */
export const serverCapabilities: { capabilities: ServerCapabilities } = {
  capabilities: {
    tools: {}, // Tool support
    sampling: {}, // Sampling implementation
    prompts: {}, // Prompt templates
    resources: {}, // Resource listing and reading
    logging: {}, // Client-requested logging support
  },
};
