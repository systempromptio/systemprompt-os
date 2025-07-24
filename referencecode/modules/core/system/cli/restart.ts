/**
 * System restart command
 */

import type { CLIContext } from '../../../../cli/src/types.js';
import { spawn } from 'child_process';

export const command = {
  async execute(context: CLIContext): Promise<void> {
    try {
      const force = context.args['force'] || false;
      const confirm = context.args['confirm'] || false;

      if (!confirm) {
        console.log('WARNING: This will restart the SystemPrompt OS server!');
        console.log('All active connections will be terminated.');
        console.log('');
        console.log('To confirm, run with --confirm flag');
        process.exit(0);
      }

      console.log('Initiating system restart...');

      if (!force) {
        // Graceful shutdown
        console.log('Performing graceful shutdown...');

        // Send shutdown signal to process manager
        try {
          // If using PM2
          spawn('pm2', ['restart', 'systemprompt'], {
            stdio: 'inherit',
            detached: true,
          }).unref();
        } catch {
          // If using systemd
          try {
            spawn('systemctl', ['restart', 'systemprompt'], {
              stdio: 'inherit',
              detached: true,
            }).unref();
          } catch {
            // Fallback: restart the process
            console.log('No process manager detected. Restarting process...');

            // Write restart flag
            const { writeFileSync } = import('fs');
            writeFileSync('./state/.restart', new Date().toISOString());

            // Exit with special code that indicates restart needed
            process.exit(75); // EX_TEMPFAIL
          }
        }
      } else {
        // Force restart
        console.log('Forcing immediate restart...');
        process.exit(75); // EX_TEMPFAIL
      }

      console.log('Restart initiated. The system will be back online shortly.');
    } catch (error) {
      console.error('Error initiating restart:', error);
      process.exit(1);
    }
  },
};
