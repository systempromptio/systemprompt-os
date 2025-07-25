#!/usr/bin/env node
/**
 * @file Main CLI entry point for systemprompt-os.
 * @module cli/main
 * Main entry point for the SystemPrompt OS CLI application.
 */

import { Command } from 'commander';
import type { CLIContext } from '@/modules/core/cli/types/index';
import { bootstrapCli } from '@/modules/core/cli/services/bootstrap-cli.service';
import type { CliService } from '@/modules/core/cli/services/cli.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

const program = new Command();

program
  .name('systemprompt')
  .description(
    'An operating system for autonomous agents that run locally, remember persistently, and act purposefully.',
  )
  .version('0.1.0');

interface ICommandOptions {
  name: string;
  alias?: string;
  required?: boolean;
  type?: string;
  description?: string;
  default?: unknown;
}

interface IDatabaseCommand {
  command_path: string;
  description?: string;
  options?: ICommandOptions[];
  executor_path: string;
}

interface ICommandModule {
  command?: { execute?: (context: CLIContext) => Promise<void> };
  default?: { execute?: (context: CLIContext) => Promise<void> } | ((context: CLIContext) => Promise<void>);
}

/**
 * Builds option flags for a command option.
 * @param option - The option configuration.
 * @returns The formatted flags string.
 */
const buildOptionFlags = (option: ICommandOptions): string => {
  const short = option.alias !== undefined && option.alias !== '' ? `-${option.alias}, ` : '';
  const long = `--${option.name}`;
  const valueType = option.type !== undefined && option.type !== '' ? ` <${option.type}>` : '';
  return `${short}${long}${valueType}`;
};

/**
 * Find executor function in module.
 * @param mod - The command module.
 * @returns The executor function or undefined.
 */
const findExecutor = (mod: ICommandModule): ((context: CLIContext) => Promise<void>) | undefined => {
  if (mod.command !== undefined && mod.command.execute !== undefined) {
    return mod.command.execute;
  }

  if (mod.default !== undefined && typeof mod.default === 'object' && mod.default !== null 
      && 'execute' in mod.default && typeof mod.default.execute === 'function') {
    return mod.default.execute;
  }

  if (typeof mod.default === 'function') {
    return mod.default;
  }

  return undefined;
};

/**
 * Creates the command action handler.
 * @param cmd - The database command configuration.
 * @returns The action handler function.
 */
const createCommandAction = (cmd: IDatabaseCommand): 
  ((options: Record<string, unknown>) => Promise<void>) => 
  async (options: Record<string, unknown>): Promise<void> => {
  const context: CLIContext = {
    args: options,
    flags: options,
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  };

  try {
    // Dynamic import needed for loading command modules at runtime
    // eslint-disable-next-line systemprompt-os/no-restricted-syntax-typescript-with-help
    const module = await import(cmd.executor_path);
    const executor = findExecutor(module);

    if (executor !== undefined) {
      await executor(context);
    } else {
      const logger = LoggerService.getInstance();
      logger.error(LogSource.CLI, `Command ${cmd.command_path} has no execute function`);
      process.exit(1);
    }
  } catch (error) {
    const logger = LoggerService.getInstance();
    logger.error(LogSource.CLI, `Error executing ${cmd.command_path}`, { 
      error: error instanceof Error ? error : new Error(String(error))
    });
    process.exit(1);
  }
  };

/**
 * Registers a single command with the program.
 * @param cmd - The database command configuration.
 */
const registerCommand = (cmd: IDatabaseCommand): void => {
  const commandParts = cmd.command_path.split(':');
  let command = program;

  for (let i = 0; i < commandParts.length; i++) {
    const part = commandParts[i];
    const isLastPart = i === commandParts.length - 1;
    const foundCommand = command.commands.find(
      (commandItem): boolean => { return commandItem.name() === part; });

    if (foundCommand !== undefined) {
      command = foundCommand;
    } else if (isLastPart) {
      const newCommand = command.command(part!);
      if (cmd.description !== undefined && cmd.description !== '') {
        newCommand.description(cmd.description);
      }

      if (cmd.options !== undefined && Array.isArray(cmd.options)) {
        for (const opt of cmd.options) {
          const flags = buildOptionFlags(opt);
          const description = opt.description ?? '';

          if (opt.required === true) {
            newCommand.requiredOption(flags, description);
          } else {
            newCommand.option(flags, description);
          }
        }
      }

      newCommand.action(createCommandAction(cmd));
    } else {
      command = command.command(part!);
    }
  }
};

/**
 * Bootstrap CLI and register module commands.
 * @returns The CLI service instance.
 * @throws {Error} If CLI bootstrap fails.
 */
const registerModuleCommands = async (): Promise<CliService> => {
  const cliService = await bootstrapCli();
  
  try {
    const commands = await cliService.getCommandsFromDatabase();
    if (commands.length === 0) {
      const logger = LoggerService.getInstance();
      logger.warn(LogSource.CLI, 'No CLI commands found in database. Run the main application first to register modules.');
    }

    for (const cmd of commands) {
      registerCommand(cmd);
    }

    return cliService;
  } catch (error) {
    const logger = LoggerService.getInstance();
    logger.error(LogSource.CLI, 'Failed to register commands', { 
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
};

/**
 * Main CLI entry point.
 */
const main = async (): Promise<void> => {
  try {
    await registerModuleCommands();

    // Add built-in commands
    program
      .command('help [command]')
      .description('Display help for a command')
      .action((commandName?: string): void => {
        if (commandName !== undefined) {
          const cmd = program.commands.find((c): boolean => { return c.name() === commandName; });
          if (cmd !== undefined) {
            cmd.outputHelp();
          } else {
            const logger = LoggerService.getInstance();
            logger.error(LogSource.CLI, `Unknown command: ${commandName}`);
          }
        } else {
          program.outputHelp();
        }
      });

    // Parse command line arguments
    await program.parseAsync(process.argv);
  } catch (error) {
    const logger = LoggerService.getInstance();
    logger.error(LogSource.CLI, 'CLI initialization failed', { 
      error: error instanceof Error ? error : new Error(String(error))
    });
    process.exit(1);
  }
};

// Only run if this is the main module
if (import.meta.url.startsWith('file:')) {
  const modulePath = new URL(import.meta.url).pathname;
  if (process.argv[1] === modulePath) {
    void main();
  }
}

export { main };
