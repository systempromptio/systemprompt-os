#!/usr/bin/env node
/**
 * @fileoverview Main CLI entry point for systemprompt-os
 * @module cli/index
 */

import { Command } from "commander";
import { CommandDiscovery } from "./discovery.js";
import type { CLIContext } from "./types.js";

const program = new Command();

program
  .name("systemprompt")
  .description(
    "An operating system for autonomous agents that run locally, remember persistently, and act purposefully.",
  )
  .version("0.1.0");

// Note: All commands are now discovered and registered from modules
// See registerModuleCommands() below

// Discover and register module commands
async function registerModuleCommands() {
  const discovery = new CommandDiscovery();

  try {
    const discoveredCommands = await discovery.discoverCommands();

    discoveredCommands.forEach((command, commandName) => {
      const cmd = program.command(commandName);
      cmd.description(command.description || 'No description available');

      // Add options if any
      if (command.options) {
        for (const option of command.options) {
          let flags: string;
          if (option.alias) {
            flags = option.required 
              ? `-${option.alias}, --${option.name} <value>`
              : `-${option.alias}, --${option.name} [value]`;
          } else {
            flags = option.required
              ? `--${option.name} <value>`
              : `--${option.name} [value]`;
          }

          if (option.type === 'boolean') {
            flags = option.alias
              ? `-${option.alias}, --${option.name}`
              : `--${option.name}`;
          }

          cmd.option(flags, option.description, option.default);
        }
      }

      // Set up action
      cmd.action(async (options) => {
        const context: CLIContext = {
          args: options,
          flags: options,
          cwd: process.cwd(),
          env: process.env as Record<string, string>
        };

        // Load executor on demand
        let executor = command.execute;
        if (!executor && command.executorPath) {
          executor = await discovery.loadCommandExecutor(command.executorPath);
        }

        if (executor) {
          try {
            await executor(context);
          } catch (error) {
            console.error(`Error executing ${commandName}:`, error);
            process.exit(1);
          }
        } else {
          console.error(`Command ${commandName} has no execute function`);
          process.exit(1);
        }
      });
    });
  } catch (error) {
    console.error("Error discovering module commands:", error);
  }
}

// Main entry point
async function main() {
  await registerModuleCommands();

  // Parse command line arguments
  program.parse(process.argv);

  // Show help if no command is provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

main().catch(console.error);
