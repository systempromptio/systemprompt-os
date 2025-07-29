#!/usr/bin/env node
/**
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * - Main function exceeds 50-line limit (complex signal handling and server setup)
 * - JSDoc comments inside functions treated as disallowed comments by strict rules
 * - Empty catch block requires void statement instead of comment per no-void rule
 * - Multiple duplicated error reports for same comment violations
 * - Strict no-comments-in-functions rule conflicts with documentation needs.
 * Local MCP server daemon.
 * Provides a standalone daemon process for running the MCP server with STDIO transport.
 * @file Local MCP server daemon.
 * @module server/mcp/local/daemon
 */

import { LocalMcpServer } from '@/server/mcp/local/server';
import { MCP_LOCAL_LOGFILE, MCP_LOCAL_PIDFILE } from '@/server/constants/mcp.constants';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Write process ID to file for daemon management.
 * Creates the parent directory if it doesn't exist and writes the current process ID.
 */
const writePidFile = async function writePidFile(): Promise<void> {
  const dir = path.dirname(MCP_LOCAL_PIDFILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(MCP_LOCAL_PIDFILE, process.pid.toString());
}

/**
 * Remove PID file on exit.
 * Silently ignores errors if the file doesn't exist.
 */
const removePidFile = async function removePidFile(): Promise<void> {
  try {
    await fs.unlink(MCP_LOCAL_PIDFILE);
  } catch {
    void 0;
  }
}

/**
 * Log message to file.
 * Appends a timestamped message to the log file with fallback to console.
 * @param message - The message to log.
 */
const log = async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    const logDir = path.dirname(MCP_LOCAL_LOGFILE);
    await fs.mkdir(logDir, { recursive: true });
    await fs.appendFile(MCP_LOCAL_LOGFILE, logMessage);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Failed to write to log file: ${errorMessage}\n`);
  }
}

/**
 * Main daemon process.
 * Initializes the MCP server, sets up signal handlers, and starts the STDIO server.
 */
const main = async function main(): Promise<void> {
  await log('Starting MCP local server daemon');

  try {
    await writePidFile();

    const server = new LocalMcpServer();

    const shutdown = async (signal: string): Promise<void> => {
      await log(`Received ${signal}, shutting down...`);
      await server.stop();
      await removePidFile();
      process.exit(0);
    };

    const setupSignalHandlers = (): void => {
      process.on('SIGTERM', (): void => {
        shutdown('SIGTERM').catch(async (error: unknown): Promise<void> => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await log(`Error during SIGTERM shutdown: ${errorMessage}`);
          process.exit(1);
        });
      });
      process.on('SIGINT', (): void => {
        shutdown('SIGINT').catch(async (error: unknown): Promise<void> => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await log(`Error during SIGINT shutdown: ${errorMessage}`);
          process.exit(1);
        });
      });
      process.on('SIGHUP', (): void => {
        shutdown('SIGHUP').catch(async (error: unknown): Promise<void> => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await log(`Error during SIGHUP shutdown: ${errorMessage}`);
          process.exit(1);
        });
      });
    };

    setupSignalHandlers();

    await log('Starting STDIO server');
    await server.start();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await log(`Fatal error: ${errorMessage}`);
    await removePidFile();
    process.exit(1);
  }
}

/**
 * Export functions for testing.
 */
export {
  writePidFile,
  removePidFile,
  log,
  main
};

/**
 * Check if this module is being run directly.
 * Uses require.main comparison for CommonJS compatibility.
 * @returns True if this module is the main entry point.
 */
const isMainModule = (): boolean => {
  return require.main === module;
};

if (isMainModule()) {
  main().catch(async (error: unknown): Promise<void> => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await log(`Unhandled error: ${errorMessage}`);
    process.exit(1);
  });
}
