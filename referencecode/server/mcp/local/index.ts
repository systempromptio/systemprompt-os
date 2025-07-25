/**
 * @fileoverview Local MCP server entry point
 * @module server/mcp/local
 */

import { LocalMCPServer } from './server.js';

/**
 * Legacy class name for compatibility
 * @deprecated Use LocalMCPServer instead
 */
export class LocalCLIMCPServer extends LocalMCPServer {
  // Inherit all functionality from LocalMCPServer
}

/**
 * Start the local STDIO server
 * This is used when the server is spawned as a separate process
 */
export async function startStdioServer(): Promise<void> {
  // Redirect console to stderr to avoid polluting stdout
  console.log = (...args) => process.stderr.write(`${args.join(' ')  }\n`);
  console.error = (...args) => process.stderr.write(`${args.join(' ')  }\n`);
  console.warn = (...args) => process.stderr.write(`${args.join(' ')  }\n`);
  console.info = (...args) => process.stderr.write(`${args.join(' ')  }\n`);
  console.debug = (...args) => process.stderr.write(`${args.join(' ')  }\n`);

  const server = new LocalMCPServer();

  // Handle shutdown signals
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  await server.start();
}

export { LocalMCPServer };