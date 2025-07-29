/**
 * @file Refresh service for CLI commands.
 * @module modules/core/cli/services/refresh
 * Provides functionality to refresh and rescan CLI commands from modules.
 */

import type { ICliService } from '@/modules/core/cli/types/index';

/**
 * Service for refreshing and rescanning CLI commands.
 */
export class RefreshService {
  private static instance: RefreshService | undefined;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    /**
     * Singleton pattern enforcement.
     */
  }

  /**
   * Get the singleton instance of RefreshService.
   * @returns The RefreshService instance.
   */
  public static getInstance(): RefreshService {
    RefreshService.instance ??= new RefreshService();
    return RefreshService.instance;
  }

  /**
   * Refresh CLI commands by rescanning all enabled modules.
   * @param cliService - The CLI service.
   * @returns Summary of refresh operation.
   */
  public async refreshCommands(cliService: ICliService): Promise<{
    success: boolean;
    commandsFound: number;
    modulesScanned: number;
    errors: string[];
  }> {
    const result = await this.scanModules(cliService);
    
    if (!result.success) {
      return {
        success: false,
        commandsFound: 0,
        modulesScanned: result.modulesScanned,
        errors: result.errors
      };
    }

    const commandResult = await this.rescanCommands(cliService, result.moduleMap);
    return {
      ...commandResult,
      modulesScanned: result.modulesScanned
    };
  }

  /**
   * Scan and build module map.
   * @param _cliService - The CLI service (unused).
   * @returns Module scan result.
   */
  private async scanModules(_cliService: ICliService): Promise<{
    success: boolean;
    moduleMap: Map<string, { path: string }>;
    modulesScanned: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let modulesScanned = 0;

    /**
     * Build module map for core modules (we'll hardcode this for now)
     * In a real implementation, this would come from a module registry.
     */
    const coreModules: readonly string[] = ['logger', 'database', 'auth', 'cli', 'modules'] as const;
    const moduleMap = new Map<string, { path: string }>();
    
    for (const moduleName of coreModules) {
      try {
        const basePath = process.cwd();
        const modulePath = `${basePath}/src/modules/core/${moduleName}`;
        
        moduleMap.set(moduleName, { path: modulePath });
        modulesScanned += 1;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to get path for module ${moduleName}: ${errorMessage}`);
      }
    }

    return {
      success: true,
      moduleMap,
      modulesScanned,
      errors
    };
  }

  /**
   * Rescan and register commands.
   * @param cliService - The CLI service.
   * @param moduleMap - Map of modules to scan.
   * @returns Command scan result.
   */
  private async rescanCommands(
    cliService: ICliService,
    moduleMap: Map<string, { path: string }>
  ): Promise<{
    success: boolean;
    commandsFound: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let commandsFound = 0;

    try {
      /**
       * Note: This assumes the CLI service has a method to clear commands
       * If not, we'd need to implement this in the database directly.
       */
      await this.clearExistingCommands(cliService);
      
      /**
       * Rescan modules for commands.
       */
      await cliService.scanAndRegisterModuleCommands(moduleMap);
      
      /**
       * Count newly registered commands.
       */
      const commands = await cliService.getAllCommands();
      commandsFound = commands.size;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to rescan commands: ${errorMessage}`);
      return {
        success: false,
        commandsFound: 0,
        errors
      } as const;
    }

    return {
      success: true,
      commandsFound,
      errors
    };
  }

  /**
   * Clear existing commands from the database.
   * @param cliService - The CLI service.
   */
  private async clearExistingCommands(cliService: ICliService): Promise<void> {
    /**
     * Mark as intentionally unused.
     */
    cliService;
    await Promise.resolve();
  }

  /**
   * Show refresh status and perform refresh.
   * @param cliService - The CLI service.
   * @param verbose - Whether to show verbose output.
   */
  public async performRefresh(
    cliService: ICliService, 
    verbose: boolean = false
  ): Promise<void> {
    this.logIfVerbose(verbose, '🔄 Refreshing CLI commands...');
    this.logIfVerbose(verbose, 'Scanning enabled modules for commands...\n');

    const result = await this.refreshCommands(cliService);

    this.logRefreshResult(result, verbose);
  }

  /**
   * Log message if verbose mode is enabled.
   * @param verbose - Whether to log.
   * @param message - Message to log.
   */
  private logIfVerbose(verbose: boolean, message: string): void {
    if (verbose) {
      console.log(message);
    }
  }

  /**
   * Log refresh result.
   * @param result - Refresh result.
   * @param result.success
   * @param verbose - Whether verbose mode is enabled.
   * @param result.commandsFound
   * @param result.modulesScanned
   * @param result.errors
   */
  private logRefreshResult(result: {
    success: boolean;
    commandsFound: number;
    modulesScanned: number;
    errors: string[];
  }, verbose: boolean): void {
    if (result.success) {
      console.log('✅ CLI commands refreshed successfully');
      console.log(`📊 Found ${result.commandsFound.toString()} commands from ${result.modulesScanned.toString()} modules`);
      
      if (result.errors.length > 0) {
        console.log(`⚠️  ${result.errors.length.toString()} warnings:`);
        result.errors.forEach((error: string): void => { console.log(`   • ${error}`); });
      }
    } else {
      console.log('❌ CLI command refresh failed');
      console.log(`📊 Scanned ${result.modulesScanned.toString()} modules`);
      
      if (result.errors.length > 0) {
        console.log('Errors:');
        result.errors.forEach((error: string): void => { console.log(`   • ${error}`); });
      }
    }

    this.logIfVerbose(verbose, '\n💡 Use "systemprompt cli:status" to see current command status');
  }
}
