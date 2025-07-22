/**
 * @fileoverview List command for resources module
 * @module resources/cli/list
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
 * List resources command
 */
export const command = {
  execute: async (_context: CLIContext): Promise<void> => {
    try {
      // Initialize module loader
      const moduleLoader = getModuleLoader();
      await moduleLoader.loadModules();
      
      // Get resources module
      const resourcesModule = moduleLoader.getModule('resources');
      
      if (!resourcesModule || !resourcesModule.exports) {
        console.error('Resources module not available');
        process.exit(1);
      }

      const resources = await resourcesModule.exports.listResources();
      
      if (resources.length === 0) {
        console.log('No resources found');
        return;
      }

      console.log(`Found ${resources.length} resources:\n`);
      
      resources.forEach((resource: any) => {
        console.log(`  ${resource.uri}`);
        console.log(`    Name: ${resource.name}`);
        
        if (resource.description) {
          console.log(`    Description: ${resource.description}`);
        }
        
        console.log(`    MIME type: ${resource.mimeType || 'text/plain'}`);
        console.log();
      });
    } catch (error) {
      console.error('Error listing resources:', error);
      process.exit(1);
    }
  }
};