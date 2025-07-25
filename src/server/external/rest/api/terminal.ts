/**
 * @file Terminal command execution API endpoint.
 * @module server/external/rest/api/terminal
 */

import type { Router } from 'express';
import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * Execute terminal commands through the API
 * Only allows execution of the systemprompt CLI for security.
 * @param router
 */

const logger = LoggerService.getInstance();

export function setupRoutes(router: Router): void {
  router.get('/api/terminal/summary', async (_req: Request, res: Response) => {
    try {
      const summary = {
        users: 0,
        modules: 0,
        tools: 0,
        database: 'Active',
      };

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
            }
            resolve(null);
          });
          setTimeout(() => { resolve(null); }, 2000)
        });
      } catch {
      }

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
            }
            resolve(null);
          });
          setTimeout(() => { resolve(null); }, 2000)
        });
      } catch {
      }

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
            }
            resolve(null);
          });
          setTimeout(() => { resolve(null); }, 2000)
        });
      } catch {
      }

      res.json({
 success: true,
summary
});
    } catch (error) {
      logger.error(LogSource.API, 'Summary API error', {
 error: error instanceof Error ? error : new Error(String(error)),
category: 'terminal'
});
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

  router.get('/api/terminal/commands', async (_req: Request, res: Response) => {
    try {
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
            logger.error(LogSource.API, 'Failed to parse command list', {
 error: parseError instanceof Error ? parseError : new Error(String(parseError)),
category: 'terminal',
persistToDb: false
});
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
        logger.error(LogSource.API, 'Failed to get commands', {
 error: error.message,
category: 'terminal'
});
        res.json({
          success: false,
          error: 'Failed to retrieve commands',
          fallback: true,
        });
      });

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
      logger.error(LogSource.API, 'Commands API error', {
 error: error instanceof Error ? error : new Error(String(error)),
category: 'terminal'
});
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

      const trimmedCommand = command.trim();
      if (!trimmedCommand.startsWith('systemprompt ')) {
        res.json({
          success: false,
          error: 'Only systemprompt commands are allowed',
        });
        return;
      }

      const parts = trimmedCommand.split(/\s+/);
      const args = parts.slice(1)

      logger.info(LogSource.API, 'Executing terminal command', {
 category: 'terminal',
action: 'execute',
persistToDb: true
});

      const child = spawn('/app/bin/systemprompt', args, {
        cwd: '/app',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          FORCE_COLOR: '0'
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
        logger.error(LogSource.API, 'Terminal command execution error', {
 error: error.message,
category: 'terminal',
action: 'execute'
});
        res.json({
          success: false,
          error: `Failed to execute command: ${error.message}`,
        });
      });

      setTimeout(() => {
        if (!res.headersSent) {
          child.kill();
          res.json({
            success: false,
            error: 'Command execution timeout',
          });
        }
      }, 30000)
    } catch (error) {
      logger.error(LogSource.API, 'Terminal API error', {
 error: error instanceof Error ? error : new Error(String(error)),
category: 'terminal'
});
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
}
