/* eslint-disable systemprompt-os/no-block-comments */
/**
 * MCP module exports.
 * Model Context Protocol integration for managing AI model contexts.
 */

import { getCommands } from '@/modules/core/mcp/cli/index.js';
import { MCPService } from '@/modules/core/mcp/services/mcp.service.js';

/**
 * Initialize function for core module pattern.
 * @returns Promise that resolves when initialized.
 */
export const initialize = async (): Promise<void> => {
  const service = MCPService.getInstance();
  await service.initialize();
};

/**
 * Export CLI commands for module loader.
 */
export { getCommands };

/**
 * Export service for external use.
 */
export { MCPService };

/**
 * Re-export enums for convenience.
 */
export {
  MCPRoleEnum,
  MCPSessionStatusEnum
} from '@/modules/core/mcp/types/index.js';
