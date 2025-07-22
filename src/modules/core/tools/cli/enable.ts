/**
 * @fileoverview Enable command for tools module
 * @module tools/cli/enable
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
 * Enable tool command
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

      const toolName = context.args.name;
      if (!toolName) {
        console.error('Tool name is required');
        process.exit(1);
      }

      const tool = await toolsModule.exports.getTool(toolName);
      if (!tool) {
        console.error(`Tool not found: ${toolName}`);
        process.exit(1);
      }

      if (tool.enabled) {
        console.log(`Tool '${toolName}' is already enabled`);
        return;
      }

      const success = await toolsModule.exports.enableTool(toolName);
      
      if (success) {
        console.log(`✓ Tool '${toolName}' has been enabled`);
      } else {
        console.error(`Failed to enable tool '${toolName}'`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error enabling tool:', error);
      process.exit(1);
    }
  }
};