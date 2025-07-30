/**
 * Config delete CLI command - deletes MCP server configurations.
 * @file Config delete CLI command.
 * @module modules/core/config/cli/delete
 */

import { getConfigModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Delete MCP server configuration',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    const name = args.name as string | undefined;

    if (!name) {
      cliOutput.error('Error: Server name is required.');
      cliOutput.info('Usage: config delete --name <server-name>');
      process.exit(1);
    }

    try {
      const configModule = await getConfigModule();
      const configService = configModule.exports.service();

      const existingServer = await configService.getMcpServer(name);
      if (!existingServer) {
        cliOutput.error(`MCP server '${name}' not found.`);
        process.exit(1);
      }

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
