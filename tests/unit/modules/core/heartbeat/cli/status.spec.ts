/**
 * @fileoverview Unit tests for heartbeat status CLI command
 * @module tests/unit/modules/core/heartbeat/cli/status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/heartbeat/cli/status';
import { existsSync, readFileSync } from 'fs';

// Mock fs
vi.mock('fs');

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/'))
}));

describe('heartbeat status CLI command', () => {
  let mockContext: any;
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
    
    // Save and mock environment
    originalEnv = process.env;
    process.env = { ...originalEnv };
    
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
    
    // Default mock context
    mockContext = {
      cwd: '/test/project',
      args: {},
      flags: {},
      options: {}
    };
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    process.env = originalEnv;
  });
  
  describe('command metadata', () => {
    it('has correct name and description', () => {
      expect(command.name).toBe('status');
      expect(command.description).toBe('Show current heartbeat status');
    });
    
    it('defines format option', () => {
      expect(command.options).toBeDefined();
      const formatOption = command.options?.find(opt => opt.name === 'format');
      expect(formatOption).toBeDefined();
      expect(formatOption?.alias).toBe('f');
      expect(formatOption?.default).toBe('table');
    });
  });
  
  describe('execute', () => {
    it('shows message when no status file exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      await command.execute(mockContext);
      
      expect(consoleOutput).toContain('No heartbeat status found. Is the heartbeat daemon running?');
      expect(existsSync).toHaveBeenCalledWith('./state/data/heartbeat.json');
    });
    
    it('displays status in table format', async () => {
      const mockStatus = {
        status: 'healthy',
        timestamp: '2024-01-15T10:30:00Z',
        system: {
          uptime: 3600,
          memory: {
            usedPercent: 45.5
          },
          loadAvg: [1.2, 1.5, 1.8]
        }
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockStatus));
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Heartbeat Status');
      expect(output).toContain('================');
      expect(output).toContain('Status:     healthy');
      expect(output).toContain('Timestamp:  2024-01-15T10:30:00Z');
      expect(output).toContain('Uptime:     3600 seconds');
      expect(output).toContain('Memory:     45.5% used');
      expect(output).toContain('Load Avg:   1.2, 1.5, 1.8');
    });
    
    it('displays status in JSON format', async () => {
      const mockStatus = {
        status: 'healthy',
        timestamp: '2024-01-15T10:30:00Z'
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockStatus));
      mockContext.flags.format = 'json';
      
      await command.execute(mockContext);
      
      expect(consoleOutput).toContain(JSON.stringify(mockStatus, null, 2));
    });
    
    it('handles missing system data gracefully', async () => {
      const mockStatus = {
        status: 'unknown',
        timestamp: '2024-01-15T10:30:00Z'
        // No system data
      };
      
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockStatus));
      
      await command.execute(mockContext);
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Uptime:     N/A seconds');
      expect(output).toContain('Memory:     N/A% used');
      expect(output).toContain('Load Avg:   N/A');
    });
    
    it('uses custom state directory from environment', async () => {
      process.env.STATEDIR = '/custom/state';
      vi.mocked(existsSync).mockReturnValue(false);
      
      await command.execute(mockContext);
      
      expect(existsSync).toHaveBeenCalledWith('/custom/state/data/heartbeat.json');
    });
    
    it('handles file read errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      await expect(command.execute(mockContext)).rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error reading heartbeat status: Error: Permission denied');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('handles JSON parse errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json');
      
      await expect(command.execute(mockContext)).rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error reading heartbeat status:');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});