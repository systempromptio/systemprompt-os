import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command, formatTree, formatYaml } from '../../../../../../src/modules/core/config/cli/list.js';
import { ConfigModule } from '../../../../../../src/modules/core/config/index.js';

vi.mock('../../../../../../src/modules/core/config/index.js');

describe('Config List Command', () => {
  let mockConfigModule: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

    // Mock ConfigModule
    mockConfigModule = {
      initialize: vi.fn().mockResolvedValue(undefined),
      get: vi.fn()
    };

    vi.mocked(ConfigModule).mockImplementation(() => mockConfigModule);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should display config in tree format by default', async () => {
      const testConfig = {
        api: {
          url: 'https://api.example.com',
          timeout: 5000
        },
        auth: {
          provider: 'google',
          enabled: true
        }
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({});

      expect(mockConfigModule.initialize).toHaveBeenCalledWith({ 
        config: { configPath: './state/config' } 
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('\nConfiguration Values:');
      expect(consoleLogSpy).toHaveBeenCalledWith('====================\n');
      
      // Check for tree format output
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('├── api/');
      expect(output).toContain('│   ├── url: "https://api.example.com"');
      expect(output).toContain('│   └── timeout: 5000');
      expect(output).toContain('└── auth/');
      expect(output).toContain('    ├── provider: "google"');
      expect(output).toContain('    └── enabled: true');
    });

    it('should display config in JSON format when specified', async () => {
      const testConfig = {
        api: { url: 'https://api.example.com' },
        auth: { provider: 'google' }
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'json' });

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(testConfig, null, 2));
    });

    it('should display config in YAML format when specified', async () => {
      const testConfig = {
        api: {
          url: 'https://api.example.com',
          port: 443
        },
        debug: false
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'yaml' });

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('api:');
      expect(output).toContain('  url: "https://api.example.com"');
      expect(output).toContain('  port: 443');
      expect(output).toContain('debug: false');
    });

    it('should show message when no config values exist', async () => {
      mockConfigModule.get.mockReturnValue({});

      await command.execute({});

      expect(consoleLogSpy).toHaveBeenCalledWith('No configuration values found.');
      expect(consoleLogSpy).not.toHaveBeenCalledWith('\nConfiguration Values:');
    });

    it('should handle null config', async () => {
      mockConfigModule.get.mockReturnValue(null);

      await command.execute({});

      expect(consoleLogSpy).toHaveBeenCalledWith('No configuration values found.');
    });

    it('should handle arrays in tree format', async () => {
      const testConfig = {
        servers: ['server1', 'server2', 'server3'],
        ports: [8080, 8081, 8082]
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({});

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('├── servers: ["server1","server2","server3"]');
      expect(output).toContain('└── ports: [8080,8081,8082]');
    });

    it('should handle nested objects in tree format', async () => {
      const testConfig = {
        database: {
          primary: {
            host: 'db1.example.com',
            port: 5432
          },
          replica: {
            host: 'db2.example.com',
            port: 5432
          }
        }
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({});

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('└── database/');
      expect(output).toContain('    ├── primary/');
      expect(output).toContain('    │   ├── host: "db1.example.com"');
      expect(output).toContain('    └── replica/');
    });

    it('should handle mixed value types', async () => {
      const testConfig = {
        string: 'test',
        number: 42,
        boolean: true,
        nullValue: null,
        object: { key: 'value' },
        array: [1, 2, 3]
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'json' });

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(testConfig, null, 2));
    });

    it('should handle undefined config', async () => {
      mockConfigModule.get.mockReturnValue(undefined);

      await command.execute({});

      expect(consoleLogSpy).toHaveBeenCalledWith('No configuration values found.');
    });

    it('should handle null values in YAML format', async () => {
      mockConfigModule.get.mockReturnValue(null);

      await command.execute({ format: 'yaml' });

      expect(consoleLogSpy).toHaveBeenCalledWith('No configuration values found.');
    });

    it('should handle primitive values in YAML format', async () => {
      const testConfig = {
        stringValue: 'test string',
        numberValue: 123,
        booleanValue: false,
        nullValue: null,
        arrayValue: ['item1', 'item2']
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'yaml' });

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('stringValue: "test string"');
      expect(output).toContain('numberValue: 123');
      expect(output).toContain('booleanValue: false');
      expect(output).toContain('nullValue: null');
      expect(output).toContain('arrayValue: ["item1","item2"]');
    });

    it('should handle empty child objects in tree format', async () => {
      const testConfig = {
        parent: {
          child: {}
        }
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({});

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('└── parent/');
      expect(output).toContain('    └── child/');
    });

    it('should handle ConfigModule initialization failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      mockConfigModule.initialize.mockRejectedValue(new Error('Initialization failed'));

      await expect(command.execute({})).rejects.toThrow('Initialization failed');

      consoleSpy.mockRestore();
    });

    it('should handle unknown format gracefully', async () => {
      const testConfig = {
        key: 'value'
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'unknown' });

      // Should default to tree format
      expect(consoleLogSpy).toHaveBeenCalledWith('\nConfiguration Values:');
      expect(consoleLogSpy).toHaveBeenCalledWith('====================\n');
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('└── key: "value"');
    });

    it('should handle deeply nested YAML objects', async () => {
      const testConfig = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        }
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'yaml' });

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('level1:');
      expect(output).toContain('  level2:');
      expect(output).toContain('    level3:');
      expect(output).toContain('      value: "deep"');
    });

    it('should handle special characters in values', async () => {
      const testConfig = {
        special: 'value with "quotes" and \n newlines',
        unicode: '🚀 emoji value',
        empty: '',
        whitespace: '   spaces   '
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'json' });

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(testConfig, null, 2));
    });

    it('should handle boolean and numeric edge cases in tree format', async () => {
      const testConfig = {
        zero: 0,
        negative: -42,
        float: 3.14,
        trueValue: true,
        falseValue: false,
        infinity: Infinity,
        negativeInfinity: -Infinity
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({});

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('zero: 0');
      expect(output).toContain('negative: -42');
      expect(output).toContain('float: 3.14');
      expect(output).toContain('trueValue: true');
      expect(output).toContain('falseValue: false');
      expect(output).toContain('infinity: Infinity');
      expect(output).toContain('negativeInfinity: -Infinity');
    });

    it('should handle null primitive value directly in YAML', async () => {
      // This test specifically targets the null handling in formatYaml function
      const testConfig = null;
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'yaml' });

      expect(consoleLogSpy).toHaveBeenCalledWith('No configuration values found.');
    });

    it('should handle undefined primitive value directly in YAML', async () => {
      const testConfig = undefined;
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'yaml' });

      expect(consoleLogSpy).toHaveBeenCalledWith('No configuration values found.');
    });

    it('should handle single primitive string in YAML format', async () => {
      // Test for the string handling in formatYaml when data is not an object
      const testConfig = 'simple string';
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'yaml' });

      expect(consoleLogSpy).toHaveBeenCalledWith('"simple string"');
    });

    it('should handle single number in YAML format', async () => {
      const testConfig = 42;
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({ format: 'yaml' });

      expect(consoleLogSpy).toHaveBeenCalledWith('42');
    });

    it('should handle empty string values in tree format', async () => {
      const testConfig = {
        emptyString: '',
        whitespaceOnly: '   '
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({});

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('emptyString: ""');
      expect(output).toContain('whitespaceOnly: "   "');
    });

    it('should handle NaN and undefined values in config', async () => {
      const testConfig = {
        nanValue: NaN,
        undefinedValue: undefined,
        nullValue: null
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({});

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('nanValue: NaN');
      expect(output).toContain('undefinedValue: undefined');
      expect(output).toContain('nullValue: null');
    });

    it('should handle complex nested objects with null values', async () => {
      const testConfig = {
        outer: {
          inner: {
            nullChild: null,
            undefinedChild: undefined,
            value: 'test'
          }
        }
      };
      mockConfigModule.get.mockReturnValue(testConfig);

      await command.execute({});

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(output).toContain('└── outer/');
      expect(output).toContain('    └── inner/');
      expect(output).toContain('        ├── nullChild: null');
      expect(output).toContain('        ├── undefinedChild: undefined');
      expect(output).toContain('        └── value: "test"');
    });
  });

  describe('formatTree', () => {
    it('should return empty string for null input', () => {
      const result = formatTree(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = formatTree(undefined);
      expect(result).toBe('');
    });

    it('should handle empty object', () => {
      const result = formatTree({});
      expect(result).toBe('');
    });

    it('should format simple object', () => {
      const data = { key: 'value' };
      const result = formatTree(data);
      expect(result).toBe('└── key: "value"');
    });

    it('should handle nested objects with custom prefix', () => {
      const data = { parent: { child: 'value' } };
      const result = formatTree(data, '  ');
      expect(result).toContain('  └── parent/');
      expect(result).toContain('      └── child: "value"');
    });
  });

  describe('formatYaml', () => {
    it('should return "null" for null input', () => {
      const result = formatYaml(null);
      expect(result).toBe('null');
    });

    it('should handle string values', () => {
      const result = formatYaml('test string');
      expect(result).toBe('"test string"');
    });

    it('should handle numeric values', () => {
      const result = formatYaml(42);
      expect(result).toBe('42');
    });

    it('should handle boolean values', () => {
      const result = formatYaml(true);
      expect(result).toBe('true');
    });

    it('should handle array values', () => {
      const result = formatYaml(['item1', 'item2']);
      expect(result).toBe('["item1","item2"]');
    });

    it('should handle nested objects with indentation', () => {
      const data = { level1: { level2: 'value' } };
      const result = formatYaml(data, 1);
      expect(result).toContain('  level1:');
      expect(result).toContain('    level2: "value"');
    });

    it('should handle empty objects', () => {
      const result = formatYaml({});
      expect(result).toBe('');
    });
  });
});