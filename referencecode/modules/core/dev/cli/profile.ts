/**
 * @fileoverview Profile performance CLI command
 * @module modules/core/dev/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'Profile performance',
  options: {
    duration: {
      short: 'd',
      description: 'Profile duration in seconds',
      type: 'number',
      default: 10,
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

    const duration = options['duration'] || parseInt(args['_']?.[0]) || 10;
    const durationMs = duration * 1000;

    console.log(`Starting performance profiling for ${duration} seconds...`);
    console.log('Press Ctrl+C to stop early\n');

    try {
      const profile = await devService.profilePerformance(durationMs);

      console.log('\n=== Performance Profile ===');
      console.log(`Duration: ${profile.duration}ms`);
      console.log('\nMemory Usage:');
      console.log(`  Heap Used: ${formatBytes(profile.memory.heapUsed)}`);
      console.log(`  Heap Total: ${formatBytes(profile.memory.heapTotal)}`);
      console.log(`  External: ${formatBytes(profile.memory.external)}`);
      console.log(`  RSS: ${formatBytes(profile.memory.rss)}`);
      console.log('\nCPU Usage:');
      console.log(`  User: ${profile.cpu.user.toFixed(2)}ms`);
      console.log(`  System: ${profile.cpu.system.toFixed(2)}ms`);
      console.log(`  Total: ${(profile.cpu.user + profile.cpu.system).toFixed(2)}ms`);
    } catch (error) {
      console.error('Profiling failed:', error);
      process.exit(1);
    }
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 0) {return `-${  formatBytes(-bytes)}`;}
  if (bytes === 0) {return '0 B';}

  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
