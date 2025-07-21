/**
 * @fileoverview Unit tests for validate CLI command
 * @module tests/unit/modules/core/config/cli/validate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { command } from '../../../../../../src/modules/core/config/cli/validate';
import { ConfigModule } from '../../../../../../src/modules/core/config';

// Mock dependencies
vi.mock('fs');
vi.mock('../../../../../../src/modules/core/config', () => ({
  ConfigModule: vi.fn()
}));
vi.mock('yaml', () => ({
  parse: vi.fn()
}));

describe('validate CLI command', () => {
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalProcessExit: any;
  let consoleOutput: string[] = [];
  let consoleErrorOutput: string[] = [];
  let mockConfigModule: any;
  
  const validConfig = {
    defaults: {
      system: {
        port: 8080,
        host: 'localhost',
        environment: 'development',
        logLevel: 'info'
      }
    },
    providers: {
      available: ['google-liveapi', 'other-provider'],
      enabled: ['google-liveapi'],
      default: 'google-liveapi'
    }
  };
  
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
    
    // Mock ConfigModule
    mockConfigModule = {
      initialize: vi.fn(),
      get: vi.fn(() => validConfig)
    };
    vi.mocked(ConfigModule).mockReturnValue(mockConfigModule);
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });
  
  describe('validate current configuration', () => {
    it('validates current configuration successfully', async () => {
      await command.execute({});
      
      expect(ConfigModule).toHaveBeenCalled();
      expect(mockConfigModule.initialize).toHaveBeenCalledWith({ 
        config: { configPath: './state/config' } 
      });
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Validating Configuration...');
      expect(output).toContain('Validating current configuration');
      expect(output).toContain('✓ Configuration is valid!');
      expect(output).toContain('Providers: 2 available, 1 enabled');
      expect(output).toContain('Default Provider: google-liveapi');
      expect(output).toContain('Environment: development');
      expect(output).toContain('Server: localhost:8080');
    });
    
    it('detects missing defaults section', async () => {
      mockConfigModule.get.mockReturnValue({
        providers: validConfig.providers
      });
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('✗ Configuration is invalid!');
      expect(errorOutput).toContain('Missing required section: defaults');
    });
    
    it('detects invalid providers configuration', async () => {
      mockConfigModule.get.mockReturnValue({
        ...validConfig,
        providers: {
          available: ['google-liveapi'],
          enabled: ['google-liveapi', 'unknown-provider'],
          default: 'other-provider'
        }
      });
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('✗ Configuration is invalid!');
      expect(errorOutput).toContain("Enabled provider 'unknown-provider' is not in available providers");
      expect(errorOutput).toContain("Default provider 'other-provider' is not enabled");
    });
  });
  
  describe('validate external file', () => {
    it('validates JSON file successfully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validConfig));
      
      await command.execute({ file: 'config.json' });
      
      expect(existsSync).toHaveBeenCalled();
      expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('config.json'), 'utf-8');
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Validating file:');
      expect(output).toContain('config.json');
      expect(output).toContain('✓ Configuration is valid!');
    });
    
    it('validates YAML file successfully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('yaml content');
      
      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockReturnValue(validConfig);
      
      await command.execute({ file: 'config.yaml' });
      
      expect(yaml.parse).toHaveBeenCalledWith('yaml content');
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('✓ Configuration is valid!');
    });
    
    it('handles file not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      await expect(command.execute({ file: 'missing.json' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error: File not found:');
      expect(errorOutput).toContain('missing.json');
    });
    
    it('handles invalid JSON', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('{ invalid json');
      
      await expect(command.execute({ file: 'invalid.json' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error parsing file:');
    });
    
    it('handles unsupported file format', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('some content');
      
      await expect(command.execute({ file: 'config.txt' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error: Unsupported file format. Use .json or .yaml/.yml');
    });
  });
  
  describe('configuration validation rules', () => {
    it('validates system defaults', async () => {
      mockConfigModule.get.mockReturnValue({
        ...validConfig,
        defaults: {
          system: {
            port: 99999, // Invalid port
            host: 123, // Invalid type
            environment: 'invalid',
            logLevel: 'invalid'
          }
        }
      });
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('defaults.system.port must be a valid port number (1-65535)');
      expect(errorOutput).toContain('defaults.system.host must be a string');
      expect(errorOutput).toContain('defaults.system.environment must be one of: development, production, test');
      expect(errorOutput).toContain('defaults.system.logLevel must be one of: error, warn, info, debug');
    });
    
    it('validates providers structure', async () => {
      mockConfigModule.get.mockReturnValue({
        defaults: validConfig.defaults,
        providers: {
          available: 'not-an-array',
          enabled: null,
          default: 123
        }
      });
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('providers.available must be an array');
      expect(errorOutput).toContain('providers.enabled must be an array');
      expect(errorOutput).toContain('providers.default must be a string');
    });
    
    it('handles missing providers section gracefully', async () => {
      mockConfigModule.get.mockReturnValue({
        defaults: validConfig.defaults
      });
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Missing required section: providers');
    });
  });
});