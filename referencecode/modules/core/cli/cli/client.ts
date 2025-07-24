/**
 * @fileoverview MCP client for interacting with local stdio server
 * @module cli/commands/mcp/client
 */

import { spawn, type ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

/**
 * JSON-RPC request structure
 */
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC response structure
 */
interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Simple MCP client for stdio communication
 */
export class MCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer: string = '';
  private readonly pendingRequests: Map<string | number, (response: JSONRPCResponse) => void> = new Map();

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    // Check if server is already running via named pipes
    const socketPath = '/tmp/mcp-local.sock';
    const fs = await import('fs');

    if (fs.existsSync(`${socketPath}.in`) && fs.existsSync(`${socketPath}.out`)) {
      // Use existing named pipes
      const { createReadStream, createWriteStream } = fs;

      this.process = {
        stdin: createWriteStream(`${socketPath}.in`),
        stdout: createReadStream(`${socketPath}.out`),
        stderr: null,
        on: (_event: string, _handler: any) => {},
        kill: () => true,
      } as any;
    } else {
      // Spawn new process
      this.process = spawn('node', ['/app/build/server/mcp/servers/local-cli/stdio.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          console.error('MCP Server Error:', data.toString());
        });
      }
    }

    if (this.process && this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });
    }

    // Initialize connection
    await this.sendRequest('initialize', {
      protocolVersion: '0.1.0',
      capabilities: {},
      clientInfo: {
        name: 'systemprompt-cli',
        version: '1.0.0',
      },
    });
  }

  /**
   * Process buffered data for complete JSON messages
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as JSONRPCResponse;
          const handler = this.pendingRequests.get(message.id);
          if (handler) {
            handler(message);
            this.pendingRequests.delete(message.id);
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      }
    }
  }

  /**
   * Send a JSON-RPC request
   */
  private async sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.process?.stdin) {
      throw new Error('Not connected to MCP server');
    }

    const id = randomUUID();
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      this.process!.stdin!.write(`${JSON.stringify(request)  }\n`);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 5000);
    });
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    const result = (await this.sendRequest('tools/list')) as { tools: MCPTool[] };
    return result.tools;
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: unknown = {}): Promise<unknown> {
    const result = (await this.sendRequest('tools/call', {
      name,
      arguments: args,
    })) as { content: Array<{ type: string; text: string }> };

    if (result.content?.[0]?.type === 'text') {
      try {
        return JSON.parse(result.content[0].text);
      } catch {
        return result.content[0].text;
      }
    }

    return result;
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.process && typeof this.process.kill === 'function') {
      this.process.kill();
    }
    this.process = null;
  }
}
