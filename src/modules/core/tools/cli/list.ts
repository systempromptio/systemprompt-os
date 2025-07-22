/**
 * @fileoverview List command for tools module
 * @module tools/cli/list
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
 * List tools command
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

      const filters: any = {};
      
      if (context.args.scope) {
        filters.scope = context.args.scope;
      }
      
      if (context.args.enabled !== undefined) {
        filters.enabled = context.args.enabled;
      }
      
      if (context.args.module) {
        filters.moduleName = context.args.module;
      }

      const tools = await toolsModule.exports.getToolsWithFilters(filters);
      
      if (tools.length === 0) {
        console.log('No tools found matching the criteria');
        return;
      }

      console.log(`Found ${tools.length} tools:\n`);
      
      // Group tools by module
      const toolsByModule = tools.reduce((acc: any, tool: any) => {
        if (!acc[tool.moduleName]) {
          acc[tool.moduleName] = [];
        }
        acc[tool.moduleName].push(tool);
        return acc;
      }, {});
      
      for (const [moduleName, moduleTools] of Object.entries(toolsByModule)) {
        console.log(`Module: ${moduleName}`);
        console.log('─'.repeat(40));
        
        for (const tool of moduleTools as any[]) {
          const status = tool.enabled ? '✓' : '✗';
          const scope = tool.scope === 'all' ? 'remote+local' : tool.scope;
          
          console.log(`  ${status} ${tool.name} [${scope}]`);
          console.log(`    ${tool.description}`);
          
          if (tool.inputSchema?.properties) {
            const params = Object.keys(tool.inputSchema.properties);
            if (params.length > 0) {
              console.log(`    Parameters: ${params.join(', ')}`);
            }
          }
          
          console.log();
        }
      }
    } catch (error) {
      console.error('Error listing tools:', error);
      process.exit(1);
    }
  }
};