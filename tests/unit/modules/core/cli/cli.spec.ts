/**
 * @fileoverview Unit tests for CLI module
 * @module tests/unit/modules/core/cli
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CLIModule } from '../../../../../src/modules/core/cli/index.js';
import { CommandDiscovery } from '../../../../../src/tools/cli/src/discovery.js';

vi.mock('../../../../../src/tools/cli/src/discovery.js', () => ({
  CommandDiscovery: vi.fn().mockImplementation(() => ({
    discoverCommands: vi.fn()
  }))
}));

describe('CLIModule', () => {
  let cliModule: CLIModule;
  let mockDiscovery: any;
  
  beforeEach(() => {
    cliModule = new CLIModule();
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize with command discovery', async () => {
      const mockLogger = { info: vi.fn() };
      
      await cliModule.initialize({ logger: mockLogger });
      
      expect(CommandDiscovery).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('CLI module initialized');
    });
  });
  
  describe('getAllCommands', () => {
    it('should return discovered commands', async () => {
      const mockCommands = new Map([
        ['test:unit', { description: 'Run unit tests' }],
        ['auth:generatekey', { description: 'Generate keys' }]
      ]);
      
      mockDiscovery = {
        discoverCommands: vi.fn().mockResolvedValue(mockCommands)
      };
      
      vi.mocked(CommandDiscovery).mockImplementation(() => mockDiscovery);
      
      await cliModule.initialize({});
      const commands = await cliModule.getAllCommands();
      
      expect(commands).toBe(mockCommands);
    });
  });
  
  describe('getCommandHelp', () => {
    it('should return help for existing command', () => {
      const commands = new Map([
        ['test:unit', { 
          description: 'Run unit tests',
          options: [
            { name: 'file', alias: 'f', description: 'Test file', default: 'all' },
            { name: 'watch', alias: 'w', description: 'Watch mode', required: true }
          ]
        }]
      ]);
      
      const help = cliModule.getCommandHelp('test:unit', commands);
      
      expect(help).toContain('Command: test:unit');
      expect(help).toContain('Description: Run unit tests');
      expect(help).toContain('--file, -f');
      expect(help).toContain('(default: all)');
      expect(help).toContain('[required]');
    });
    
    it('should return not found message for missing command', () => {
      const commands = new Map();
      
      const help = cliModule.getCommandHelp('unknown:command', commands);
      
      expect(help).toBe('Command not found: unknown:command');
    });
  });
  
  describe('formatCommands', () => {
    const testCommands = new Map([
      ['auth:generatekey', { description: 'Generate keys' }],
      ['auth:validate', { description: 'Validate tokens' }],
      ['config:get', { description: 'Get config' }],
      ['test:unit', { description: 'Run unit tests' }]
    ]);
    
    it('should format commands as text', () => {
      const output = cliModule.formatCommands(testCommands, 'text');
      
      expect(output).toContain('auth commands:');
      expect(output).toContain('generatekey');
      expect(output).toContain('Generate keys');
      expect(output).toContain('config commands:');
    });
    
    it('should format commands as JSON', () => {
      const output = cliModule.formatCommands(testCommands, 'json');
      const parsed = JSON.parse(output);
      
      expect(parsed['auth:generatekey']).toEqual({ description: 'Generate keys' });
      expect(parsed['config:get']).toEqual({ description: 'Get config' });
    });
    
    it('should format commands as table', () => {
      const output = cliModule.formatCommands(testCommands, 'table');
      
      expect(output).toContain('Available Commands');
      expect(output).toContain('auth:generatekey');
      expect(output).toContain('Generate keys');
    });
  });
  
  describe('generateDocs', () => {
    it('should generate markdown documentation', () => {
      const commands = new Map([
        ['auth:generatekey', { 
          description: 'Generate keys',
          options: [
            { name: 'type', alias: 't', description: 'Key type' }
          ]
        }]
      ]);
      
      const docs = cliModule.generateDocs(commands, 'markdown');
      
      expect(docs).toContain('# SystemPrompt OS CLI Commands');
      expect(docs).toContain('## Usage');
      expect(docs).toContain('### auth module');
      expect(docs).toContain('#### auth:generatekey');
      expect(docs).toContain('**Options:**');
      expect(docs).toContain('`--type, -t`');
    });
    
    it('should generate JSON documentation for non-markdown format', () => {
      const commands = new Map([
        ['test:unit', { description: 'Run tests' }]
      ]);
      
      const docs = cliModule.generateDocs(commands, 'html');
      const parsed = JSON.parse(docs);
      
      expect(parsed['test:unit']).toEqual({ description: 'Run tests' });
    });
  });
  
  describe('module properties', () => {
    it('should have correct module metadata', () => {
      expect(cliModule.name).toBe('cli');
      expect(cliModule.version).toBe('1.0.0');
      expect(cliModule.type).toBe('service');
    });
  });
});