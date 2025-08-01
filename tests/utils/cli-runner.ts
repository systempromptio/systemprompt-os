import { spawn } from 'child_process';
import path from 'path';

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs a CLI command and returns the result
 */
export async function runCLICommand(
  module: string, 
  command: string, 
  args: string[] = []
): Promise<CLIResult> {
  return new Promise((resolve) => {
    const binPath = path.join(process.cwd(), 'bin', 'systemprompt');
    const fullArgs = [module, command, ...args];
    
    const child = spawn(binPath, fullArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1
      });
    });

    child.on('error', (error) => {
      resolve({
        stdout: '',
        stderr: error.message,
        exitCode: 1
      });
    });

    // Add timeout to prevent hanging tests
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        stdout,
        stderr: stderr + '\nTest timed out',
        exitCode: 1
      });
    }, 30000); // 30 second timeout
  });
}