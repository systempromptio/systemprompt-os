import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { resolve } from 'path';

describe('CLI Commands E2E', () => {
  const cliPath = resolve(process.cwd(), 'bin', 'systemprompt');
  
  function runCommand(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [cliPath, ...args], {
        cwd: process.cwd()
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });
      
      child.on('error', reject);
    });
  }

  it('should show help when no command is provided', async () => {
    const { stdout, code } = await runCommand(['--help']);
    
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: systemprompt');
    expect(stdout).toContain('Commands:');
    expect(stdout).toContain('generatekey');
    expect(stdout).toContain('start');
    expect(stdout).toContain('status');
  });

  it('should execute status command', async () => {
    const { stdout, code } = await runCommand(['status']);
    
    expect(code).toBe(0);
    expect(stdout).toContain('System Status: OK');
    expect(stdout).toContain('Core Services:');
    expect(stdout).toContain('MCP Server: Running');
  });

  it('should show version', async () => {
    const { stdout, code } = await runCommand(['--version']);
    
    expect(code).toBe(0);
    expect(stdout.trim()).toBe('0.1.0');
  });

  it('should execute help command', async () => {
    const { stdout, code } = await runCommand(['help']);
    
    expect(code).toBe(0);
    expect(stdout).toContain('systemprompt-os - An operating system for autonomous agents');
    expect(stdout).toContain('Examples:');
  });

  it('should handle config command', async () => {
    const { stdout, code } = await runCommand(['config']);
    
    expect(code).toBe(0);
    expect(stdout).toContain('Current Configuration:');
    expect(stdout).toContain('system.port: 8080');
  });

  it('should handle config get command', async () => {
    const { stdout, code } = await runCommand(['config', 'system.port']);
    
    expect(code).toBe(0);
    expect(stdout).toContain('system.port: <value>');
  });
  
  it('should generate JWT keys', async () => {
    const { stdout, code } = await runCommand(['generatekey', '--output', './test-e2e-keys']);
    
    expect(code).toBe(0);
    expect(stdout).toContain('Generating RS256 key pair...');
    expect(stdout).toContain('Keys generated successfully:');
    expect(stdout).toContain('Private key: test-e2e-keys/private.key');
    expect(stdout).toContain('Public key:  test-e2e-keys/public.key');
    
    // Clean up
    const fs = await import('fs');
    fs.rmSync('./test-e2e-keys', { recursive: true, force: true });
  });
});