#!/usr/bin/env node
/**
 * Test client for local MCP server
 */

import { spawn } from 'child_process';

const serverPath = process.argv[2] || '/app/build/server/mcp/local/index.js';

console.log('Starting local MCP test client...');

// Spawn the server
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send a tools/list request
const listRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
};

console.log('Sending tools/list request...');
server.stdin.write(JSON.stringify(listRequest) + '\n');

// Handle responses
server.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});

// Handle server exit
server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Exit after 5 seconds
setTimeout(() => {
  console.log('Test complete, shutting down...');
  server.kill();
  process.exit(0);
}, 5000);