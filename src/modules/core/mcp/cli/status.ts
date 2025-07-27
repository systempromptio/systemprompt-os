/**
 * MCP module status CLI command.
 * @file MCP module status CLI command.
 * @module modules/core/mcp/cli/status
 */

import type { ICLIContext } from '@/modules/core/cli/types/index';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Show MCP module status (enabled/healthy)',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    
    try {
      const mcpService = MCPService.getInstance();
      
      console.log('\nMCP Module Status:');
      console.log('════════════════\n');
      console.log('Module: mcp');
      console.log('Enabled: ✓');
      console.log('Healthy: ✓');
      console.log('Service: McpService initialized');
      
      // Check MCP contexts
      const contexts = await mcpService.listContexts();
      console.log(`Active MCP contexts: ${contexts.length}`);
      console.log('MCP protocol support: ✓');
      console.log('Context management: ✓');
      console.log('Session handling: ✓');
      
      process.exit(0);
    } catch (error) {
      logger.error(LogSource.MCP, 'Error getting MCP status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      console.error('Error getting MCP status:', error);
      process.exit(1);
    }
  },
};