#!/usr/bin/env node
/**
 * @fileoverview Local MCP server daemon
 * @module server/mcp/local/daemon
 */

import { LocalMCPServer } from './server.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const PIDFILE = '/app/state/mcp-local.pid';
const LOGFILE = '/app/logs/mcp-local.log';

/**
 * Write process ID to file for daemon management
 */
async function writePidFile(): Promise<void> {
  const dir = path.dirname(PIDFILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(PIDFILE, process.pid.toString());
}

/**
 * Remove PID file on exit
 */
async function removePidFile(): Promise<void> {
  try {
    await fs.unlink(PIDFILE);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Log message to file
 */
async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    await fs.appendFile(LOGFILE, logMessage);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

/**
 * Main daemon process
 */
async function main(): Promise<void> {
  await log('Starting MCP local server daemon');

  try {
    await writePidFile();

    const server = new LocalMCPServer();

    // Handle shutdown signals
    const shutdown = async (signal: string) => {
      await log(`Received ${signal}, shutting down...`);
      await server.stop();
      await removePidFile();
      process.exit(0);
    };

    process.on('SIGTERM', async () => shutdown('SIGTERM'));
    process.on('SIGINT', async () => shutdown('SIGINT'));
    process.on('SIGHUP', async () => shutdown('SIGHUP'));

    // Start the server
    await log('Starting STDIO server');
    await server.start();
  } catch (error) {
    await log(`Fatal error: ${error}`);
    await removePidFile();
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (error) => {
    await log(`Unhandled error: ${error}`);
    process.exit(1);
  });
}
