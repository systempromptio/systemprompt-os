/**
 * Config delete CLI command - deletes MCP server configurations.
 * @file Config delete CLI command.
 * @module modules/core/config/cli/delete
 */

import { configModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Validate server name parameter.
 * @param name - Server name to validate.
 * @param cliOutput - CLI output service.
 * @returns True if valid, exits process if invalid.
 */
const validateServerName = (name: unknown, cliOutput: CliOutputService): name is string => {
  if (typeof name !== 'string' || name.trim() === '') {
    cliOutput.error('Error: Server name is required.');
    cliOutput.info('Usage: config delete --name <server-name>');
    process.exit(1);
  }
  return true;
};

/**
 * Check if server exists before deletion.
 * @param name - Server name.
 * @param configService - Configuration service.
 * @param cliOutput - CLI output service.
 * @returns Promise that resolves if server exists, exits if not.
 */
const ensureServerExists = async (
  name: string,
  configService: ReturnType<typeof configModule.exports.service>,
  cliOutput: CliOutputService
): Promise<void> => {
  const existingServer = await configService.getMcpServer(name);
  if (existingServer === null || existingServer === undefined) {
    cliOutput.error(`MCP server '${name}' not found.`);
    process.exit(1);
  }
};

export const command: ICLICommand = {
  description: 'Delete MCP server configuration',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    const { name } = args;

    if (!validateServerName(name, cliOutput)) {
      return
    }

    try {
      await configModule.initialize();
      const configService = configModule.exports.service();

      await ensureServerExists(name, configService, cliOutput);
      await configService.deleteMcpServer(name);

      cliOutput.success(`MCP server '${name}' deleted successfully!`);
    } catch (error) {
      cliOutput.error('Failed to delete MCP server configuration');
      logger.error(LogSource.CLI, 'Failed to delete MCP server configuration', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }
  },
};
