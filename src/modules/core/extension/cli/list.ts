/**
 * @fileoverview List installed extensions command
 * @module modules/core/extension/cli/list
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
      const extensionModule = new ExtensionModule();
      await extensionModule.initialize({ 
        config: {
          modulesPath: './src/modules',
          extensionsPath: './extensions'
        }
      });
      
      // Get extensions based on type filter
      let extensions = extensionModule.getExtensions(
        args.type === 'all' ? undefined : args.type
      );
      
      if (extensions.length === 0) {
        console.log('No extensions found');
        return;
      }
      
      const format = args.format || 'text';
      
      if (format === 'json') {
        console.log(JSON.stringify(extensions, null, 2));
      } else if (format === 'table') {
        console.log('\nInstalled Extensions');
        console.log('===================\n');
        console.log('Name'.padEnd(20) + 'Type'.padEnd(10) + 'Version'.padEnd(10) + 'Description');
        console.log('-'.repeat(70));
        
        extensions.forEach(ext => {
          const desc = ext.description || 'No description';
          const truncatedDesc = desc.length > 30 ? desc.substring(0, 27) + '...' : desc;
          console.log(
            ext.name.padEnd(20) +
            ext.type.padEnd(10) +
            ext.version.padEnd(10) +
            truncatedDesc
          );
        });
      } else {
        // Text format
        console.log('\nInstalled Extensions');
        console.log('===================\n');
        
        // Group by type
        const modules = extensions.filter(e => e.type === 'module');
        const servers = extensions.filter(e => e.type === 'server');
        
        if (modules.length > 0) {
          console.log('Modules:');
          modules.forEach(ext => {
            console.log(`  ${ext.name} (v${ext.version})`);
            if (ext.description) {
              console.log(`    ${ext.description}`);
            }
          });
        }
        
        if (servers.length > 0) {
          if (modules.length > 0) console.log('');
          console.log('Servers:');
          servers.forEach(ext => {
            console.log(`  ${ext.name} (v${ext.version})`);
            if (ext.description) {
              console.log(`    ${ext.description}`);
            }
          });
        }
        
        console.log(`\nTotal: ${extensions.length} extension(s)`);
      }
    } catch (error) {
      console.error('Error listing extensions:', error);
      process.exit(1);
    }
  }
};