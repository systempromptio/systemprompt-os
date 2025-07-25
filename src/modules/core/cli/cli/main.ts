#!/usr/bin/env node
/**
 * @file Main CLI entry point for systemprompt-os.
 * @module cli/main
 * Main entry point for the SystemPrompt OS CLI application.
 */

import { Command } from 'commander';
import type { CLIContext } from '@/modules/core/cli/types/index';
import { bootstrapCli } from '@/modules/core/cli/services/bootstrap-cli.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { CliFormatterService } from '@/modules/core/cli/services/cli-formatter.service';

/**
 * Global bootstrap instance for cleanup.
 */
let globalBootstrap: { shutdown: () => Promise<void> } | null = null;

/**
 * Ensure clean exit on process termination.
 */
process.on('SIGINT', async (): Promise<void> => {
  if (globalBootstrap) {
    await globalBootstrap.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async (): Promise<void> => {
  if (globalBootstrap) {
    await globalBootstrap.shutdown();
  }
  process.exit(0);
});

const program = new Command();

program
  .name('systemprompt')
  .description(
    'An operating system for autonomous agents that run locally, remember persistently, and act purposefully.',
  )
  .version('0.1.0')
  .configureHelp({
    formatHelp: (cmd): string => {
      try {
        const formatter = CliFormatterService.getInstance();
        return formatter.formatHelp(cmd, true);
      } catch (error) {
        /**
         * Fallback to default help if formatting fails.
         */
        console.error('CLI formatting error:', error);
        return cmd.helpInformation();
      }
    }
  });

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
    /**
     * Dynamic import needed for loading command modules at runtime.
     */
    // eslint-disable-next-line systemprompt-os/no-restricted-syntax-typescript-with-help
    const module = await import(cmd.executor_path);
    const executor = findExecutor(module);

    if (executor !== undefined) {
      await executor(context);
    } else {
      const logger = LoggerService.getInstance();
      logger.error(LogSource.CLI, `Command ${cmd.command_path} has no execute function`);
      /**
       * Don't call process.exit() here, let the main function handle it.
       */
      throw new Error(`Command ${cmd.command_path} has no execute function`);
    }
  } catch (error) {
    const logger = LoggerService.getInstance();
    logger.error(LogSource.CLI, `Error executing ${cmd.command_path}`, { 
      error: error instanceof Error ? error : new Error(String(error))
    });
    /**
     * Re-throw to let main handle the exit.
     */
    throw error;
  }
  };

/**
 * Registers a single command with the program.
 * @param cmd - The database command configuration.
 */
const registerCommand = (cmd: IDatabaseCommand): void => {
  if (!cmd.command_path || typeof cmd.command_path !== 'string') {
    const logger = LoggerService.getInstance();
    logger.debug(LogSource.CLI, `Skipping command with invalid command_path: ${typeof cmd.command_path} "${cmd.command_path}"`);
    return;
  }
  const commandParts = cmd.command_path.split(':');
  let command = program;
  const formatter = CliFormatterService.getInstance();

  for (let i = 0; i < commandParts.length; i += 1) {
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

      // Apply consistent formatting to subcommands
      newCommand.configureHelp({
        formatHelp: (subCmd): string => {
          return formatter.formatHelp(subCmd, false);
        }
      });

      newCommand.action(createCommandAction(cmd));
    } else {
      const partValue = part ?? '';
      command = command.command(partValue);
      
      /**
       * Apply consistent formatting to parent commands too.
       */
      command.configureHelp({
        formatHelp: (parentCmd): string => {
          return formatter.formatHelp(parentCmd, false);
        }
      });
    }
  }
};

/**
 * Bootstrap CLI and register module commands.
 * @returns The CLI service instance and bootstrap instance.
 * @throws {Error} If CLI bootstrap fails.
 */
const registerModuleCommands = async (): Promise<{ cliService: any; bootstrap: any }> => {
  const { cliService, bootstrap } = await bootstrapCli();
  
  try {
    const commands = await cliService.getCommandsFromDatabase();
    if (commands.length === 0) {
      const logger = LoggerService.getInstance();
      logger.warn(
        LogSource.CLI, 
        'No CLI commands found in database. Run the main application first to register modules.'
      );
    }

    for (const cmd of commands) {
      registerCommand(cmd);
    }

    return { cliService,
bootstrap };
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
  let bootstrap: { shutdown: () => Promise<void> } | null = null;
  
  try {
    const result = await registerModuleCommands();
    
    /**
     * Store bootstrap instance for cleanup.
     */
    if (result && typeof result === 'object' && 'bootstrap' in result) {
      bootstrap = result.bootstrap;
      globalBootstrap = bootstrap;
    }

    /**
     * Add built-in commands.
     */
    program
      .command('help [command]')
      .description('Display help for a command')
      .action((commandName?: string): void => {
        const formatter = CliFormatterService.getInstance();
        if (commandName !== undefined) {
          const cmd = program.commands.find((c): boolean => { return c.name() === commandName; });
          if (cmd !== undefined) {
            cmd.outputHelp();
            /**
             * Ensure output is flushed before exit.
             */
            process.stdout.write('', (): void => {
              process.exit(0);
            });
          } else {
            console.log(formatter.formatError(`Unknown command: ${commandName}`));
            console.log(`\nUse ${formatter.highlight('systemprompt help')} to see all available commands.`);
          }
        } else {
          program.outputHelp();
          /**
           * Ensure output is flushed before exit.
           */
          process.stdout.write('', (): void => {
            process.exit(0);
          });
        }
      });

    /**
     * Configure error handling for unknown commands.
     */
    program.exitOverride();
    program.configureOutput({
      writeErr: (str): void => {
        const logger = LoggerService.getInstance();
        logger.error(LogSource.CLI, str.trim());
      }
    });

    /**
     * Parse command line arguments.
     */
    try {
      await program.parseAsync(process.argv);
    } catch (error: unknown) {
      /**
       * Commander throws an error with exitCode property for built-in commands like --version, --help.
       */
      if (error && typeof error === 'object' && 'exitCode' in error && typeof (error as any).exitCode === 'number') {
        const errorWithCode = error as { exitCode: number };
        process.exitCode = errorWithCode.exitCode;
        
        /**
         * If exitCode is 0, it's a successful operation (like --version or --help).
         */
        if (errorWithCode.exitCode === 0) {
          /**
           * Clean shutdown and exit successfully.
           */
          if (bootstrap) {
            await bootstrap.shutdown();
          }
          setTimeout((): void => {
            process.exit(0);
          }, 100);
          return;
        }
      }
      throw error;
    }
    
    /**
     * Clean exit after successful command execution.
     */
    if (bootstrap) {
      await bootstrap.shutdown();
    }
    
    /**
     * Force exit to ensure the process terminates.
     */
    setTimeout((): void => {
      process.exit(0);
    }, 100);
  } catch (error) {
    /**
     * Don't use logger here as it may not be initialized if bootstrap failed.
     */
    console.error('CLI initialization failed:', error);
    
    /**
     * Cleanup on error.
     */
    if (bootstrap) {
      try {
        await bootstrap.shutdown();
      } catch (cleanupError) {
        /**
         * Ignore cleanup errors during error handling.
         */
      }
    }
    
    process.exit(1);
  }
};

/**
 * Only run if this is the main module.
 */
if (import.meta.url.startsWith('file:')) {
  const modulePath = new URL(import.meta.url).pathname;
  if (process.argv[1] === modulePath) {
    main().catch((error) => {
      console.error('Unhandled error in main:', error);
      process.exit(1);
    });
  }
}

export { main };
