/**
 * @fileoverview Refresh command for tools module
 * @module tools/cli/refresh
 */

import { getModuleLoader } from '../../../loader.js';

/**
 * CLI context interface
 */
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

/**
 * Refresh tools command
 */
export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    try {
      // Initialize module loader
      const moduleLoader = getModuleLoader();
      await moduleLoader.loadModules();
      
      // Get tools module
      const toolsModule = moduleLoader.getModule('tools');
      
      if (!toolsModule || !toolsModule.exports) {
        console.error('Tools module not available');
        process.exit(1);
      }

      console.log('Scanning modules for tools...');
      
      const force = context.args.force || false;
      const result = await toolsModule.exports.refreshTools(force);
      
      console.log('\nTool discovery completed:');
      console.log(`  Total discovered: ${result.discovered}`);
      console.log(`  New tools added: ${result.added}`);
      console.log(`  Tools updated: ${result.updated}`);
      console.log(`  Tools removed: ${result.removed}`);
      
      if (result.added === 0 && result.updated === 0 && result.removed === 0) {
        console.log('\nNo changes detected.');
        if (!force) {
          console.log('Use --force to update tools even if no changes are detected.');
        }
      } else {
        console.log('\nTool registry has been updated.');
      }
    } catch (error) {
      console.error('Error refreshing tools:', error);
      process.exit(1);
    }
  }
};