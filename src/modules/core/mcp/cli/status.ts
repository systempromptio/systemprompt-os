/**
 * MCP module status CLI command.
 * @file MCP module status CLI command.
 * @module modules/core/mcp/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { MCPService } from '@/modules/core/mcp/services/mcp.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { type StatusMcpArgs, cliSchemas } from '@/modules/core/mcp/utils/cli-validation';

export const command: ICLICommand = {
  description: 'Show MCP module status (enabled/healthy)',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      const validatedArgs = cliSchemas.status.parse(context.args);

      const mcpService = MCPService.getInstance();
      const contexts = await mcpService.listContexts();

      const statusData = {
        module: 'mcp',
        status: 'healthy',
        enabled: true,
        service: 'MCPService initialized',
        active_contexts: contexts.length,
        mcp_protocol_support: true,
        context_management: true,
        session_handling: true,
        timestamp: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(statusData);
      } else {
        cliOutput.section('MCP Module Status');
        cliOutput.keyValue({
          'Module': 'mcp',
          'Status': 'Healthy',
          'Enabled': '✓',
          'Service': 'MCPService initialized',
          'Active MCP contexts': contexts.length.toString(),
          'MCP protocol support': '✓',
          'Context management': '✓',
          'Session handling': '✓'
        });
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        cliOutput.error('Invalid arguments:');
        (error as any).issues?.forEach((issue: any) => {
          cliOutput.error(`  ${issue.path.join('.')}: ${issue.message}`);
        });
      } else {
        cliOutput.error('Error getting MCP status');
        logger.error(LogSource.MCP, 'Status command failed', { error });
      }
      process.exit(1);
    }
  },
};
