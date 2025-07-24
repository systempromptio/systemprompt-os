/**
 * @fileoverview Format code CLI command
 * @module modules/core/dev/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'Format code',
  options: {
    pattern: {
      short: 'p',
      description: 'File pattern to format',
      default: 'src/**/*.{ts,js,json}',
    },
  },
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
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

    const pattern = args['pattern'] || args['_']?.[0] || 'src/**/*.{ts,js,json}';

    console.log('Formatting code...');
    console.log(`Pattern: ${pattern}`);

    try {
      const result = await devService.formatCode(pattern);

      console.log(`\n✓ Formatted ${result.filesFormatted} file(s)`);
    } catch (error) {
      console.error('Code formatting failed:', error);
      process.exit(1);
    }
  },
};
