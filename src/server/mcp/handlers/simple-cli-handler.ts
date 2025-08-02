/**
 * Simple CLI Handler for MCP
 * A lightweight version that doesn't depend on logger being initialized.
 */

import { spawn } from 'child_process';
import { join } from 'path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

interface IExecuteCliArgs {
  module?: string;
  command?: string;
  args?: string[];
  timeout?: number;
}

/**
 * Execute CLI command without logger dependency.
 */
export async function executeSimpleCli(args: IExecuteCliArgs): Promise<CallToolResult> {
  const { module, command, args: cmdArgs = [], timeout = 30000 } = args;
  
  if (!module || !command) {
    return {
      content: [{
        type: 'text',
        text: 'Error: Module and command are required'
      }],
      isError: true
    };
  }
  
  // Build the CLI command
  const cliPath = join(process.cwd(), 'bin', 'systemprompt');
  const cliArgs = [module, command, ...cmdArgs];
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    
    // Spawn the CLI process
    const proc = spawn(cliPath, cliArgs, {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' },
      shell: false
    });
    
    // Set timeout
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);
    
    // Capture output
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Handle completion
    proc.on('close', (code) => {
      clearTimeout(timer);
      
      if (timedOut) {
        resolve({
          content: [{
            type: 'text',
            text: `Command timed out after ${timeout}ms`
          }],
          isError: true
        });
      } else if (code === 0) {
        resolve({
          content: [{
            type: 'text',
            text: stdout || 'Command completed successfully'
          }]
        });
      } else {
        resolve({
          content: [{
            type: 'text',
            text: stderr || `Command failed with exit code ${code}`
          }],
          isError: true
        });
      }
    });
    
    proc.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        content: [{
          type: 'text',
          text: `Failed to execute command: ${error.message}`
        }],
        isError: true
      });
    });
  });
}

/**
 * Get simple system status without dependencies.
 */
export function getSimpleSystemStatus(): CallToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'running',
        platform: process.platform,
        node: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cwd: process.cwd(),
        timestamp: new Date().toISOString()
      }, null, 2)
    }]
  };
}