/**
 * @fileoverview List command for prompts module
 * @module prompts/cli/list
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
 * List prompts command
 */
export const command = {
  execute: async (_context: CLIContext): Promise<void> => {
    try {
      // Initialize module loader
      const moduleLoader = getModuleLoader();
      await moduleLoader.loadModules();
      
      // Get prompts module
      const promptsModule = moduleLoader.getModule('prompts');
      
      if (!promptsModule || !promptsModule.exports) {
        console.error('Prompts module not available');
        process.exit(1);
      }

      const prompts = await promptsModule.exports.listPrompts();
      
      if (prompts.length === 0) {
        console.log('No prompts found');
        return;
      }

      console.log(`Found ${prompts.length} prompts:\n`);
      
      prompts.forEach((prompt: any) => {
        console.log(`  ${prompt.name}`);
        console.log(`    Description: ${prompt.description}`);
        
        if (prompt.arguments && prompt.arguments.length > 0) {
          console.log('    Arguments:');
          prompt.arguments.forEach((arg: any) => {
            const required = arg.required ? ' (required)' : '';
            const description = arg.description || 'No description';
            console.log(`      - ${arg.name}${required}: ${description}`);
          });
        }
        
        console.log();
      });
    } catch (error) {
      console.error('Error listing prompts:', error);
      process.exit(1);
    }
  }
};