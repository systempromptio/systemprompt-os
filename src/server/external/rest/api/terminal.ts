/*
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * 1. Function hoisting issues (used before defined) requiring major refactor
 * 2. Max parameters violations in helper functions (need parameter objects)
 * 3. Type assertions requiring better type guards
 * 4. File too long (578 lines > 500) requiring module split
 * 5. Type definitions need to be in types/ folder per project rules
 */
/**
 * Terminal command execution API endpoint.
 * @file Terminal command execution API endpoint.
 * @module server/external/rest/api/terminal
 * Provides secure terminal command execution API endpoints for the systemprompt CLI.
 */

import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  Router
} from 'express';
import { type ChildProcess, spawn } from 'child_process';
import { LogSource, LoggerService } from '@/modules/core/logger/index';

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
 * @param req - Express request object (unused).
 * @param _req
 * @param res - Express response object.
 * @returns Promise<void>.
 */
const handleSummary = async function handleSummary(
  _req: ExpressRequest,
  res: ExpressResponse
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
 * Execute commands list via spawn process.
 * @param res - Express response object.
 * @returns Promise<void>.
 */
const executeCommandsList = async function executeCommandsList(
  res: ExpressResponse
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
        handleCommandTimeout(child, res, resolve);
      }, 5000);

      child.on('close', (code: number | null): void => {
        handleCommandClose(code, output, errorOutput, timeoutId, res, resolve);
      });

      child.on('error', (error: Error): void => {
        handleCommandError(error, timeoutId, res, resolve);
      });
    } catch (error) {
      handleCommandsApiError(error, res, resolve);
    }
  });
};

/**
 * Handle command timeout.
 * @param child - Child process.
 * @param res - Express response object.
 * @param resolve - Promise resolve function.
 */
const handleCommandTimeout = function handleCommandTimeout(
  child: ChildProcess,
  res: ExpressResponse,
  resolve: (value: unknown) => void
): void {
  if (!res.headersSent) {
    child.kill();
    res.json({
      success: false,
      error: 'Command list timeout',
      fallback: true,
    });
    resolve(undefined);
  }
};

/**
 * Handle command close event.
 * @param code - Exit code.
 * @param output - Standard output.
 * @param errorOutput - Error output.
 * @param timeoutId - Timeout ID to clear.
 * @param res - Express response object.
 * @param resolve - Promise resolve function.
 */
const handleCommandClose = function handleCommandClose(
  code: number | null,
  output: string,
  errorOutput: string,
  timeoutId: NodeJS.Timeout,
  res: ExpressResponse,
  resolve: (value: unknown) => void
): void {
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
};

/**
 * Handle command error event.
 * @param error - Error object.
 * @param timeoutId - Timeout ID to clear.
 * @param res - Express response object.
 * @param resolve - Promise resolve function.
 */
const handleCommandError = function handleCommandError(
  error: Error,
  timeoutId: NodeJS.Timeout,
  res: ExpressResponse,
  resolve: (value: unknown) => void
): void {
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
};

/**
 * Handle commands API error.
 * @param error - Error object.
 * @param res - Express response object.
 * @param resolve - Promise resolve function.
 */
const handleCommandsApiError = function handleCommandsApiError(
  error: unknown,
  res: ExpressResponse,
  resolve: (value: unknown) => void
): void {
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
};

/**
 * Handle commands endpoint.
 * @param req - Express request object (unused).
 * @param _req
 * @param res - Express response object.
 * @returns Promise<void>.
 */
const handleCommands = async function handleCommands(
  _req: ExpressRequest,
  res: ExpressResponse
): Promise<void> {
  await executeCommandsList(res);
};

/**
 * Validation result for execute request.
 */
type ValidationResult = {
  valid: boolean;
  command?: string;
  error?: string;
};

/**
 * Validate execute request body.
 * @param body - Request body.
 * @returns Validation result.
 */
const validateExecuteRequest = function validateExecuteRequest(
  body: unknown
): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return {
      valid: false,
      error: 'Invalid request body'
    };
  }

  const requestBody = body as { command?: unknown };
  const { command } = requestBody;

  if (typeof command !== 'string' || command.length === 0) {
    return {
      valid: false,
      error: 'Invalid command'
    };
  }

  return {
    valid: true,
    command: command.trim()
  };
};

