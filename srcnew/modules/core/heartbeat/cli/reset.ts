/**
 * Heartbeat reset CLI command
 */

import { CLICommand, CLIContext } from '../../../../src/interfaces/cli.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export const command: CLICommand = {
  name: 'reset',
  description: 'Reset heartbeat state',
  options: [
    {
      name: 'force',
      alias: 'f',
      type: 'boolean',
      description: 'Force reset without confirmation',
      default: false
    }
  ],
  async execute(args: any, context: CLIContext): Promise<void> {
    try {
      const stateDir = process.env.STATE_DIR || './state';
      const statusFile = join(stateDir, 'data', 'heartbeat.json');
      
      if (!existsSync(statusFile)) {
        console.log('No heartbeat state to reset.');
        return;
      }
      
      if (!args.force) {
        console.log('This will reset the heartbeat state.');
        console.log('Use --force to skip this confirmation.');
        return;
      }
      
      unlinkSync(statusFile);
      console.log('Heartbeat state has been reset.');
      
    } catch (error) {
      console.error('Error resetting heartbeat state:', error);
      process.exit(1);
    }
  }
};

export default command;