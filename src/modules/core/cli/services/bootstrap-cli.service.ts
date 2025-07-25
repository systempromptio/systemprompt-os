/**
 * @file CLI-specific bootstrap process.
 * @module cli/bootstrap-cli
 * Bootstrap process for CLI commands using the main bootstrap with server components disabled.
 */

import { Bootstrap } from '@/bootstrap';
import { CliService } from '@/modules/core/cli/services/cli.service';

/**
 * Result of CLI bootstrap process.
 */
export interface IBootstrapCliResult {
  cliService: CliService;
  bootstrap: Bootstrap;
}

/**
 * Bootstrap CLI service implementing singleton pattern.
 */
export class BootstrapCliService {
  private static instance: BootstrapCliService;
  
  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    /**
     * Intentionally empty - singleton pattern.
     */
  }
  
  /**
   * Get singleton instance of BootstrapCliService.
   * @returns The singleton instance.
   */
  public static getInstance(): BootstrapCliService {
    BootstrapCliService.instance ||= new BootstrapCliService();
    return BootstrapCliService.instance;
  }
  
  /**
   * Bootstrap services needed for CLI using the main bootstrap process.
   * @returns CLI service instance and bootstrap instance.
   */
  public async bootstrapCli(): Promise<IBootstrapCliResult> {
    /**
     * Set environment variable for CLI mode logger detection.
     */
    process.env.LOG_MODE = 'cli';
    
    /**
     * Use the main bootstrap with server components disabled and CLI mode.
     */
    const bootstrap = new Bootstrap({
      /**
       * Skip MCP server setup for CLI.
       */
      skipMcp: true,
      environment: process.env.NODE_ENV ?? 'development',
      /**
       * Enable CLI mode for reduced logging.
       */
      cliMode: true,
    });

    /**
     * Run the full bootstrap process (loads core modules, discovers extension modules, registers CLI commands).
     */
    const modules = await bootstrap.bootstrap();

    /**
     * Get the CLI module.
     */
    const cliModule = modules.get('cli');
    if (!cliModule) {
      throw new Error('CLI module not found after bootstrap');
    }

    /**
     * Get the CLI service from the module using standardized exports.
     */
    if (!cliModule.exports || typeof cliModule.exports !== 'object') {
      throw new Error('CLI module does not have exports property');
    }

    const serviceGetter = (cliModule.exports as Record<string, unknown>).service;
    if (typeof serviceGetter !== 'function') {
      throw new Error('CLI module exports does not have service function');
    }

    const cliService = serviceGetter();
    if (!cliService || !(cliService instanceof CliService)) {
      throw new Error('Failed to get CLI service instance');
    }

    return { 
      cliService,
      bootstrap 
    };
  }
}

/**
 * Bootstrap services needed for CLI using the main bootstrap process.
 * @returns CLI service instance and bootstrap instance.
 * @deprecated Use BootstrapCliService.getInstance().bootstrapCli() instead.
 */
export const bootstrapCli = async (): Promise<IBootstrapCliResult> => {
  const service = BootstrapCliService.getInstance();
  return await service.bootstrapCli();
};
