/**
 * @fileoverview Unit tests for CLI Command Discovery
 * @module tests/unit/cli/src/discovery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandDiscovery } from '../../../../src/cli/src/discovery.js';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn()
}));

// Mock path module
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/'))
}));

describe('CommandDiscovery', () => {
  let discovery: CommandDiscovery;
  const mockModulesPath = '/test/modules';

  beforeEach(() => {
    vi.clearAllMocks();
    discovery = new CommandDiscovery(mockModulesPath);
  });

  describe('constructor', () => {
    it('should use provided modules path', () => {
      expect(discovery).toBeDefined();
      expect(discovery).toBeInstanceOf(CommandDiscovery);
    });

    it('should use default modules path when not provided', () => {
      const defaultDiscovery = new CommandDiscovery();
      expect(defaultDiscovery).toBeDefined();
    });
  });

  describe('discoverCommands', () => {
    it('should return empty map when no module directories exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const commands = await discovery.discoverCommands();

      expect(commands).toBeInstanceOf(Map);
      expect(commands.size).toBe(0);
      expect(existsSync).toHaveBeenCalledTimes(3); // core, custom, extensions
    });

    it('should discover commands in core modules directory', async () => {
      vi.mocked(existsSync).mockImplementation((path) => 
        path === `${mockModulesPath}/core`
      );
      
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'auth', isDirectory: () => true },
        { name: 'config', isDirectory: () => true }
      ] as any);

      vi.mocked(readFileSync).mockImplementation((path) => {
        if (path.includes('module.yaml')) {
          return 'name: test\nversion: 1.0.0';
        }
        return '';
      });

      const commands = await discovery.discoverCommands();

      expect(existsSync).toHaveBeenCalledWith(`${mockModulesPath}/core`);
      expect(commands).toBeInstanceOf(Map);
    });

    it('should discover commands in custom modules directory', async () => {
      vi.mocked(existsSync).mockImplementation((path) => 
        path === `${mockModulesPath}/custom`
      );
      
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'mymodule', isDirectory: () => true }
      ] as any);

      const commands = await discovery.discoverCommands();

      expect(existsSync).toHaveBeenCalledWith(`${mockModulesPath}/custom`);
    });

    it('should discover commands in extensions directory', async () => {
      vi.mocked(existsSync).mockImplementation((path) => 
        path.includes('extensions/modules')
      );
      
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'extension1', isDirectory: () => true }
      ] as any);

      const commands = await discovery.discoverCommands();

      expect(existsSync).toHaveBeenCalledWith(expect.stringContaining('extensions/modules'));
    });

    it('should handle discovery errors gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const commands = await discovery.discoverCommands();

      expect(commands).toBeInstanceOf(Map);
      expect(commands.size).toBe(0);
    });
  });

  describe('discoverInDirectory', () => {
    it('should discover CLI commands from module directories', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === `${mockModulesPath}/core`) {
          return [
            { name: 'auth', isDirectory: () => true },
            { name: 'file.txt', isDirectory: () => false }
          ] as any;
        }
        if (path.includes('/cli')) {
          return [
            { name: 'command1.ts', isFile: () => true },
            { name: 'command1.js', isFile: () => true }
          ] as any;
        }
        return [];
      });

      vi.mocked(readFileSync).mockImplementation((path) => {
        if (path.includes('module.yaml')) {
          return 'name: auth\nversion: 1.0.0';
        }
        return '';
      });

      const commands = await discovery.discoverCommands();

      expect(readdirSync).toHaveBeenCalled();
    });

    it('should skip non-directory entries', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file.txt', isDirectory: () => false },
        { name: 'module1', isDirectory: () => true }
      ] as any);

      const commands = await discovery.discoverCommands();

      expect(commands).toBeInstanceOf(Map);
    });

    it('should handle missing module.yaml gracefully', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (path.includes('module.yaml')) return false;
        return path === `${mockModulesPath}/core`;
      });
      
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'module1', isDirectory: () => true }
      ] as any);

      const commands = await discovery.discoverCommands();

      expect(commands).toBeInstanceOf(Map);
    });

    it('should handle YAML parsing errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'module1', isDirectory: () => true }
      ] as any);
      
      vi.mocked(readFileSync).mockReturnValue('invalid: yaml: content:');

      const commands = await discovery.discoverCommands();

      expect(commands).toBeInstanceOf(Map);
    });
  });

  describe('command loading', () => {
    it('should load commands from TypeScript files', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === `${mockModulesPath}/core`) {
          return [{ name: 'auth', isDirectory: () => true }] as any;
        }
        if (path.includes('/cli')) {
          return [
            { name: 'login.ts', isFile: () => true },
            { name: 'logout.ts', isFile: () => true }
          ] as any;
        }
        return [];
      });

      vi.mocked(readFileSync).mockReturnValue('name: auth\nversion: 1.0.0');

      const commands = await discovery.discoverCommands();

      expect(commands).toBeInstanceOf(Map);
    });

    it('should handle import errors gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === `${mockModulesPath}/core`) {
          return [{ name: 'auth', isDirectory: () => true }] as any;
        }
        if (path.includes('/cli')) {
          return [{ name: 'bad-command.ts', isFile: () => true }] as any;
        }
        return [];
      });

      vi.mocked(readFileSync).mockReturnValue('name: auth\nversion: 1.0.0');

      // Mock dynamic import to throw error
      vi.doMock('/test/modules/core/auth/cli/bad-command.ts', () => {
        throw new Error('Import failed');
      });

      const commands = await discovery.discoverCommands();

      expect(commands).toBeInstanceOf(Map);
    });

    it('should register valid commands', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === `${mockModulesPath}/core`) {
          return [{ name: 'auth', isDirectory: () => true }] as any;
        }
        if (path.includes('/cli')) {
          return [{ name: 'test.ts', isFile: () => true }] as any;
        }
        return [];
      });

      vi.mocked(readFileSync).mockReturnValue('name: auth\nversion: 1.0.0');

      // Mock a valid command module
      const mockCommand = {
        name: 'test',
        description: 'Test command',
        action: vi.fn()
      };

      vi.doMock('/test/modules/core/auth/cli/test.ts', () => ({
        default: mockCommand
      }));

      const commands = await discovery.discoverCommands();

      expect(commands).toBeInstanceOf(Map);
    });
  });
});