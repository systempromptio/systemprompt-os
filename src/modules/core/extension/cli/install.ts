/**
 * @fileoverview Install extension command
 * @module modules/core/extension/cli/install
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
        console.error('Usage: systemprompt extension:install --name <name> [--version <version>]');
        process.exit(1);
      }
      
      console.log(`Installing extension: ${args.name}${args.version ? '@' + args.version : ''}`);
      
      const extensionModule = new ExtensionModule();
      await extensionModule.initialize({ config: {} });
      
      // Check if already installed
      const existing = extensionModule.getExtension(args.name);
      if (existing && !args.force) {
        console.error(`Extension '${args.name}' is already installed (v${existing.version})`);
        console.error('Use --force to reinstall');
        process.exit(1);
      }
      
      await extensionModule.installExtension(args.name, {
        version: args.version,
        force: args.force
      });
      
      console.log(`✓ Extension '${args.name}' installed successfully`);
    } catch (error: any) {
      console.error('Error installing extension:', error.message);
      console.error('\nNote: Extension installation is not yet fully implemented.');
      console.error('To manually install an extension:');
      console.error('1. Place module extensions in ./extensions/modules/<name>');
      console.error('2. Place server extensions in ./extensions/servers/<name>');
      console.error('3. Ensure proper module.yaml or server.yaml configuration');
      process.exit(1);
    }
  }
};