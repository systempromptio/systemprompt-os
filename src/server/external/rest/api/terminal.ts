/**
 * Terminal command execution API endpoint.
 * @file Terminal command execution API endpoint.
 * @module server/external/rest/api/terminal
 * Provides secure terminal command execution API endpoints for the systemprompt CLI.
 */

import type {
  Request,
  Response,
  Router
} from 'express';
import { spawn } from 'child_process';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';

const logger = LoggerService.getInstance();

/**
 * Execute a systemprompt command and parse JSON output.
 * @param args - Command arguments.
 * @returns Promise resolving to parsed JSON or null.
 */
const executeSystemPromptCommand = async function executeSystemPromptCommand(
  args: string[]
): Promise<unknown> {
  return await new Promise((resolve): void => {
    const child = spawn('/app/bin/systemprompt', args, {
      cwd: '/app',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        FORCE_COLOR: '0'
      },
    });

    let output = '';
    let hasResolved = false;

    const resolveOnce = (value: unknown): void => {
      if (!hasResolved) {
        hasResolved = true;
        resolve(value);
      }
    };

    child.stdout.on('data', (buffer: Buffer): void => {
      output += buffer.toString();
    });

    const timeoutId = setTimeout((): void => {
      resolveOnce(null);
    }, 2000);

    child.on('close', (): void => {
      clearTimeout(timeoutId);
      try {
        const parsed = JSON.parse(output);
        resolveOnce(parsed);
      } catch {
        resolveOnce(null);
      }
    });
  });
};

/**
 * Get count from array or return 0.
 * @param value - Value to count.
 * @returns Number count.
 */
const getCount = function getCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
};

/**
 * Handle summary endpoint.
 * @param req - Express request object.
 * @param _req
 * @param res - Express response object.
 * @returns Promise<void>.
 */
const handleSummary = async function handleSummary(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const summary = {
      users: 0,
      modules: 0,
      tools: 0,
      database: 'Active',
    };

    const [users, modules, tools] = await Promise.all([
      executeSystemPromptCommand(['auth:db', 'users', '--format', 'json']),
      executeSystemPromptCommand(['extension:list', '--format', 'json']),
      executeSystemPromptCommand(['tools:list', '--format', 'json'])
    ]);

    summary.users = getCount(users);
    summary.modules = getCount(modules);
    summary.tools = getCount(tools);

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
};

/**
 * Handle commands endpoint.
 * @param req - Express request object.
 * @param _req
 * @param res - Express response object.
 * @returns Promise<void>.
 */
const handleCommands = async function handleCommands(
  _req: Request,
  res: Response
): Promise<void> {
  await new Promise((resolve): void => {
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

    child.stdout.on('data', (buffer: Buffer): void => {
      output += buffer.toString();
    });

    child.stderr.on('data', (buffer: Buffer): void => {
      errorOutput += buffer.toString();
    });

    const timeoutId = setTimeout((): void => {
      if (!res.headersSent) {
        child.kill();
        res.json({
          success: false,
          error: 'Command list timeout',
          fallback: true,
        });
        resolve(undefined);
      }
    }, 5000);

      child.on('close', (code: number | null): void => {
        clearTimeout(timeoutId);
        if (code === 0) {
          try {
            const commands = JSON.parse(output);
            res.json({
              success: true,
              commands
            });
            resolve(undefined);
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
            resolve(undefined);
          }
        } else {
          const errorMessage = errorOutput.length > 0 ? errorOutput : 'Failed to retrieve commands';
          res.json({
            success: false,
            error: errorMessage,
            fallback: true,
          });
          resolve(undefined);
        }
      });

    child.on('error', (error: Error): void => {
      clearTimeout(timeoutId);
      logger.error(LogSource.API, 'Failed to get commands', {
        error: error.message,
        category: 'terminal'
      });
      res.json({
        success: false,
        error: 'Failed to retrieve commands',
        fallback: true,
      });
      resolve(undefined);
    });
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
    resolve(undefined);
  }
  });
};

/**
 * Handle execute endpoint.
 * @param req - Express request object.
 * @param res - Express response object.
 * @returns Void.
 */
const handleExecute = function handleExecute(
  req: Request,
  res: Response
): void {
  try {
    const { command } = req.body as { command?: unknown };

    if (typeof command !== 'string' || command.length === 0) {
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
    const args = parts.slice(1);

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

    child.stdout.on('data', (buffer: Buffer): void => {
      output += buffer.toString();
    });

    child.stderr.on('data', (buffer: Buffer): void => {
      errorOutput += buffer.toString();
    });

    const timeoutId = setTimeout((): void => {
      if (!res.headersSent) {
        child.kill();
        res.json({
          success: false,
          error: 'Command execution timeout',
        });
      }
    }, 30000);

    child.on('close', (code: number | null): void => {
      clearTimeout(timeoutId);
      if (code === 0) {
        const responseOutput = output.length > 0 ? output : 'Command executed successfully';
        res.json({
          success: true,
          output: responseOutput,
        });
      } else {
        let errorMessage: string;
        if (errorOutput.length > 0) {
          errorMessage = errorOutput;
        } else if (output.length > 0) {
          errorMessage = output;
        } else {
          errorMessage = `Command exited with code ${String(code)}`;
        }
        res.json({
          success: false,
          error: errorMessage,
        });
      }
    });

    child.on('error', (error: Error): void => {
      clearTimeout(timeoutId);
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
};

/**
 * Execute terminal commands through the API.
 * Only allows execution of the systemprompt CLI for security.
 * @param router - Express router instance.
 * @returns Void.
 */
export const setupRoutes = function setupRoutes(router: Router): void {
  router.get('/api/terminal/summary', handleSummary);
  router.get('/api/terminal/commands', handleCommands);
  router.post('/api/terminal/execute', handleExecute);
};
