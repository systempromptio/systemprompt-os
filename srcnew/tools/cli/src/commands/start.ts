/**
 * @fileoverview Start command implementation
 * @module cli/commands/start
 */

import { spawn } from 'child_process';
import { resolve } from 'path';

export class StartCommand {
  async execute(options: { port?: string; daemon?: boolean }): Promise<void> {
    try {
      console.log('Starting systemprompt-os...');
      
      if (options.daemon) {
        // Run in daemon mode
        const serverPath = resolve(process.cwd(), 'srcnew/src/index.js');
        const child = spawn('node', [serverPath], {
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            PORT: options.port || '8080'
          }
        });
        
        child.unref();
        console.log(`Server started in daemon mode on port ${options.port || '8080'}`);
        console.log('Use "systemprompt stop" to stop the server');
      } else {
        // Run in foreground
        const { startServer } = await import('../../../../src/server/index.js');
        process.env.PORT = options.port || '8080';
        await startServer();
      }
      
    } catch (error) {
      console.error('Error starting server:', error);
      process.exit(1);
    }
  }
}