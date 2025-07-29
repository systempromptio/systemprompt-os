#!/usr/bin/env node
/**
 * @file Main CLI entry point for systemprompt-os.
 * @module cli/main
 * Main entry point for the SystemPrompt OS CLI application.
 */

import { Command } from 'commander';
import type { CLIContext, CLIOption } from '@/modules/core/cli/types/index';
import type { CliService } from '@/modules/core/cli/services/cli.service';
import type { Bootstrap } from '@/bootstrap';
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
process.on('SIGINT', (): void => {
  if (globalBootstrap) {
    globalBootstrap.shutdown().finally((): void => {
      process.exit(0);
    })
.catch((error: unknown): void => {
      console.error('Shutdown error:', error);
      process.exit(1);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', (): void => {
  if (globalBootstrap) {
    globalBootstrap.shutdown().finally((): void => {
      process.exit(0);
    })
.catch((error: unknown): void => {
      console.error('Shutdown error:', error);
      process.exit(1);
    });
  } else {
    process.exit(0);
  }
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
        /**
         * Generate a simple fallback help.
         */
        const name = cmd.name();
        const description = cmd.description();
        const usage = cmd.usage() || '';
        let helpText = `\n  ${name}`;
        if (description) {
          helpText += ` - ${description}`;
        }
        helpText += `\n\n  Usage: ${name} ${usage}\n`;
        
        const options = cmd.options;
        if (options.length > 0) {
          helpText += '\n  Options:\n';
          options.forEach((opt): void => {
            helpText += `    ${opt.flags.padEnd(20)} ${opt.description || ''}\n`;
          });
        }
        
        return helpText;
      }
    }
  });

interface ICommandModule {
  command?: { execute?: (context: CLIContext) => Promise<void> };
  default?: { execute?: (context: CLIContext) => Promise<void> } | ((context: CLIContext) => Promise<void>);
}

interface IBootstrapCliResult {
  cliService: CliService;
  bootstrap: Bootstrap;
}

/**
 * Builds option flags for a command option.
 * @param option - The option configuration.
 * @returns The formatted flags string.
 */
interface IParsedDatabaseCommand {
  id: number;
  command_path: string;
  command_name: string;
  description: string | null;
  module_name: string;
  executor_path: string;
  options: CLIOption[];
  aliases: string[];
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

const buildOptionFlags = (option: CLIOption): string => {
  const short = option.alias !== undefined && option.alias !== '' ? `-${option.alias}, ` : '';
  const long = `--${option.name}`;
  const valueType = option.type !== 'boolean' ? ` <${option.type}>` : '';
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
 * @param cmd - The parsed database command configuration.
 * @returns The action handler function.
 */
const createCommandAction = (cmd: IParsedDatabaseCommand): 
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
    // Dynamic import needed for loading command modules at runtime
    // eslint-disable-next-line systemprompt-os/no-restricted-syntax-typescript-with-help
    const module = await import(cmd.executor_path) as ICommandModule;
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
 * @param cmd - The parsed database command configuration.
 */
const registerCommand = (cmd: IParsedDatabaseCommand): void => {
  if (!cmd.command_path || typeof cmd.command_path !== 'string') {
    const logger = LoggerService.getInstance();
    logger.debug(
      LogSource.CLI, 
      `Skipping command with invalid command_path: ${typeof cmd.command_path} "${String(cmd.command_path)}"`
    );
    return;
  }
  const commandParts = cmd.command_path.split(':');
  let command = program;
  const formatter = CliFormatterService.getInstance();

  for (let i = 0; i < commandParts.length; i += 1) {
    const part = commandParts[i];
    if (part === undefined) {
      // eslint-disable-next-line systemprompt-os/no-continue-with-help
      continue;
    }
    const isLastPart = i === commandParts.length - 1;
    const foundCommand = command.commands.find(
      (commandItem): boolean => { return commandItem.name() === part; });

    if (foundCommand !== undefined) {
      command = foundCommand;
    } else if (isLastPart) {
      const newCommand = command.command(part);
      if (cmd.description !== undefined && cmd.description !== null && cmd.description !== '') {
        newCommand.description(cmd.description);
      }

      if (cmd.options !== undefined && Array.isArray(cmd.options)) {
        cmd.options.forEach((opt): void => {
          const flags = buildOptionFlags(opt);
          const description = opt.description ?? '';

          if (opt.required === true) {
            newCommand.requiredOption(flags, description);
          } else {
            newCommand.option(flags, description);
          }
        });
      }

      /**
       * Apply consistent formatting to subcommands.
       */
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
const registerModuleCommands = async (): Promise<IBootstrapCliResult> => {
  // Dynamic import needed for lazy loading CLI service during bootstrap
  // eslint-disable-next-line systemprompt-os/no-restricted-syntax-typescript-with-help
  const { BootstrapCliService } = await import('@/modules/core/cli/services/bootstrap-cli.service');
  const bootstrapService = BootstrapCliService.getInstance();
  const { cliService, bootstrap } = await bootstrapService.bootstrapCli();
  
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
 * Handles command parsing errors with proper exit codes.
 * @param error - The error object.
 * @param bootstrap - The bootstrap instance for cleanup.
 */
const handleCommandError = async (error: unknown, bootstrap: Bootstrap | null): Promise<void> => {
  if (error && typeof error === 'object' && 'exitCode' in error) {
    const errorWithCode = error as { exitCode?: number };
    if (typeof errorWithCode.exitCode === 'number') {
      const exitCode = errorWithCode.exitCode;
      
      if (bootstrap) {
        await bootstrap.shutdown();
      }
      
      // Force exit with the error code
      setTimeout(() => {
        process.exit(exitCode);
      }, 100);
      return;
    }
  }
  throw error;
};

/**
 * Split main function into smaller parts to comply with max-lines-per-function rule.
 * @param program - The Commander program instance.
 * @param formatter - The CLI formatter service instance.
 */
const setupHelpCommand = (program: Command, formatter: CliFormatterService): void => {
  program
    .command('help [command]')
    .description('Display help for a command')
    .action((commandName?: string): void => {
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
};

const main = async (): Promise<void> => {
  let bootstrap: Bootstrap | null = null;
  
  try {
    const result = await registerModuleCommands();
    
    /**
     * Store bootstrap instance for cleanup.
     */
    bootstrap = result.bootstrap;
    globalBootstrap = bootstrap;

    /**
     * Add built-in commands.
     */
    const formatter = CliFormatterService.getInstance();
    setupHelpCommand(program, formatter);

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
     * If no arguments provided, show help.
     */
    if (process.argv.length === 2) {
      program.outputHelp();
      if (bootstrap) {
        await bootstrap.shutdown();
      }
      process.exit(0);
    }

    /**
     * Parse command line arguments.
     */
    try {
      await program.parseAsync(process.argv);
    } catch (error: unknown) {
      /**
       * Commander throws an error with exitCode property for built-in commands like --version, --help.
       */
      await handleCommandError(error, bootstrap);
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
      } catch {
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
 * Use import.meta.url for ES modules.
 */
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown): void => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export { main };
