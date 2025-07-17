#!/usr/bin/env node
/**
 * @fileoverview Main CLI entry point for systemprompt-os
 * @module cli/index
 */

import { Command } from 'commander';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { StatusCommand } from './commands/status.js';
import { StartCommand } from './commands/start.js';
import { StopCommand } from './commands/stop.js';
import { ConfigCommand } from './commands/config.js';
import { HelpCommand } from './commands/help.js';
import { TestCommand } from './commands/test.js';
import { CommandDiscovery } from './discovery.js';
import { ModuleRegistry } from '../../../modules/registry.js';
import { CLIContext } from '../../../src/interfaces/cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const modulesPath = join(__dirname, '../../../modules');

const program = new Command();

program
  .name('systemprompt')
  .description('An operating system for autonomous agents that run locally, remember persistently, and act purposefully.')
  .version('0.1.0');

// Register commands
program
  .command('status')
  .description('Check the status of systemprompt-os')
  .action(async () => {
    const command = new StatusCommand();
    await command.execute();
  });

program
  .command('start')
  .description('Start systemprompt-os server')
  .option('-p, --port <port>', 'Port to run the server on', '8080')
  .option('-d, --daemon', 'Run in daemon mode')
  .action(async (options) => {
    const command = new StartCommand();
    await command.execute(options);
  });

program
  .command('stop')
  .description('Stop systemprompt-os server')
  .action(async () => {
    const command = new StopCommand();
    await command.execute();
  });

program
  .command('config')
  .description('Configure systemprompt-os')
  .argument('[key]', 'Configuration key to get/set')
  .argument('[value]', 'Value to set')
  .action(async (key, value) => {
    const command = new ConfigCommand();
    await command.execute(key, value);
  });

program
  .command('test')
  .description('Run tests')
  .option('-u, --unit', 'Run unit tests only')
  .option('-i, --integration', 'Run integration tests only')
  .option('-e, --e2e', 'Run end-to-end tests only')
  .option('-a, --all', 'Run all test suites')
  .option('-w, --watch', 'Run tests in watch mode')
  .action(async (options) => {
    const command = new TestCommand();
    await command.execute(options);
  });

program
  .command('help')
  .description('Show help information')
  .action(async () => {
    const command = new HelpCommand();
    await command.execute();
  });

// Discover and register module commands
async function registerModuleCommands() {
  const registry = new ModuleRegistry();
  const discovery = new CommandDiscovery(modulesPath, registry);
  
  try {
    const discoveredCommands = await discovery.discoverCommands();
    
    for (const { moduleName, command } of discoveredCommands) {
      // Create namespaced command (e.g., "heartbeat:status")
      const commandName = `${moduleName}:${command.name}`;
      const cmd = program.command(commandName);
      
      cmd.description(command.description);
      
      // Add options if any
      if (command.options) {
        for (const option of command.options) {
          const flags = option.alias 
            ? `-${option.alias}, --${option.name} <${option.type}>` 
            : `--${option.name} <${option.type}>`;
          
          cmd.option(flags, option.description, option.default);
        }
      }
      
      // Set up action
      cmd.action(async (options) => {
        const context: CLIContext = {
          registry,
          config: {} // TODO: Load actual config
        };
        
        await command.execute(options, context);
      });
    }
  } catch (error) {
    console.error('Error discovering module commands:', error);
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