/**
 * Local MCP server entry point providing STDIO-based communication.
 * @file Local MCP server entry point.
 * @module server/mcp/local
 */

// eslint-disable-next-line systemprompt-os/no-block-comments
/* eslint-disable systemprompt-os/no-console-with-help */

import { LocalMcpServer } from '@/server/mcp/local/server.js';

/**
 * Legacy class name for compatibility.
 * @deprecated Use LocalMcpServer instead.
 */
export class LocalCliMcpServer extends LocalMcpServer {

}

/**
 * Redirect console output to stderr for STDIO communication.
 * @param args - Arguments to write.
 * @returns True if write was successful.
 */
const stderrWriter = (...args: string[]): boolean => {
  return process.stderr.write(`${args.join(' ')}\n`);
};

/**
 * Handle shutdown signals gracefully.
 * @param server - Server instance to stop.
 * @returns Promise that resolves when cleanup is complete.
 */
const createShutdownHandler = (server: LocalMcpServer): (() => Promise<void>) => {
  return async (): Promise<void> => {
    await server.stop();
    process.exit(0);
  };
};

/**
 * Start the local STDIO server.
 * This is used when the server is spawned as a separate process.
 * @returns Promise that resolves when server is started.
 */
export const startStdioServer = async function startStdioServer(): Promise<void> {
  console.log = stderrWriter;
  console.error = stderrWriter;
  console.warn = stderrWriter;
  console.info = stderrWriter;
  console.debug = stderrWriter;

  const server = new LocalMcpServer();
  const shutdownHandler = createShutdownHandler(server);

  process.on('SIGINT', (): void => {
    shutdownHandler().catch((error: unknown): void => {
      process.stderr.write(`Error during shutdown: ${String(error)}\n`);
      process.exit(1);
    });
  });
  process.on('SIGTERM', (): void => {
    shutdownHandler().catch((error: unknown): void => {
      process.stderr.write(`Error during shutdown: ${String(error)}\n`);
      process.exit(1);
    });
  });

  await server.start();
};

export { LocalMcpServer };
