/**
 * Config MCP CLI command - manages MCP server configurations.
 * @file Config MCP CLI command.
 * @module modules/core/config/cli/mcp
 */

import { configModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import type { McpServerDisplay } from '@/modules/core/config/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Format MCP server for display.
 * @param server - MCP server entry.
 * @returns Formatted display object.
 */
const formatMcpServer = (server: unknown): Record<string, unknown> => {
  if (server === null || server === undefined || typeof server !== 'object') {
    return {};
  }

  const typedServer = server as McpServerDisplay;

  const formatted: Record<string, unknown> = {
    Name: typedServer.name,
    Command: typedServer.command,
    Scope: typedServer.scope,
    Transport: typedServer.transport,
    Status: typedServer.status,
  };

  if (typedServer.description !== null && typedServer.description !== undefined && typedServer.description !== '') {
    formatted.Description = typedServer.description;
  }

  if (typedServer.args !== null && typedServer.args !== undefined && typedServer.args.length > 0) {
    formatted.Arguments = JSON.stringify(typedServer.args);
  }

  if (typedServer.env !== null && typedServer.env !== undefined && Object.keys(typedServer.env).length > 0) {
    formatted.Environment = JSON.stringify(typedServer.env);
  }

  if (typedServer.lastError !== null && typedServer.lastError !== undefined && typedServer.lastError !== '') {
    formatted['Last Error'] = typedServer.lastError;
  }

  if (typedServer.createdAt !== null && typedServer.createdAt !== undefined && typedServer.createdAt !== '') {
    formatted.Created = new Date(typedServer.createdAt).toLocaleString();
  }
  if (typedServer.updatedAt !== null && typedServer.updatedAt !== undefined && typedServer.updatedAt !== '') {
    formatted.Updated = new Date(typedServer.updatedAt).toLocaleString();
  }

  return formatted;
};

/**
 * Handle list action for MCP servers.
 * @param configService - Configuration service.
 * @param cliOutput - CLI output service.
 */
const handleListAction = async (
  configService: ReturnType<typeof configModule.exports.service>,
  cliOutput: CliOutputService
): Promise<void> => {
  const servers = await configService.listMcpServers();

  if (servers.length === 0) {
    cliOutput.info('No MCP servers configured.');
    return;
  }

  cliOutput.success(`Found ${String(servers.length)} MCP server(s):`);
  cliOutput.info('');

  servers.forEach((server: unknown, index: number): void => {
    if (server !== null && server !== undefined
        && typeof server === 'object' && 'name' in server) {
      const { name: serverName } = server as { name: string };
      cliOutput.info(`${String(index + 1)}. ${serverName}`);
      cliOutput.keyValue(formatMcpServer(server));
      if (index < servers.length - 1) {
        cliOutput.info('');
      }
    }
  });
};

/**
 * Handle get action for MCP server.
 * @param configService - Configuration service.
 * @param name - Server name.
 * @param cliOutput - CLI output service.
 */
const handleGetAction = async (
  configService: ReturnType<typeof configModule.exports.service>,
  name: string,
  cliOutput: CliOutputService
): Promise<void> => {
  const server = await configService.getMcpServer(name);
  if (server === null || server === undefined) {
    cliOutput.error(`MCP server '${name}' not found.`);
    process.exit(1);
  }

  cliOutput.success(`MCP Server: ${name}`);
  cliOutput.keyValue(formatMcpServer(server));
};

export const command: ICLICommand = {
  description: 'Manage MCP server configurations',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    const { action, name } = args;
    const typedAction = typeof action === 'string' ? action : undefined;
    const typedName = typeof name === 'string' ? name : undefined;

    try {
      await configModule.initialize();
      const configService = configModule.exports.service();

      if (typedAction === null || typedAction === undefined || typedAction === 'list') {
        await handleListAction(configService, cliOutput);
      } else if (typedAction === 'get') {
        if (typedName === null || typedName === undefined || typedName === '') {
          cliOutput.error('Error: Server name is required for get action.');
          cliOutput.info(
            'Usage: config mcp --action get --name <server-name>'
          );
          process.exit(1);
        }
        await handleGetAction(configService, typedName, cliOutput);
      } else {
        cliOutput.error(`Unknown action: ${typedAction}`);
        cliOutput.info('Available actions: list, get');
        cliOutput.info(
          'Usage: config mcp [--action <list|get>] [--name <server-name>]'
        );
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
