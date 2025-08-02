/**
 * Execute CLI tool handler for running SystemPrompt OS CLI commands.
 * @file Execute CLI tool handler for SystemPrompt OS commands.
 * @module handlers/tools/execute-cli
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import {
  type CallToolResult,
  type IToolHandlerContext,
  type ToolHandler,
} from '@/server/mcp/core/handlers/tools/types';
import { formatToolResponse } from '@/server/mcp/core/handlers/types/core.types';

const logger = LoggerService.getInstance();

/**
 * CLI execution arguments interface.
 */
interface IExecuteCliArgs {
  /** Module name (e.g., 'database', 'auth', 'dev') */
  module?: string;
  /** Command name (e.g., 'status', 'list', 'migrate') */
  command?: string;
  /** Additional arguments for the command */
  args?: string[];
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * CLI execution result interface.
 */
interface ICliExecutionResult {
  /** Command that was executed */
  command: string;
  /** Exit code from the process */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error output */
  stderr: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Whether the command timed out */
  timedOut: boolean;
}

/**
 * Validates and sanitizes CLI arguments.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
const validateCliArgs = (args: IExecuteCliArgs): { valid: boolean; error?: string } => {
  // Validate module name
  if (args.module) {
    if (!/^[a-zA-Z0-9-_]+$/.test(args.module)) {
      return { valid: false, error: 'Invalid module name format' };
    }
  }

  // Validate command name  
  if (args.command) {
    if (!/^[a-zA-Z0-9-_]+$/.test(args.command)) {
      return { valid: false, error: 'Invalid command name format' };
    }
  }

  // Validate additional arguments
  if (args.args) {
    for (const arg of args.args) {
      // Allow more characters in args but still restrict dangerous ones
      if (/[;&|<>`$]/.test(arg)) {
        return { valid: false, error: `Invalid argument contains shell operators: ${arg}` };
      }
    }
  }

  return { valid: true };
};

/**
 * Executes a SystemPrompt OS CLI command.
 */
const executeCliCommand = async (args: IExecuteCliArgs): Promise<ICliExecutionResult> => {
  const startTime = Date.now();
  const timeout = args.timeout || 30000;
  
  // Build command array
  const commandParts: string[] = [];
  if (args.module) commandParts.push(args.module);
  if (args.command) commandParts.push(args.command);
  if (args.args) commandParts.push(...args.args);

  // If no command specified, default to help
  if (commandParts.length === 0) {
    commandParts.push('--help');
  }

  const commandString = `./bin/systemprompt ${commandParts.join(' ')}`;
  
  logger.debug(LogSource.MCP, `Executing CLI command: ${commandString}`, {
    category: 'tool',
    persistToDb: false,
  });

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Get the project root directory (where bin/systemprompt is located)
    const projectRoot = join(process.cwd());
    const binPath = join(projectRoot, 'bin', 'systemprompt');

    // Spawn the CLI process
    const childProcess = spawn(binPath, commandParts, {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=8192',
      },
      shell: false,
    });

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      childProcess.kill('SIGTERM');
    }, timeout);

    // Capture stdout
    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Capture stderr
    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      clearTimeout(timeoutHandle);
      
      const executionTime = Date.now() - startTime;
      
      resolve({
        command: commandString,
        exitCode: code || 0,
        stdout,
        stderr,
        executionTime,
        timedOut,
      });
    });

    // Handle process error
    childProcess.on('error', (error) => {
      clearTimeout(timeoutHandle);
      
      const executionTime = Date.now() - startTime;
      
      resolve({
        command: commandString,
        exitCode: 1,
        stdout,
        stderr: error.message,
        executionTime,
        timedOut: false,
      });
    });
  });
};

/**
 * Handler for executing SystemPrompt OS CLI commands.
 * @param args - CLI execution arguments.
 * @param context - Tool handler context.
 * @returns Tool execution result.
 */
export const handleExecuteCli: ToolHandler<IExecuteCliArgs> = async (
  args: IExecuteCliArgs,
  context: IToolHandlerContext,
): Promise<CallToolResult> => {
  try {
    logger.debug(LogSource.MCP, 'Executing CLI command', {
      category: 'tool',
      metadata: { args },
      persistToDb: false,
    });

    // Validate arguments
    const validation = validateCliArgs(args);
    if (!validation.valid) {
      return formatToolResponse({
        content: [
          {
            type: 'text',
            text: `Error: ${validation.error}`,
          },
        ],
        isError: true,
      });
    }

    // Execute the command
    const result = await executeCliCommand(args);

    // Format the response
    const responseText = [
      `Command: ${result.command}`,
      `Exit Code: ${result.exitCode}`,
      `Execution Time: ${result.executionTime}ms`,
      result.timedOut ? '⚠️ Command timed out' : '',
      '',
      '--- Output ---',
      result.stdout || '(no output)',
      result.stderr ? `\n--- Errors ---\n${result.stderr}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return formatToolResponse({
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
      isError: result.exitCode !== 0,
    });
  } catch (error) {
    logger.error(LogSource.MCP, 'Failed to execute CLI command', {
      category: 'tool',
      error,
      persistToDb: true,
    });

    return formatToolResponse({
      content: [
        {
          type: 'text',
          text: `Error executing CLI command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    });
  }
};