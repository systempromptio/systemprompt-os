/**
 * System logs command
 */

import type { CLIContext } from '../../../../cli/src/types.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

export const command = {
  async execute(context: CLIContext): Promise<void> {
    try {
      const logDir = './logs';
      const level = context.args['level'];
      const module = context.args['module'];
      const tail = context.args['tail'] || 100;
      const follow = context.args['follow'] || false;

      // Determine which log file to read
      let logFile = 'app.log';
      if (level === 'error') {
        logFile = 'error.log';
      }

      const logPath = join(logDir, logFile);

      if (!existsSync(logPath)) {
        console.error(`Log file not found: ${logPath}`);
        process.exit(1);
      }

      if (follow) {
        // Use tail -f for following logs
        const tailProcess = spawn('tail', ['-f', '-n', tail.toString(), logPath], {
          stdio: 'inherit',
        });

        // Handle Ctrl+C
        process.on('SIGINT', () => {
          tailProcess.kill();
          process.exit(0);
        });
      } else {
        // Read and filter logs
        const content = readFileSync(logPath, 'utf-8');
        const lines = content.trim().split('\n');

        let filtered = lines;

        // Filter by level if specified
        if (level) {
          const levelUpper = level.toUpperCase();
          filtered = filtered.filter((line) => line.includes(`[${levelUpper}]`));
        }

        // Filter by module if specified
        if (module) {
          filtered = filtered.filter((line) => line.includes(`[${module}]`));
        }

        // Apply tail limit
        if (tail && tail < filtered.length) {
          filtered = filtered.slice(-tail);
        }

        // Output logs
        filtered.forEach((line) => {
          // Add color based on log level
          if (line.includes('[ERROR]')) {
            console.log(`\x1b[31m${  line  }\x1b[0m`); // Red
          } else if (line.includes('[WARN]')) {
            console.log(`\x1b[33m${  line  }\x1b[0m`); // Yellow
          } else if (line.includes('[DEBUG]')) {
            console.log(`\x1b[36m${  line  }\x1b[0m`); // Cyan
          } else {
            console.log(line);
          }
        });

        if (filtered.length === 0) {
          console.log('No matching log entries found.');
        }
      }
    } catch (error) {
      console.error('Error reading logs:', error);
      process.exit(1);
    }
  },
};
