/**
 * @fileoverview Watch for changes CLI command
 * @module modules/core/dev/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'Watch for changes',
  options: {
    pattern: {
      short: 'p',
      description: 'File pattern to watch',
      default: 'src/**/*.ts',
    },
    command: {
      short: 'c',
      description: 'Command to run on change',
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

    const pattern = options['pattern'] || args['_']?.[0] || 'src/**/*.ts';
    const command = options['command'];

    console.log('Starting file watcher...');
    console.log(`Pattern: ${pattern}`);
    if (command) {
      console.log(`Command: ${command}`);
    }
    console.log('\nPress Ctrl+C to stop watching.\n');

    try {
      await devService.watchForChanges(pattern, command);

      process.on('SIGINT', async () => {
        console.log('\nStopping file watcher...');
        await devService.stopWatching();
        process.exit(0);
      });

      await new Promise(() => {});
    } catch (error) {
      console.error('Failed to start watcher:', error);
      process.exit(1);
    }
  },
};