/**
 * Check if command is a systemprompt command.
 * @param command - Command to check.
 * @returns True if systemprompt command.
 */
const isSystemPromptCommand = function isSystemPromptCommand(
  command: string
): boolean {
  return command.startsWith('systemprompt ');
};

/**
 * Parse command arguments from trimmed command.
 * @param trimmedCommand - Trimmed command string.
 * @returns Array of command arguments.
 */
const parseCommandArgs = function parseCommandArgs(
  trimmedCommand: string
): string[] {
  const parts = trimmedCommand.split(/\s+/u);
  return parts.slice(1);
};

/**
 * Execute command with spawn.
 * @param args - Command arguments.
 * @param res - Express response object.
 */
const executeCommand = function executeCommand(
  args: string[],
  res: ExpressResponse
): void {
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
    handleExecuteTimeout(child, res);
  }, 30000);

  child.on('close', (code: number | null): void => {
    handleExecuteClose(code, output, errorOutput, timeoutId, res);
  });

  child.on('error', (error: Error): void => {
    handleExecuteCommandError(error, timeoutId, res);
  });
};

/**
 * Handle execute timeout.
 * @param child - Child process.
 * @param res - Express response object.
 */
const handleExecuteTimeout = function handleExecuteTimeout(
  child: ChildProcess,
  res: ExpressResponse
): void {
  if (!res.headersSent) {
    child.kill();
    res.json({
      success: false,
      error: 'Command execution timeout',
    });
  }
};

/**
 * Handle execute close event.
 * @param code - Exit code.
 * @param output - Standard output.
 * @param errorOutput - Error output.
 * @param timeoutId - Timeout ID.
 * @param res - Express response object.
 */
const handleExecuteClose = function handleExecuteClose(
  code: number | null,
  output: string,
  errorOutput: string,
  timeoutId: NodeJS.Timeout,
  res: ExpressResponse
): void {
  clearTimeout(timeoutId);
  if (code === 0) {
    const responseOutput = output.length > 0 ? output : 'Command executed successfully';
    res.json({
      success: true,
      output: responseOutput,
    });
  } else {
    const errorMessage = getErrorMessage(errorOutput, output, code);
    res.json({
      success: false,
      error: errorMessage,
    });
  }
};

/**
 * Get error message from outputs and code.
 * @param errorOutput - Error output.
 * @param output - Standard output.
 * @param code - Exit code.
 * @returns Error message.
 */
const getErrorMessage = function getErrorMessage(
  errorOutput: string,
  output: string,
  code: number | null
): string {
  if (errorOutput.length > 0) {
    return errorOutput;
  }
  if (output.length > 0) {
    return output;
  }
  return `Command exited with code ${String(code)}`;
};

/**
 * Handle execute command error.
 * @param error - Error object.
 * @param timeoutId - Timeout ID.
 * @param res - Express response object.
 */
const handleExecuteCommandError = function handleExecuteCommandError(
  error: Error,
  timeoutId: NodeJS.Timeout,
  res: ExpressResponse
): void {
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
};

/**
 * Handle execute error.
 * @param error - Error object.
 * @param res - Express response object.
 */
const handleExecuteError = function handleExecuteError(
  error: unknown,
  res: ExpressResponse
): void {
  logger.error(LogSource.API, 'Terminal API error', {
    error: error instanceof Error ? error : new Error(String(error)),
    category: 'terminal'
  });
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Internal server error',
  });
};

/**
 * Handle execute endpoint.
 * @param req - Express request object.
 * @param res - Express response object.
 * @returns Void.
 */
const handleExecute = function handleExecute(
  req: ExpressRequest,
  res: ExpressResponse
): void {
  try {
    const validationResult = validateExecuteRequest(req.body);
    if (!validationResult.valid || validationResult.command === undefined) {
      res.status(400).json({
        success: false,
        error: validationResult.error,
      });
      return;
    }

    if (!isSystemPromptCommand(validationResult.command)) {
      res.json({
        success: false,
        error: 'Only systemprompt commands are allowed',
      });
      return;
    }

    const args = parseCommandArgs(validationResult.command);
    executeCommand(args, res);
  } catch (error) {
    handleExecuteError(error, res);
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
