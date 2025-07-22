/**
 * @fileoverview Create workflow command
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

      // Override name if provided
      if (options.name) {
        definition.name = options.name;
      }

      const workflow = await workflowService.createWorkflow(definition);

      console.log(`Workflow created successfully!`);
      console.log(`ID: ${workflow.id}`);
      console.log(`Name: ${workflow.name}`);
      console.log(`Version: ${workflow.version}`);
      console.log(`Status: ${workflow.status}`);
      console.log(`Steps: ${workflow.steps.length}`);
    } catch (error) {
      console.error('Failed to create workflow:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};