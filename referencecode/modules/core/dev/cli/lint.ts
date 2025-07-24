/**
 * @fileoverview Lint code CLI command
 * @module modules/core/dev/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'Run linter',
  options: {
    fix: {
      short: 'f',
      description: 'Automatically fix problems',
      type: 'boolean',
    },
  },
  execute: async (context: CLIContext): Promise<void> => {
    const { options = {} } = context;
    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const devModule = moduleLoader.getModule('dev');

    if (!devModule) {
      console.error('Dev module not found');
      process.exit(1);
    }

    const module = devModule.exports;
    const devService = module.getService ? module.getService() : module;

    if (!devService) {
      console.error('Dev service not available');
      process.exit(1);
    }

    const fix = options['fix'] || false;

    console.log(`Running linter${fix ? ' with auto-fix' : ''}...`);

    try {
      const result = await devService.runLinter(fix);

      console.log('\n=== Lint Results ===');

      if (result.errors === 0 && result.warnings === 0) {
        console.log('✓ No issues found!');
      } else {
        if (result.errors > 0) {
          console.log(`✕ Errors: ${result.errors}`);
        }
        if (result.warnings > 0) {
          console.log(`⚠ Warnings: ${result.warnings}`);
        }
        if (fix && result.fixed > 0) {
          console.log(`✓ Fixed: ${result.fixed} problems`);
        }
      }

      if (result.errors > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Linting failed:', error);
      process.exit(1);
    }
  },
};
