/**
 * @fileoverview Show extension info command
 * @module modules/core/extension/cli/info
 */

// Local interface definition
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}
import { ExtensionModule } from '../index.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    
    try {
      if (!args.name) {
        console.error('Error: Extension name is required');
        console.error('Usage: systemprompt extension:info --name <name>');
        process.exit(1);
      }
      
      const extensionModule = new ExtensionModule();
      await extensionModule.initialize({ 
        config: {
          modulesPath: './src/modules',
          extensionsPath: './extensions'
        }
      });
      
      const extension = extensionModule.getExtension(args.name);
      
      if (!extension) {
        console.error(`Extension not found: ${args.name}`);
        process.exit(1);
      }
      
      console.log(`\nExtension: ${extension.name}`);
      console.log('='.repeat(extension.name.length + 11));
      console.log(`Type: ${extension.type}`);
      console.log(`Version: ${extension.version}`);
      
      if (extension.description) {
        console.log(`Description: ${extension.description}`);
      }
      
      if (extension.author) {
        console.log(`Author: ${extension.author}`);
      }
      
      if (extension.dependencies && extension.dependencies.length > 0) {
        console.log(`Dependencies: ${extension.dependencies.join(', ')}`);
      }
      
      console.log(`Path: ${extension.path}`);
      
      // Additional info for modules
      if (extension.type === 'module') {
        // Check for CLI commands
        const cliDir = join(extension.path, 'cli');
        if (existsSync(cliDir)) {
          const commands = readdirSync(cliDir)
            .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
            .map(f => f.replace(/\.(ts|js)$/, ''));
          
          if (commands.length > 0) {
            console.log(`\nCLI Commands:`);
            commands.forEach(cmd => {
              console.log(`  ${extension.name}:${cmd}`);
            });
          }
        }
        
        // Check for README
        const readmePath = join(extension.path, 'README.md');
        if (existsSync(readmePath)) {
          console.log('\nDocumentation: README.md available');
        }
        
        // Check structure
        const hasIndex = existsSync(join(extension.path, 'index.ts')) || 
                        existsSync(join(extension.path, 'index.js'));
        const hasTests = existsSync(join(extension.path, 'tests'));
        
        console.log('\nStructure:');
        console.log(`  Entry point: ${hasIndex ? '✓' : '✗'}`);
        console.log(`  Tests: ${hasTests ? '✓' : '✗'}`);
        console.log(`  CLI commands: ${existsSync(cliDir) ? '✓' : '✗'}`);
      }
    } catch (error) {
      console.error('Error getting extension info:', error);
      process.exit(1);
    }
  }
};