/**
 * @file CLI-specific bootstrap process.
 * @module cli/bootstrap-cli
 * Bootstrap process for CLI commands using the main bootstrap with server components disabled.
 */

import { Bootstrap } from '@/bootstrap.js';
import { CliService } from '@/modules/core/cli/services/cli.service.js';

/**
 * Bootstrap services needed for CLI using the main bootstrap process.
 * @returns CLI service instance.
 */
export const bootstrapCli = async (): Promise<CliService> => {
  // Set environment variable for CLI mode logger detection
  process.env['LOG_MODE'] = 'cli';
  
  // Use the main bootstrap with server components disabled and CLI mode
  const bootstrap = new Bootstrap({
    skipMcp: true, // Skip MCP server setup for CLI
    environment: process.env['NODE_ENV'] ?? 'development',
    cliMode: true, // Enable CLI mode for reduced logging
  });

  // Run the full bootstrap process (loads core modules, discovers extension modules, registers CLI commands)
  const modules = await bootstrap.bootstrap();

  // Get the CLI module
  const cliModule = modules.get('cli');
  if (!cliModule) {
    throw new Error('CLI module not found after bootstrap');
  }

  // Get the CLI service from the module using standardized exports
  if (!cliModule.exports || typeof cliModule.exports !== 'object') {
    throw new Error('CLI module does not have exports property');
  }

  const serviceGetter = (cliModule.exports as any).service;
  if (typeof serviceGetter !== 'function') {
    throw new Error('CLI module exports does not have service function');
  }

  const cliService = serviceGetter();
  if (!cliService || !(cliService instanceof CliService)) {
    throw new Error('Failed to get CLI service instance');
  }

  return cliService;
};
