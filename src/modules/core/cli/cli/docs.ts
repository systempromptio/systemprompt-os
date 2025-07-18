/**
 * @fileoverview Generate command documentation
 * @module modules/core/cli/cli/docs
 */

// Local interface definition
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}
import { CLIModule } from '../index.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    
    try {
      console.log('Generating command documentation...');
      
      const cliModule = new CLIModule();
      await cliModule.initialize({ config: {} });
      
      // Get all available commands
      const commands = await cliModule.getAllCommands();
      
      // Generate documentation
      const format = args.format || 'markdown';
      const docs = cliModule.generateDocs(commands, format);
      
      if (args.output) {
        // Write to file
        const outputPath = resolve(context.cwd, args.output);
        writeFileSync(outputPath, docs);
        console.log(`✓ Documentation generated: ${outputPath}`);
      } else {
        // Output to console
        console.log('\n' + docs);
      }
      
      console.log(`\n✓ Generated documentation for ${commands.size} commands`);
    } catch (error) {
      console.error('Error generating documentation:', error);
      process.exit(1);
    }
  }
};