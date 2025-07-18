/**
 * @fileoverview Remove extension command
 * @module modules/core/extension/cli/remove
 */

// Local interface definition
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}
import { ExtensionModule } from '../index.js';

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    
    try {
      if (!args.name) {
        console.error('Error: Extension name is required');
        console.error('Usage: systemprompt extension:remove --name <name>');
        process.exit(1);
      }
      
      const extensionModule = new ExtensionModule();
      await extensionModule.initialize({ 
        config: {
          modulesPath: './src/modules',
          extensionsPath: './extensions'
        }
      });
      
      // Check if extension exists
      const extension = extensionModule.getExtension(args.name);
      if (!extension) {
        console.error(`Extension not found: ${args.name}`);
        process.exit(1);
      }
      
      // Confirm removal
      console.log(`Removing extension: ${args.name} (${extension.type})`);
      if (extension.path.includes('/core/')) {
        console.error('Error: Cannot remove core modules');
        process.exit(1);
      }
      
      await extensionModule.removeExtension(args.name, args['preserve-config']);
      
      console.log(`✓ Extension '${args.name}' removed successfully`);
      
      if (args['preserve-config']) {
        console.log('Configuration files have been preserved');
      }
    } catch (error: any) {
      console.error('Error removing extension:', error.message);
      process.exit(1);
    }
  }
};