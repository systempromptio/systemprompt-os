/**
 * @fileoverview Validate workflow definition command
 * @module modules/core/workflows/cli
 */

import { getModuleLoader } from '../../../loader.js';
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { options = {} } = context;
    
    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const workflowsModule = moduleLoader.getModule('workflows');

    if (!workflowsModule) {
      console.error('Workflows module not found');
      process.exit(1);
    }

    if (!options.file) {
      console.error('Missing required option: --file');
      process.exit(1);
    }

    try {
      const workflowService = workflowsModule.exports?.WorkflowService;
      if (!workflowService) {
        console.error('Workflow service not available');
        process.exit(1);
      }

      // Read and parse workflow definition file
      const filePath = options.file;
      const fileContent = readFileSync(filePath, 'utf-8');
      
      let definition;
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        definition = yaml.load(fileContent);
      } else if (filePath.endsWith('.json')) {
        definition = JSON.parse(fileContent);
      } else {
        console.error('Unsupported file format. Use YAML or JSON.');
        process.exit(1);
      }

      // Validate the workflow
      try {
        workflowService.validateWorkflow(definition);
        console.log('✓ Workflow definition is valid');
        
        // Display workflow info
        console.log('\nWorkflow Summary:');
        console.log(`  Name: ${definition.name || 'Not specified'}`);
        console.log(`  Version: ${definition.version || '1.0.0'}`);
        console.log(`  Steps: ${definition.steps?.length || 0}`);
        
        if (definition.inputs && definition.inputs.length > 0) {
          console.log(`  Inputs: ${definition.inputs.length}`);
          definition.inputs.forEach((input: any) => {
            console.log(`    - ${input.name} (${input.type})${input.required ? ' *required' : ''}`);
          });
        }
        
        if (definition.outputs && definition.outputs.length > 0) {
          console.log(`  Outputs: ${definition.outputs.length}`);
        }
        
        if (definition.triggers && definition.triggers.length > 0) {
          console.log(`  Triggers: ${definition.triggers.length}`);
        }
        
      } catch (validationError) {
        console.error('✗ Validation failed:', validationError instanceof Error ? validationError.message : 'Unknown error');
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to validate workflow:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};