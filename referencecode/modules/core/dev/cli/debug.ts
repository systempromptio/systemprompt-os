/**
 * @fileoverview Debug mode CLI command
 * @module modules/core/dev/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'Enable or disable debug mode',
  options: {
    mode: {
      description: 'Debug mode (on, off, status)',
      default: 'on',
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

    const mode = args['mode'] || args['_']?.[0] || 'on';

    if (!mode || mode === 'on') {
      await devService.enableDebugMode();
      console.log('✓ Debug mode enabled');
      console.log('  - Log level set to debug');
      console.log('  - NODE_ENV set to development');
      console.log('  - DEBUG environment variable set');
    } else if (mode === 'off') {
      await devService.disableDebugMode();
      console.log('✓ Debug mode disabled');
      console.log('  - Log level set to info');
      console.log('  - NODE_ENV set to production');
      console.log('  - DEBUG environment variable removed');
    } else if (mode === 'status') {
      const isDebug = devService.isDebugMode();
      console.log(`Debug mode: ${isDebug ? 'enabled' : 'disabled'}`);
    } else {
      console.error('Invalid argument. Use: dev:debug [on|off|status]');
      process.exit(1);
    }
  },
};