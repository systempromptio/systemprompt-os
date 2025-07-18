/**
 * @fileoverview Validate extension command
 * @module modules/core/extension/cli/validate
 */

// Local interface definition
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}
import { ExtensionModule } from '../index.js';
import { resolve } from 'path';

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    
    try {
      if (!args.path) {
        console.error('Error: Path is required');
        console.error('Usage: systemprompt extension:validate --path <path>');
        process.exit(1);
      }
      
      const extensionModule = new ExtensionModule();
      await extensionModule.initialize({ config: {} });
      
      const extensionPath = resolve(context.cwd, args.path);
      console.log(`Validating extension at: ${extensionPath}`);
      
      const result = extensionModule.validateExtension(extensionPath, args.strict);
      
      if (result.valid) {
        console.log('✓ Extension structure is valid');
      } else {
        console.error('✗ Extension validation failed:');
        result.errors.forEach((error, index) => {
          console.error(`  ${index + 1}. ${error}`);
        });
        process.exit(1);
      }
    } catch (error) {
      console.error('Error validating extension:', error);
      process.exit(1);
    }
  }
};