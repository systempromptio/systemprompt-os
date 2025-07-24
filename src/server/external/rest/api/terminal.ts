/**
 * @file Terminal command execution API endpoint.
 * @module server/external/rest/api/terminal
 */

import type { Router } from 'express';
import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import { LoggerService } from '@/modules/core/logger/index.js';

/**
 * Execute terminal commands through the API
 * Only allows execution of the systemprompt CLI for security.
 * @param router
 */

const logger = LoggerService.getInstance();

export function setupRoutes(router: Router): void {
  /**
   * Get system summary stats.
   */
  router.get('/api/terminal/summary', async (_req: Request, res: Response) => {
    try {
      const summary = {
        users: 0,
        modules: 0,
        tools: 0,
        database: 'Active',
      };

      // Get user count
      try {
        const child = spawn('/app/bin/systemprompt', ['auth:db', 'users', '--format', 'json'], {
          cwd: '/app',
          env: {
 ...process.env,
NODE_ENV: 'production',
FORCE_COLOR: '0'
},
        });

        let output = '';
        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        await new Promise((resolve) => {
          child.on('close', () => {
            try {
              const users = JSON.parse(output);
              summary.users = Array.isArray(users) ? users.length : 0;
            } catch {
              // Fallback to 0 if parsing fails
            }
            resolve(null);
          });
          setTimeout(() => { resolve(null); }, 2000); // 2s timeout
        });
      } catch {
        // Continue with default value
      }

      // Get module count
      try {
        const child = spawn('/app/bin/systemprompt', ['extension:list', '--format', 'json'], {
          cwd: '/app',
          env: {
 ...process.env,
NODE_ENV: 'production',
FORCE_COLOR: '0'
},
        });

        let output = '';
        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        await new Promise((resolve) => {
          child.on('close', () => {
            try {
              const modules = JSON.parse(output);
              summary.modules = Array.isArray(modules) ? modules.length : 0;
            } catch {
              // Fallback to 0 if parsing fails
            }
            resolve(null);
          });
          setTimeout(() => { resolve(null); }, 2000); // 2s timeout
        });
      } catch {
        // Continue with default value
      }

      // Get tool count
      try {
        const child = spawn('/app/bin/systemprompt', ['tools:list', '--format', 'json'], {
          cwd: '/app',
          env: {
 ...process.env,
NODE_ENV: 'production',
FORCE_COLOR: '0'
},
        });

        let output = '';
        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        await new Promise((resolve) => {
          child.on('close', () => {
            try {
              const tools = JSON.parse(output);
              summary.tools = Array.isArray(tools) ? tools.length : 0;
            } catch {
              // Fallback to 0 if parsing fails
            }
            resolve(null);
          });
          setTimeout(() => { resolve(null); }, 2000); // 2s timeout
        });
      } catch {
        // Continue with default value
      }

      res.json({
 success: true,
summary
});
    } catch (error) {
      logger.error('Summary API error', { error });
      res.json({
        success: false,
        error: 'Failed to retrieve summary',
        summary: {
 users: 0,
modules: 0,
tools: 0,
database: 'Unknown'
},
      });
    }
  });

  /**
   * Get available CLI commands.
   */
  router.get('/api/terminal/commands', async (_req: Request, res: Response) => {
    try {
      // Execute cli:list to get all available commands
      const child = spawn('/app/bin/systemprompt', ['cli:list', '--format', 'json'], {
        cwd: '/app',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          FORCE_COLOR: '0',
        },
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const commands = JSON.parse(output);
            res.json({
 success: true,
commands
});
          } catch (parseError) {
            logger.error('Failed to parse command list', { error: parseError });
            res.json({
              success: false,
              error: 'Failed to parse command list',
              fallback: true,
            });
          }
        } else {
          res.json({
            success: false,
            error: errorOutput || 'Failed to retrieve commands',
            fallback: true,
          });
        }
      });

      child.on('error', (error) => {
        logger.error('Failed to get commands', { error: error.message });
        res.json({
          success: false,
          error: 'Failed to retrieve commands',
          fallback: true,
        });
      });

      // Set timeout
      setTimeout(() => {
        if (!res.headersSent) {
          child.kill();
          res.json({
            success: false,
            error: 'Command list timeout',
            fallback: true,
          });
        }
      }, 5000);
    } catch (error) {
      logger.error('Commands API error', { error });
      res.json({
        success: false,
        error: 'Failed to retrieve commands',
        fallback: true,
      });
    }
  });

  router.post('/api/terminal/execute', async (req: Request, res: Response) => {
    try {
      const { command } = req.body;

      if (!command || typeof command !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid command',
        });
        return;
      }

      // Security: Only allow systemprompt commands
      const trimmedCommand = command.trim();
      if (!trimmedCommand.startsWith('systemprompt ')) {
        res.json({
          success: false,
          error: 'Only systemprompt commands are allowed',
        });
        return;
      }

      // Parse the command and arguments
      const parts = trimmedCommand.split(/\s+/);
      const args = parts.slice(1); // Remove 'systemprompt' from the beginning

      logger.info('Executing terminal command', { command: trimmedCommand });

      // Execute the command
      const child = spawn('/app/bin/systemprompt', args, {
        cwd: '/app',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          FORCE_COLOR: '0', // Disable color output for cleaner terminal display
        },
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          res.json({
            success: true,
            output: output || 'Command executed successfully',
          });
        } else {
          res.json({
            success: false,
            error: errorOutput || output || `Command exited with code ${code}`,
          });
        }
      });

      child.on('error', (error) => {
        logger.error('Terminal command execution error', { error: error.message });
        res.json({
          success: false,
          error: `Failed to execute command: ${error.message}`,
        });
      });

      // Set a timeout to prevent hanging commands
      setTimeout(() => {
        if (!res.headersSent) {
          child.kill();
          res.json({
            success: false,
            error: 'Command execution timeout',
          });
        }
      }, 30000); // 30 second timeout
    } catch (error) {
      logger.error('Terminal API error', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
}
