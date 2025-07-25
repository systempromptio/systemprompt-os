#!/usr/bin/env node
/**
 * @file Local MCP server daemon.
 * @module server/mcp/local/daemon
 */

import { LocalMcpServer } from '@/server/mcp/local/server.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const PIDFILE = '/app/state/mcp-local.pid';
const LOGFILE = '/app/logs/mcp-local.log';

/**
 * Write process ID to file for daemon management.
 */
const writePidFile = async function (): Promise<void> {
  const dir = path.dirname(PIDFILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(PIDFILE, process.pid.toString());
}

/**
 * Remove PID file on exit.
 */
const removePidFile = async function (): Promise<void> {
  try {
    await fs.unlink(PIDFILE);
  } catch {

  }
}

/**
 * Log message to file.
 * @param message
 */
const log = async function (message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    await fs.appendFile(LOGFILE, logMessage);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

/**
 * Main daemon process.
 */
const main = async function (): Promise<void> {
  await log('Starting MCP local server daemon');

  try {
    await writePidFile();

    const server = new LocalMcpServer();

    const shutdown = async (signal: string) => {
      await log(`Received ${signal}, shutting down...`);
      await server.stop();
      await removePidFile();
      process.exit(0);
    };

    process.on('SIGTERM', async () => { return await shutdown('SIGTERM') });
    process.on('SIGINT', async () => { return await shutdown('SIGINT') });
    process.on('SIGHUP', async () => { return await shutdown('SIGHUP') });

    await log('Starting STDIO server');
    await server.start();
  } catch (error) {
    await log(`Fatal error: ${error}`);
    await removePidFile();
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (error) => {
    await log(`Unhandled error: ${error}`);
    process.exit(1);
  });
}
