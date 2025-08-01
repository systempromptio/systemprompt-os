/**
 * @file Status service for CLI commands.
 * @module modules/core/cli/services/status
 * Provides status information and listing for CLI commands.
 */

import type { ICliService } from '@/modules/core/cli/types/manual';

export interface CommandSummary {
  totalCommands: number;
  moduleBreakdown: Record<string, number>;
  enabledCommands: string[];
  lastUpdated: string;
}

/**
 * Service for providing status and listing information for CLI commands.
 */
export class StatusService {
  private static instance: StatusService;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {}

  /**
   * Get the singleton instance of StatusService.
   * @returns The StatusService instance.
   */
  public static getInstance(): StatusService {
    StatusService.instance ||= new StatusService();
    return StatusService.instance;
  }

  /**
   * Get a summary of enabled CLI commands.
   * @param cliService - The CLI service.
   * @returns Command summary.
   */
  public async getCommandSummary(cliService: ICliService): Promise<CommandSummary> {
    const commands = await cliService.getAllCommands();
    const commandsArray = Array.from(commands.entries());
    
    const moduleBreakdown: Record<string, number> = {};
    const enabledCommands: string[] = [];

    commandsArray.forEach(([name]) => {
      enabledCommands.push(name);
      const moduleName = name.split(':')[0] || 'core';
      moduleBreakdown[moduleName] = (moduleBreakdown[moduleName] || 0) + 1;
    });

    return {
      totalCommands: commandsArray.length,
      moduleBreakdown,
      enabledCommands: enabledCommands.sort(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * List all available commands with optional filtering.
   * @param cliService - The CLI service.
   * @param format - Output format.
   * @param filterModule - Optional module filter.
   */
  public async listCommands(
    cliService: ICliService,
    format: 'text' | 'json' | 'table' = 'text',
    filterModule?: string
  ): Promise<void> {
    const commands = await cliService.getAllCommands();

    let filteredCommands = commands;
    if (filterModule !== undefined && filterModule !== null && filterModule !== '') {
      const commandsArray = Array.from(commands.entries());
      filteredCommands = new Map(
        commandsArray.filter(([name]): boolean => { 
          return name.startsWith(`${filterModule}:`);
        }),
      );
    }

    if (format === 'json') {
      const commandsArray = Array.from(filteredCommands.entries());
      console.log(JSON.stringify(commandsArray, null, 2));
    } else {
      console.log('\nSystemPrompt OS - Available Commands');
      console.log('====================================');
      console.log(cliService.formatCommands(filteredCommands, format));
      console.log('\nUse "systemprompt cli:help --command <name>" for detailed help');
    }
  }

  /**
   * Show CLI command status summary.
   * @param cliService - The CLI service.
   * @param format - Output format.
   */
  public async showStatus(
    cliService: ICliService,
    format: 'text' | 'json' = 'text'
  ): Promise<void> {
    const summary = await this.getCommandSummary(cliService);

    if (format === 'json') {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    console.log('\nSystemPrompt OS CLI Status');
    console.log('=========================\n');
    console.log(`Total Commands: ${summary.totalCommands}`);
    console.log(`Last Updated: ${summary.lastUpdated}\n`);
    
    console.log('Commands by Module:');
    Object.entries(summary.moduleBreakdown)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([module, count]) => {
        console.log(`  ${module}: ${count} commands`);
      });

    console.log('\nEnabled Commands:');
    summary.enabledCommands.forEach(command => {
      console.log(`  • ${command}`);
    });

    console.log('\nFor detailed help:');
    console.log('  systemprompt cli:help --command <name>');
    console.log('  systemprompt cli:help --all');
  }
}
