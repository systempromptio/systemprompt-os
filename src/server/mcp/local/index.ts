/**
 * @file Local MCP server entry point.
 * @module server/mcp/local
 */

import { LocalMCPServer } from '@/server/mcp/local/server.js';

/**
 * Legacy class name for compatibility.
 * @deprecated Use LocalMCPServer instead.
 */
export class LocalCLIMCPServer extends LocalMCPServer {

}

/**
 * Start the local STDIO server.
 * This is used when the server is spawned as a separate process.
 */
export const startStdioServer = async function (): Promise<void> {
  console.log = (...args) => { return process.stderr.write(`${args.join(' ')}\n`) };
  console.error = (...args) => { return process.stderr.write(`${args.join(' ')}\n`) };
  console.warn = (...args) => { return process.stderr.write(`${args.join(' ')}\n`) };
  console.info = (...args) => { return process.stderr.write(`${args.join(' ')}\n`) };
  console.debug = (...args) => { return process.stderr.write(`${args.join(' ')}\n`) };

  const server = new LocalMCPServer();

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
