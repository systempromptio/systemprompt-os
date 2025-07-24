/**
 * @fileoverview Run tests CLI command
 * @module modules/core/dev/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'Run tests',
  options: {
    pattern: {
      short: 'p',
      description: 'Test file pattern',
    },
    watch: {
      short: 'w',
      description: 'Watch mode',
      type: 'boolean',
    },
  },
  execute: async (context: CLIContext): Promise<void> => {
    const { args, options = {} } = context;
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

    const pattern = options['pattern'] || args['_']?.[0] || undefined;
    const watchMode = options['watch'] || false;

    if (watchMode) {
      console.log('Starting test watcher...');
      await devService.watchForChanges('src/**/*.{ts,js}', 'npm test');
      console.log('Watching for file changes. Press Ctrl+C to stop.');

      process.on('SIGINT', async () => {
        await devService.stopWatching();
        process.exit(0);
      });

      await new Promise(() => {});
    } else {
      console.log('Running tests...');
      if (pattern) {
        console.log(`Pattern: ${pattern}`);
      }

      try {
        const result = await devService.runTests(pattern);

        console.log('\n=== Test Results ===');
        console.log(`✓ Passed: ${result.passed}`);
        console.log(`✕ Failed: ${result.failed}`);
        console.log(`Total: ${result.total}`);
        console.log(`Success Rate: ${((result.passed / result.total) * 100).toFixed(1)}%`);

        if (result.failed > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error('Test execution failed:', error);
        process.exit(1);
      }
    }
  },
};
