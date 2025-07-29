/**
 * Bootstrap Integration Test with TypeScript Compilation
 * 
 * Tests the full bootstrap process of the SystemPrompt OS application
 * ensuring all modules load correctly and the system initializes properly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';

describe('Bootstrap Integration with TypeScript', () => {
  let serverProcess: any;
  const projectRoot = join(__dirname, '../../..');
  const timeout = 30000; // 30 seconds for bootstrap

  beforeAll(() => {
    // Ensure the project is built
    if (!existsSync(join(projectRoot, 'dist'))) {
      throw new Error('Project not built. Run npm run build first.');
    }
  });

  afterAll(() => {
    // Clean up server process if running
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
    }
  });

  it('should compile TypeScript without errors', async () => {
    const tscProcess = spawn('npm', ['run', 'typecheck'], {
      cwd: projectRoot,
      shell: true,
    });

    const output: string[] = [];
    const errors: string[] = [];

    tscProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    tscProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    await new Promise<void>((resolve, reject) => {
      tscProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`TypeScript compilation failed with code ${code}\n${errors.join('')}`));
        }
      });
    });

    expect(tscProcess.exitCode).toBe(0);
  }, timeout);

  it('should bootstrap the application successfully', async () => {
    const bootstrapProcess = spawn('npm', ['run', 'dev'], {
      cwd: projectRoot,
      shell: true,
      env: { ...process.env, NODE_ENV: 'test' },
    });

    serverProcess = bootstrapProcess;

    const output: string[] = [];
    const errors: string[] = [];
    let bootstrapComplete = false;

    bootstrapProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output.push(message);
      
      // Check for successful bootstrap indicators
      if (message.includes('Bootstrap completed successfully') ||
          message.includes('Server started on port') ||
          message.includes('All modules initialized')) {
        bootstrapComplete = true;
      }
    });

    bootstrapProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    // Wait for bootstrap to complete or timeout
    await new Promise<void>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (bootstrapComplete) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          resolve();
        }
      }, 100);

      const timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error(`Bootstrap timeout after ${timeout}ms\nOutput: ${output.join('')}\nErrors: ${errors.join('')}`));
      }, timeout);

      bootstrapProcess.on('error', (err) => {
        clearInterval(checkInterval);
        clearTimeout(timeoutId);
        reject(err);
      });
    });

    expect(bootstrapComplete).toBe(true);
    expect(errors).toHaveLength(0);
  }, timeout);

  it('should have all core modules loaded and initialized', async () => {
    // Use the CLI to check module status
    const statusProcess = spawn('npm', ['run', 'cli', '--', 'modules', 'status'], {
      cwd: projectRoot,
      shell: true,
    });

    const output: string[] = [];
    const errors: string[] = [];

    statusProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    statusProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    await new Promise<void>((resolve, reject) => {
      statusProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`CLI status command failed with code ${code}\n${errors.join('')}`));
        }
      });
    });

    const outputText = output.join('');
    
    // Check for core modules
    const coreModules = [
      'database',
      'logger',
      'auth',
      'users',
      'config',
      'cli',
      'modules',
      'tasks',
      'permissions',
      'system',
    ];

    for (const moduleName of coreModules) {
      expect(outputText).toContain(moduleName);
      // Should show as RUNNING or ACTIVE
      expect(outputText).toMatch(new RegExp(`${moduleName}.*(?:RUNNING|ACTIVE|INITIALIZED)`, 'i'));
    }

    expect(errors).toHaveLength(0);
  }, timeout);

  it('should respond to health checks', async () => {
    const healthProcess = spawn('npm', ['run', 'cli', '--', 'system', 'health'], {
      cwd: projectRoot,
      shell: true,
    });

    const output: string[] = [];
    const errors: string[] = [];

    healthProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    healthProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    await new Promise<void>((resolve, reject) => {
      healthProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Health check failed with code ${code}\n${errors.join('')}`));
        }
      });
    });

    const outputText = output.join('');
    
    // Should indicate healthy system
    expect(outputText.toLowerCase()).toContain('healthy');
    expect(errors).toHaveLength(0);
  }, timeout);
});