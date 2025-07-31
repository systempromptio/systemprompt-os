/**
 * Config MCP CLI command - manages MCP server configurations.
 * @file Config MCP CLI command.
 * @module modules/core/config/cli/mcp
 */

import { configModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Format MCP server for display.
 * @param server - MCP server entry.
 * @returns Formatted display object.
 */
function formatMcpServer(server: unknown): Record<string, unknown> {
  const typedServer = server as { name: string; command: string; scope: string; transport: string; status: string; description?: string; args?: string[]; env?: Record<string, string>; };
  const formatted: Record<string, unknown> = {
    Name: typedServer.name,
    Command: typedServer.command,
    Scope: typedServer.scope,
    Transport: typedServer.transport,
    Status: typedServer.status,
  };

  if (typedServer.description) {
    formatted.Description = typedServer.description;
  }

  if (typedServer.args && typedServer.args.length > 0) {
    formatted.Arguments = JSON.stringify(typedServer.args);
  }

  if (typedServer.env && Object.keys(typedServer.env).length > 0) {
    formatted.Environment = JSON.stringify(typedServer.env);
  }

  if ('lastError' in typedServer && typedServer.lastError) {
    formatted['Last Error'] = typedServer.lastError;
  }

  if ('createdAt' in typedServer) {
    formatted.Created = new Date(typedServer.createdAt as string).toLocaleString();
  }
  if ('updatedAt' in typedServer) {
    formatted.Updated = new Date(typedServer.updatedAt as string).toLocaleString();
  }

  return formatted;
}

export const command: ICLICommand = {
  description: 'Manage MCP server configurations',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    const action = args.action as string | undefined;
    const name = args.name as string | undefined;

    try {
      await configModule.initialize();
      const configService = configModule.exports.service();

      if (!action || action === 'list') {
        const servers = await configService.listMcpServers();

        if (servers.length === 0) {
          cliOutput.info('No MCP servers configured.');
          return;
        }

        cliOutput.success(`Found ${servers.length} MCP server(s):`);
        cliOutput.info('');

        servers.forEach((server: unknown, index: number) => {
          const typedServer = server as { name: string };
          cliOutput.info(`${index + 1}. ${typedServer.name}`);
          cliOutput.keyValue(formatMcpServer(server));
          if (index < servers.length - 1) {
            cliOutput.info('');
          }
        });
      } else if (action === 'get') {
        if (!name) {
          cliOutput.error('Error: Server name is required for get action.');
          cliOutput.info('Usage: config mcp --action get --name <server-name>');
          process.exit(1);
        }

        const server = await configService.getMcpServer(name);
        if (!server) {
          cliOutput.error(`MCP server '${name}' not found.`);
          process.exit(1);
        }

        cliOutput.success(`MCP Server: ${name}`);
        cliOutput.keyValue(formatMcpServer(server));
      } else {
        cliOutput.error(`Unknown action: ${action}`);
        cliOutput.info('Available actions: list, get');
        cliOutput.info('Usage: config mcp [--action <list|get>] [--name <server-name>]');
        process.exit(1);
      }
    } catch (error) {
      cliOutput.error('Failed to manage MCP server configurations');
      logger.error(LogSource.CLI, 'Failed to manage MCP server configurations', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }
  },
};
