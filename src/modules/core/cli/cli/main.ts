#!/usr/bin/env node
/**
 * @file Main CLI entry point for systemprompt-os.
 * @module cli/main
 */

import { Command } from 'commander';
import type { CLIContext } from '@/modules/core/cli/types/index.js';
import { runBootstrap } from '@/bootstrap.js';
import type { Bootstrap } from '@/bootstrap.js';

const program = new Command();

program
  .name('systemprompt')
  .description(
    'An operating system for autonomous agents that run locally, remember persistently, and act purposefully.',
  )
  .version('0.1.0');

/**
 * Bootstrap system and register module commands.
 */
async function registerModuleCommands(): Promise<Bootstrap> {
  /*
   * Run the same bootstrap process as the main server
   * This will initialize all modules including logger, database, CLI, etc.
   */
  const bootstrap = await runBootstrap();

  // Get the CLI module which has access to the database
  const cliModule = bootstrap.getModules().get('cli');
  if (!cliModule) {
    throw new Error('CLI module not found in bootstrap');
  }

  // Get the CLI service from the module exports
  const serviceGetter = cliModule.exports?.service;
  if (!serviceGetter || typeof serviceGetter !== 'function') {
    throw new Error('CLI service not found in module exports');
  }
  const cliService = serviceGetter();

  try {
    // Get available CLI commands from database
    const commands = await cliService.getCommandsFromDatabase();

    if (commands.length === 0) {
      console.warn('No CLI commands found in database. Run the main application first to register modules.');
    }

    // Register each command
    for (const cmd of commands) {
      const commandName = cmd.command_path;
      const command = program.command(commandName);
      command.description(cmd.description || 'No description available');

      // Parse and add options
      const options = cmd.options || [];
      for (const option of options) {
        let flags: string;
        if (option.alias) {
          flags = option.required
            ? `-${option.alias}, --${option.name} <value>`
            : `-${option.alias}, --${option.name} [value]`;
        } else {
          flags = option.required ? `--${option.name} <value>` : `--${option.name} [value]`;
        }

        if (option.type === 'boolean') {
          flags = option.alias ? `-${option.alias}, --${option.name}` : `--${option.name}`;
        }

        command.option(flags, option.description, option.default);
      }

      // Set up action
      command.action(async (options) => {
        const context: CLIContext = {
          args: options,
          flags: options,
          cwd: process.cwd(),
          env: process.env as Record<string, string>,
        };

        try {
          // Dynamically import and execute the command
          const module = await import(cmd.executor_path);

          let executor;
          if (module.command?.execute) {
            executor = module.command.execute;
          } else if (module.default?.execute) {
            executor = module.default.execute;
          } else if (typeof module.default === 'function') {
            executor = module.default;
          }

          if (executor) {
            await executor(context);
          } else {
            console.error(`Command ${commandName} has no execute function`);
            process.exit(1);
          }
        } catch (error) {
          console.error(`Error executing ${commandName}:`, error);
          process.exit(1);
        }
      });
    }

    return bootstrap;
  } catch (error) {
    console.error('Error loading commands from database:', error);
    console.error('This may be because the database has not been initialized yet.');
    // Still return bootstrap so we can shut it down properly
    return bootstrap;
  }
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  let bootstrap: Bootstrap | null = null;

  try {
    bootstrap = await registerModuleCommands();

    // Parse command line arguments
    program.parse(process.argv);

    // Show help if no command is provided
    if (!process.argv.slice(2).length) {
      program.outputHelp();
    }
  } finally {
    // Don't keep the process running - we're just a CLI tool
    if (bootstrap) {
      try {
        await bootstrap.shutdown();
      } catch (err) {
        // Ignore shutdown errors for CLI
      }
    }
  }
}

// Execute main function
main().catch(console.error);
