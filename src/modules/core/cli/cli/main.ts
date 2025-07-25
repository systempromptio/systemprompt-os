#!/usr/bin/env node
/**
 * @file Main CLI entry point for systemprompt-os.
 * @module cli/main
 * Main entry point for the SystemPrompt OS CLI application.
 */

import { Command } from 'commander';
import type { CLIContext } from '@/modules/core/cli/types/index.js';
import { type Bootstrap, runBootstrap } from '@/bootstrap.js';

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
  commandPath: string;
  description?: string;
  options?: ICommandOptions[];
  executorPath: string;
}

interface ICliService {
  getCommandsFromDatabase: () => Promise<IDatabaseCommand[]>;
}

interface ICliModuleExports {
  service?: () => ICliService;
}

interface ICommandModule {
  command?: { execute?: (context: CLIContext) => Promise<void> };
  default?: { execute?: (context: CLIContext) => Promise<void> } | ((context: CLIContext) => Promise<void>);
}

/**
 * Gets the CLI service from the bootstrap modules.
 * @param bootstrap - The bootstrap instance.
 * @returns The CLI service.
 * @throws {Error} If the CLI module or service is not found.
 */
const getCliService = (bootstrap: Bootstrap): ICliService => {
  const cliModule = bootstrap.getModules().get('cli');
  if (cliModule === null || cliModule === undefined) {
    throw new Error('CLI module not found in bootstrap');
  }

  const exports = cliModule.exports as ICliModuleExports | null | undefined;
  if (exports === null || exports === undefined || exports.service === undefined 
      || typeof exports.service !== 'function') {
    throw new Error('CLI service not found in module exports');
  }

  return exports.service();
};

/**
 * Builds option flags for a command option.
 * @param option - The option configuration.
 * @returns The formatted flags string.
 */
const buildOptionFlags = (option: ICommandOptions): string => {
  if (option.type === 'boolean') {
    return option.alias ? `-${option.alias}, --${option.name}` : `--${option.name}`;
  }

  const valueFormat = option.required ? '<value>' : '[value]';
  if (option.alias) {
    return `-${option.alias}, --${option.name} ${valueFormat}`;
  }
  return `--${option.name} ${valueFormat}`;
};

/**
 * Finds the executor function from a module.
 * @param module - The imported module.
 * @returns The executor function or undefined.
 */
const findExecutor = (module: unknown): ((context: CLIContext) => Promise<void>) | undefined => {
  const mod = module as ICommandModule;

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
    const module = await import(cmd.executorPath);
    const executor = findExecutor(module);

    if (executor !== undefined) {
      await executor(context);
    } else {
      console.error(`Command ${cmd.commandPath} has no execute function`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error executing ${cmd.commandPath}:`, error);
    process.exit(1);
  }
  };

/**
 * Registers a single command with the program.
 * @param cmd - The database command configuration.
 */
const registerCommand = (cmd: IDatabaseCommand): void => {
  const command = program.command(cmd.commandPath);
  command.description(cmd.description ?? 'No description available');

  const options = cmd.options ?? [];
  for (const option of options) {
    const flags = buildOptionFlags(option);
    command.option(flags, option.description ?? '', option.default as string | boolean | string[] | undefined);
  }

  command.action(createCommandAction(cmd));
};

/**
 * Bootstrap system and register module commands.
 * @returns The bootstrap instance.
 * @throws {Error} If the CLI module or service is not found.
 */
const registerModuleCommands = async (): Promise<Bootstrap> => {
  const bootstrap = await runBootstrap();
  const cliService = getCliService(bootstrap);

  try {
    const commands = await cliService.getCommandsFromDatabase();

    if (commands.length === 0) {
      console.warn(
        'No CLI commands found in database. Run the main application first to register modules.',
      );
    }

    for (const cmd of commands) {
      registerCommand(cmd);
    }

    return bootstrap;
  } catch (error) {
    console.error('Error loading commands from database:', error);
    console.error('This may be because the database has not been initialized yet.');
    return bootstrap;
  }
};

/**
 * Main entry point.
 * @returns A promise that resolves when the CLI execution is complete.
 */
const main = async (): Promise<void> => {
  let bootstrap: Bootstrap | null = null;

  try {
    bootstrap = await registerModuleCommands();
    program.parse(process.argv);

    if (process.argv.slice(2).length === 0) {
      program.outputHelp();
    }
  } finally {
    if (bootstrap !== null) {
      try {
        await bootstrap.shutdown();
      } catch {
        /**
         * Ignore shutdown errors for CLI.
         */
      }
    }
  }
};

main().catch(console.error);
