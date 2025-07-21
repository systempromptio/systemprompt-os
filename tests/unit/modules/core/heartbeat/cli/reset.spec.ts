/**
 * @fileoverview Unit tests for heartbeat reset CLI command
 * @module tests/unit/modules/core/heartbeat/cli/reset
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import { command } from '../../../../../../src/modules/core/heartbeat/cli/reset';

// Mock fs module
vi.mock('fs');

describe('heartbeat reset CLI command', () => {
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalProcessExit: any;
  let originalEnv: any;
  let consoleOutput: string[] = [];
  let consoleErrorOutput: string[] = [];
  
  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    consoleErrorOutput = [];
    
    // Mock console
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = vi.fn((...args) => consoleOutput.push(args.join(' ')));
    console.error = vi.fn((...args) => consoleErrorOutput.push(args.join(' ')));
    
    // Mock process.exit
    originalProcessExit = process.exit;
    process.exit = vi.fn(() => {
      throw new Error('Process exited');
    }) as any;
    
    // Store original env
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    process.env = originalEnv;
  });
  
  it('has correct command metadata', () => {
    expect(command.name).toBe('reset');
    expect(command.description).toBe('Reset heartbeat state');
    expect(command.options).toHaveLength(1);
    expect(command.options[0]).toEqual({
      name: 'force',
      alias: 'f',
      type: 'boolean',
      description: 'Force reset without confirmation',
      default: false
    });
  });
  
  it('handles no existing heartbeat state', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    
    const context = {
      flags: { force: true }
    };
    
    await command.execute(context);
    
    expect(existsSync).toHaveBeenCalledWith('state/data/heartbeat.json');
    expect(unlinkSync).not.toHaveBeenCalled();
    expect(consoleOutput).toContain('No heartbeat state to reset.');
  });
  
  it('requires force flag for reset', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    
    const context = {
      flags: { force: false }
    };
    
    await command.execute(context);
    
    expect(unlinkSync).not.toHaveBeenCalled();
    const output = consoleOutput.join('\n');
    expect(output).toContain('This will reset the heartbeat state.');
    expect(output).toContain('Use --force to skip this confirmation.');
  });
  
  it('resets heartbeat state with force flag', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    
    const context = {
      flags: { force: true }
    };
    
    await command.execute(context);
    
    expect(existsSync).toHaveBeenCalledWith('state/data/heartbeat.json');
    expect(unlinkSync).toHaveBeenCalledWith('state/data/heartbeat.json');
    expect(consoleOutput).toContain('Heartbeat state has been reset.');
  });
  
  it('uses custom state directory from environment', async () => {
    process.env.STATEDIR = '/custom/state';
    vi.mocked(existsSync).mockReturnValue(true);
    
    const context = {
      flags: { force: true }
    };
    
    await command.execute(context);
    
    expect(existsSync).toHaveBeenCalledWith('/custom/state/data/heartbeat.json');
    expect(unlinkSync).toHaveBeenCalledWith('/custom/state/data/heartbeat.json');
  });
  
  it('handles unlink errors', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(unlinkSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });
    
    const context = {
      flags: { force: true }
    };
    
    await expect(command.execute(context))
      .rejects.toThrow('Process exited');
    
    const errorOutput = consoleErrorOutput.join('\n');
    expect(errorOutput).toContain('Error resetting heartbeat state:');
    expect(errorOutput).toContain('Permission denied');
  });
});