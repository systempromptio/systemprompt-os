/**
 * @fileoverview Info command for tools module
 * @module tools/cli/info
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
 * Tool info command
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

      console.log(`\nTool: ${tool.name}`);
      console.log('═'.repeat(50));
      console.log(`Status: ${tool.enabled ? '✓ Enabled' : '✗ Disabled'}`);
      console.log(`Module: ${tool.moduleName}`);
      console.log(`Scope: ${tool.scope === 'all' ? 'remote + local' : tool.scope}`);
      console.log(`Description: ${tool.description}`);
      console.log(`Handler: ${tool.handlerPath}`);
      
      if (tool.inputSchema) {
        console.log('\nInput Schema:');
        console.log('─'.repeat(50));
        
        if (tool.inputSchema.description) {
          console.log(`Description: ${tool.inputSchema.description}`);
        }
        
        if (tool.inputSchema.type) {
          console.log(`Type: ${tool.inputSchema.type}`);
        }
        
        if (tool.inputSchema.properties) {
          console.log('\nParameters:');
          
          for (const [param, schema] of Object.entries(tool.inputSchema.properties)) {
            const paramSchema = schema as any;
            const required = tool.inputSchema.required?.includes(param) ? ' (required)' : ' (optional)';
            
            console.log(`  ${param}${required}:`);
            
            if (paramSchema.type) {
              console.log(`    Type: ${paramSchema.type}`);
            }
            
            if (paramSchema.description) {
              console.log(`    Description: ${paramSchema.description}`);
            }
            
            if (paramSchema.enum) {
              console.log(`    Allowed values: ${paramSchema.enum.join(', ')}`);
            }
            
            if (paramSchema.default !== undefined) {
              console.log(`    Default: ${JSON.stringify(paramSchema.default)}`);
            }
          }
        }
      }
      
      if (tool.metadata) {
        console.log('\nMetadata:');
        console.log('─'.repeat(50));
        console.log(JSON.stringify(tool.metadata, null, 2));
      }
      
      console.log();
    } catch (error) {
      console.error('Error getting tool info:', error);
      process.exit(1);
    }
  }
};