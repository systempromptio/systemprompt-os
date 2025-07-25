/**
 * @fileoverview Local MCP server implementation (STDIO)
 * @module modules/core/mcp/servers
 */

import type { Logger } from '../../../types.js';
import type { MCPConfig } from '../types/index.js';
import type { MCPService } from '../services/mcp.service.js';

export async function createLocalServer(
  _mcpService: MCPService,
  _config: MCPConfig,
  logger: Logger,
): Promise<any> {
  logger.info('Creating local MCP server (STDIO)');

  // Local server implementation would handle STDIO communication
  // This is a placeholder for the actual implementation

  return {
    async stop() {
      logger.info('Stopping local MCP server');
    },
  };
}