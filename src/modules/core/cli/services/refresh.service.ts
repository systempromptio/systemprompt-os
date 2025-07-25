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
  private static instance: RefreshService;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {}

  /**
   * Get the singleton instance of RefreshService.
   * @returns The RefreshService instance.
   */
  public static getInstance(): RefreshService {
    RefreshService.instance ||= new RefreshService();
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
    const errors: string[] = [];
    let commandsFound = 0;
    let modulesScanned = 0;

    try {
      /*
       * Build module map for core modules (we'll hardcode this for now)
       * In a real implementation, this would come from a module registry
       */
      const coreModules = ['logger', 'database', 'auth', 'cli', 'modules'];
      const moduleMap = new Map<string, { path: string }>();
      
      for (const moduleName of coreModules) {
        try {
          const basePath = process.cwd();
          const modulePath = `${basePath}/src/modules/core/${moduleName}`;
          
          moduleMap.set(moduleName, { path: modulePath });
          modulesScanned++;
        } catch (error) {
          errors.push(`Failed to get path for module ${moduleName}: ${error}`);
        }
      }

      // Clear existing commands and rescan
      try {
        /*
         * Note: This assumes the CLI service has a method to clear commands
         * If not, we'd need to implement this in the database directly
         */
        await this.clearExistingCommands(cliService);
        
        // Rescan modules for commands
        await cliService.scanAndRegisterModuleCommands(moduleMap);
        
        // Count newly registered commands
        const commands = await cliService.getAllCommands();
        commandsFound = commands.size;
      } catch (error) {
        errors.push(`Failed to rescan commands: ${error}`);
        return {
          success: false,
          commandsFound: 0,
          modulesScanned,
          errors
        };
      }

      return {
        success: true,
        commandsFound,
        modulesScanned,
        errors
      };
    } catch (error) {
      errors.push(`Refresh operation failed: ${error}`);
      return {
        success: false,
        commandsFound: 0,
        modulesScanned: 0,
        errors
      };
    }
  }

  /**
   * Clear existing commands from the database.
   * @param cliService - The CLI service.
   * @param _cliService
   */
  private async clearExistingCommands(_cliService: ICliService): Promise<void> {
    /*
     * This would require access to the database service
     * For now, we'll assume commands are replaced via INSERT OR REPLACE
     * which is already implemented in the registerCommand method
     */
    
    /*
     * If we need explicit clearing, we could add a method to CLI service
     * or access the database directly here
     */
  }

  /**
   * Show refresh status and perform refresh.
   * @param cliService - The CLI service.
   * @param verbose - Whether to show verbose output.
   */
  public async performRefresh(
    cliService: ICliService, 
    verbose = false
  ): Promise<void> {
    if (verbose) {
      console.log('🔄 Refreshing CLI commands...');
      console.log('Scanning enabled modules for commands...\n');
    }

    const result = await this.refreshCommands(cliService);

    if (result.success) {
      console.log('✅ CLI commands refreshed successfully');
      console.log(`📊 Found ${result.commandsFound} commands from ${result.modulesScanned} modules`);
      
      if (result.errors.length > 0) {
        console.log(`⚠️  ${result.errors.length} warnings:`);
        result.errors.forEach(error => { console.log(`   • ${error}`); });
      }
    } else {
      console.log('❌ CLI command refresh failed');
      console.log(`📊 Scanned ${result.modulesScanned} modules`);
      
      if (result.errors.length > 0) {
        console.log('Errors:');
        result.errors.forEach(error => { console.log(`   • ${error}`); });
      }
    }

    if (verbose) {
      console.log('\n💡 Use "systemprompt cli:status" to see current command status');
    }
  }
}
