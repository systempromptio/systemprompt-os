/**
 * @fileoverview Unit tests for validate CLI command
 * @module tests/unit/modules/core/config/cli/validate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { command } from '../../../../../../src/modules/core/config/cli/validate.js';
import { ConfigModule } from '../../../../../../src/modules/core/config/index.js';

// Mock dependencies
vi.mock('fs');
vi.mock('../../../../../../src/modules/core/config/index.js', () => ({
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
      expect(mockConfigModule.initialize).toHaveBeenCalledWith();
      
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

  describe('edge cases and additional coverage', () => {
    it('handles invalid providers.available type in displayConfigSummary', async () => {
      mockConfigModule.get.mockReturnValue({
        ...validConfig,
        providers: {
          ...validConfig.providers,
          available: 'not-an-array'
        }
      });
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('providers.available must be an array');
    });

    it('handles invalid providers.enabled type in displayConfigSummary', async () => {
      mockConfigModule.get.mockReturnValue({
        ...validConfig,
        providers: {
          ...validConfig.providers,
          enabled: null
        }
      });
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('providers.enabled must be an array');
    });

    it('validates config without system defaults', async () => {
      mockConfigModule.get.mockReturnValue({
        defaults: {}, // No system section
        providers: validConfig.providers
      });
      
      await command.execute({});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('✓ Configuration is valid!');
    });

    it('handles YAML parsing error', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid: yaml: content:');
      
      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockImplementation(() => {
        throw new Error('YAML parsing failed');
      });
      
      await expect(command.execute({ file: 'config.yaml' }))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error: YAML parsing failed');
    });

    it('handles generic error in execute function', async () => {
      mockConfigModule.initialize.mockRejectedValue(new Error('Config initialization failed'));
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Error: Config initialization failed');
    });

    it('displays configuration summary with missing host/port', async () => {
      mockConfigModule.get.mockReturnValue({
        defaults: {
          system: {
            environment: 'production'
            // No host or port
          }
        },
        providers: validConfig.providers
      });
      
      await command.execute({});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('✓ Configuration is valid!');
      expect(output).toContain('Environment: production');
      expect(output).not.toContain('Server:');
    });

    it('displays configuration summary with missing environment', async () => {
      mockConfigModule.get.mockReturnValue({
        defaults: {
          system: {
            host: 'test.example.com',
            port: 3000
            // No environment
          }
        },
        providers: validConfig.providers
      });
      
      await command.execute({});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('✓ Configuration is valid!');
      expect(output).toContain('Server: test.example.com:3000');
      expect(output).not.toContain('Environment:');
    });

    it('handles missing default provider validation error', async () => {
      mockConfigModule.get.mockReturnValue({
        defaults: validConfig.defaults,
        providers: {
          available: ['provider1', 'provider2'],
          enabled: ['provider1']
          // No default - this should cause validation error
        }
      });
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('✗ Configuration is invalid!');
      expect(errorOutput).toContain('providers.default must be a string');
    });

    it('handles configuration with completely missing providers section in displayConfigSummary', async () => {
      mockConfigModule.get.mockReturnValue({
        defaults: validConfig.defaults
        // No providers section at all
      });
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('Missing required section: providers');
    });

    it('validates configuration with all optional fields present', async () => {
      const completeConfig = {
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
      
      mockConfigModule.get.mockReturnValue(completeConfig);
      
      await command.execute({});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('✓ Configuration is valid!');
      expect(output).toContain('Providers: 2 available, 1 enabled');
      expect(output).toContain('Default Provider: google-liveapi');
      expect(output).toContain('Environment: development');
      expect(output).toContain('Server: localhost:8080');
    });

    it('displays configuration summary when providers fields are invalid types but displayConfigSummary still runs', async () => {
      // This test covers the ternary operators in displayConfigSummary when arrays are not arrays
      const configWithInvalidProviders = {
        defaults: validConfig.defaults,
        providers: {
          available: 'not-an-array', // This will fail validation
          enabled: null, // This will fail validation
          default: 123 // This will fail validation
        }
      };
      
      mockConfigModule.get.mockReturnValue(configWithInvalidProviders);
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('✗ Configuration is invalid!');
      expect(errorOutput).toContain('providers.available must be an array');
      expect(errorOutput).toContain('providers.enabled must be an array');
      expect(errorOutput).toContain('providers.default must be a string');
    });

    it('displays configuration summary with mixed valid and missing provider fields', async () => {
      const mixedConfig = {
        defaults: {
          system: {
            host: 'mixed-host'
            // Missing port and environment
          }
        },
        providers: {
          available: ['provider1'],
          enabled: ['provider1'],
          default: 'provider1'
        }
      };
      
      mockConfigModule.get.mockReturnValue(mixedConfig);
      
      await command.execute({});
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('✓ Configuration is valid!');
      expect(output).toContain('Providers: 1 available, 1 enabled');
      expect(output).toContain('Default Provider: provider1');
      expect(output).not.toContain('Environment:');
      expect(output).not.toContain('Server:'); // Missing port means no server info
    });

    it('displays summary with empty provider arrays (should fail validation)', async () => {
      // This test will fail validation because default provider is not in enabled array
      // but it shows the logic path where arrays are empty
      const configWithEmptyArrays = {
        defaults: validConfig.defaults,
        providers: {
          available: [], // Empty array - should pass array check
          enabled: [], // Empty array - should pass array check 
          default: 'some-default' // Valid string but not in enabled array
        }
      };
      
      mockConfigModule.get.mockReturnValue(configWithEmptyArrays);
      
      await expect(command.execute({}))
        .rejects.toThrow('Process exited');
      
      const errorOutput = consoleErrorOutput.join('\n');
      expect(errorOutput).toContain('✗ Configuration is invalid!');
      expect(errorOutput).toContain("Default provider 'some-default' is not enabled");
    });
  });
});