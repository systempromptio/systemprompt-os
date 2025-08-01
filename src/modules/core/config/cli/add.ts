/**
 * Config add CLI command - adds MCP server configurations.
 * @file Config add CLI command.
 * @module modules/core/config/cli/add
 */

import { configModule } from '@/modules/core/config/index';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import type { IMcpServerConfig } from '@/modules/core/config/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';

/**
 * Parse JSON string safely.
 * @param {string} jsonString - JSON string to parse.
 * @returns {unknown} Parsed JSON or null if invalid.
 */
const parseJsonSafely = (jsonString: string): unknown => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
};

/**
 * Validate required arguments for add command.
 * @param name - Server name.
 * @param serverCommand - Server command.
 * @param cliOutput - CLI output service.
 * @returns True if valid, false otherwise.
 */
const validateRequiredArgs = (
  name: string | undefined,
  serverCommand: string | undefined,
  cliOutput: CliOutputService
): boolean => {
  if (name === undefined || name === '' || serverCommand === undefined || serverCommand === '') {
    cliOutput.error('Error: Both name and command are required.');
    cliOutput.info(
      'Usage: config add --name <server-name> '
      + '--command <command-path> [options]'
    );
    cliOutput.info('Options:');
    cliOutput.info('  --args <json-array>      Arguments for the server command');
    cliOutput.info('  --env <json-object>      Environment variables');
    cliOutput.info('  --scope <local|project|user>  Server scope (default: local)');
    cliOutput.info('  --transport <stdio|sse|http>  Transport type (default: stdio)');
    cliOutput.info('  --description <text>     Server description');
    return false;
  }
  return true;
};

/**
 * Parse and validate arguments array.
 * @param argsString - JSON string of arguments.
 * @param cliOutput - CLI output service.
 * @returns Parsed arguments or null if invalid.
 */
const parseAndValidateArgs = (
  argsString: string,
  cliOutput: CliOutputService
): string[] | null => {
  const parsedArgs = parseJsonSafely(argsString);
  if (!Array.isArray(parsedArgs)) {
    cliOutput.error('Error: --args must be a valid JSON array');
    return null;
  }
  return parsedArgs.every((arg): arg is string => { return typeof arg === 'string'; })
    ? parsedArgs : null;
};

/**
 * Parse and validate environment variables.
 * @param envString - JSON string of environment variables.
 * @param cliOutput - CLI output service.
 * @returns Parsed environment or null if invalid.
 */
const parseAndValidateEnv = (
  envString: string,
  cliOutput: CliOutputService
): Record<string, string> | null => {
  const parsedEnv = parseJsonSafely(envString);
  if (parsedEnv === null || parsedEnv === undefined || typeof parsedEnv !== 'object' || Array.isArray(parsedEnv)) {
    cliOutput.error('Error: --env must be a valid JSON object');
    return null;
  }
  const isValidEnv = Object.values(parsedEnv).every(
    (val): val is string => { return typeof val === 'string'; }
  );
  if (!isValidEnv) {
    cliOutput.error('Error: All environment variable values must be strings');
    return null;
  }
  return parsedEnv as Record<string, string>;
};

/**
 * Display success information for added server.
 * @param config - Server configuration.
 * @param cliOutput - CLI output service.
 */
const displaySuccessInfo = (
  config: IMcpServerConfig,
  cliOutput: CliOutputService
): void => {
  cliOutput.success(`MCP server '${config.name}' added successfully!`);
  cliOutput.keyValue({
    Name: config.name,
    Command: config.command,
    Scope: config.scope ?? 'local',
    Transport: config.transport ?? 'stdio',
    Status: 'inactive'
  });

  if (config.args && config.args.length > 0) {
    cliOutput.info(`Arguments: ${JSON.stringify(config.args)}`);
  }
  if (config.env && Object.keys(config.env).length > 0) {
    cliOutput.info(`Environment: ${JSON.stringify(config.env)}`);
  }
};

/**
 * Parse command arguments from CLI context.
 * @param args - CLI context arguments.
 * @returns Typed arguments object.
 */
const parseCommandArgs = (args: Record<string, unknown>): {
  typedName: string | undefined;
  typedCommand: string | undefined;
  typedArgsString: string | undefined;
  typedEnvString: string | undefined;
  typedScope: 'local' | 'project' | 'user' | undefined;
  typedTransport: 'stdio' | 'sse' | 'http' | undefined;
  typedDescription: string | undefined;
} => {
  const {
    name,
    command: serverCommand,
    args: argsString,
    env: envString,
    scope,
    transport,
    description
  } = args;

  return {
    typedName: typeof name === 'string' ? name : undefined,
    typedCommand: typeof serverCommand === 'string' ? serverCommand : undefined,
    typedArgsString: typeof argsString === 'string' ? argsString : undefined,
    typedEnvString: typeof envString === 'string' ? envString : undefined,
    typedScope: typeof scope === 'string' && ['local', 'project', 'user'].includes(scope)
      ? scope as 'local' | 'project' | 'user'
      : undefined,
    typedTransport: typeof transport === 'string' && ['stdio', 'sse', 'http'].includes(transport)
      ? transport as 'stdio' | 'sse' | 'http'
      : undefined,
    typedDescription: typeof description === 'string' ? description : undefined
  };
};

/**
 * Build server configuration from parsed arguments.
 * @param parsedArgs - Parsed command arguments.
 * @param cliOutput - CLI output service.
 * @returns Server configuration or null if invalid.
 */
const buildServerConfig = (
  parsedArgs: ReturnType<typeof parseCommandArgs>,
  cliOutput: CliOutputService
): IMcpServerConfig | null => {
  const {
    typedName,
    typedCommand,
    typedArgsString,
    typedEnvString,
    typedScope,
    typedTransport,
    typedDescription
  } = parsedArgs;

  if (!validateRequiredArgs(typedName, typedCommand, cliOutput)) {
    return null;
  }

  const config: IMcpServerConfig = {
    name: typedName ?? '',
    command: typedCommand ?? '',
    scope: typedScope ?? 'local',
    transport: typedTransport ?? 'stdio',
    ...typedDescription ? { description: typedDescription } : {}
  };

  if (typedArgsString) {
    const parsedArgsResult = parseAndValidateArgs(typedArgsString, cliOutput);
    if (!parsedArgsResult) {
      return null;
    }
    config.args = parsedArgsResult;
  }

  if (typedEnvString) {
    const parsedEnv = parseAndValidateEnv(typedEnvString, cliOutput);
    if (!parsedEnv) {
      return null;
    }
    config.env = parsedEnv;
  }

  return config;
};

export const command: ICLICommand = {
  description: 'Add MCP server configuration',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    const parsedArgs = parseCommandArgs(args);
    const config = buildServerConfig(parsedArgs, cliOutput);

    if (!config) {
      process.exit(1);
    }

    try {
      await configModule.initialize();
      await configModule.exports.service().addMcpServer(config);
      displaySuccessInfo(config, cliOutput);
    } catch (error) {
      cliOutput.error('Failed to add MCP server configuration');
      logger.error(LogSource.CLI, 'Failed to add MCP server configuration', {
        error: error instanceof Error ? error : new Error(String(error))
      });
      process.exit(1);
    }
  },
};
