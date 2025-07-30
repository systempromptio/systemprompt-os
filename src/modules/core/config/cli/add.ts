/**
 * Config add CLI command - adds MCP server configurations.
 * @file Config add CLI command.
 * @module modules/core/config/cli/add
 */

import { getConfigModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import type { IMcpServerConfig } from '@/modules/core/config/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Parse JSON string safely.
 * @param {string} jsonString - JSON string to parse.
 * @returns {unknown} Parsed JSON or null if invalid.
 */
function parseJsonSafely(jsonString: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

export const command: ICLICommand = {
  description: 'Add MCP server configuration',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    const name = args.name as string | undefined;
    const command = args.command as string | undefined;
    const argsString = args.args as string | undefined;
    const envString = args.env as string | undefined;
    const scope = args.scope as 'local' | 'project' | 'user' | undefined;
    const transport = args.transport as 'stdio' | 'sse' | 'http' | undefined;
    const description = args.description as string | undefined;

    if (!name || !command) {
      cliOutput.error('Error: Both name and command are required.');
      cliOutput.info('Usage: config add --name <server-name> --command <command-path> [options]');
      cliOutput.info('Options:');
      cliOutput.info('  --args <json-array>      Arguments for the server command');
      cliOutput.info('  --env <json-object>      Environment variables');
      cliOutput.info('  --scope <local|project|user>  Server scope (default: local)');
      cliOutput.info('  --transport <stdio|sse|http>  Transport type (default: stdio)');
      cliOutput.info('  --description <text>     Server description');
      process.exit(1);
    }

    try {
      const config: IMcpServerConfig = {
        name,
        command,
        scope: scope || 'local',
        transport: transport || 'stdio',
        description
      };

      if (argsString) {
        const parsedArgs = parseJsonSafely(argsString);
        if (!Array.isArray(parsedArgs)) {
          cliOutput.error('Error: --args must be a valid JSON array');
          process.exit(1);
        }
        config.args = parsedArgs as string[];
      }

      if (envString) {
        const parsedEnv = parseJsonSafely(envString);
        if (!parsedEnv || typeof parsedEnv !== 'object' || Array.isArray(parsedEnv)) {
          cliOutput.error('Error: --env must be a valid JSON object');
          process.exit(1);
        }
        config.env = parsedEnv as Record<string, string>;
      }

      const configModule = await getConfigModule();
      await configModule.exports.service().addMcpServer(config);

      cliOutput.success(`MCP server '${name}' added successfully!`);
      cliOutput.keyValue({
        Name: name,
        Command: command,
        Scope: config.scope || 'local',
        Transport: config.transport || 'stdio',
        Status: 'inactive'
      });

      if (config.args && config.args.length > 0) {
        cliOutput.info(`Arguments: ${JSON.stringify(config.args)}`);
      }
      if (config.env && Object.keys(config.env).length > 0) {
        cliOutput.info(`Environment: ${JSON.stringify(config.env)}`);
      }
    } catch (error) {
      cliOutput.error('Failed to add MCP server configuration');
      logger.error(LogSource.CLI, 'Failed to add MCP server configuration', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }
  },
};
