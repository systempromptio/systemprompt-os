import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/config/cli/set.js';
import { ConfigModule } from '../../../../../../src/modules/core/config/index.js';

vi.mock('../../../../../../src/modules/core/config/index.js');

describe('Config Set Command', () => {
  let mockConfigModule: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Mock ConfigModule
    mockConfigModule = {
      initialize: vi.fn().mockResolvedValue(undefined),
      set: vi.fn()
    };

    vi.mocked(ConfigModule).mockImplementation(() => mockConfigModule);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should set string value for given key', async () => {
      await command.execute({ key: 'api.url', value: 'https://api.example.com' });

      expect(mockConfigModule.initialize).toHaveBeenCalledWith();
      expect(mockConfigModule.set).toHaveBeenCalledWith('api.url', 'https://api.example.com');
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Configuration updated:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  api.url = "https://api.example.com"');
    });

    it('should parse and set JSON object value', async () => {
      const jsonValue = '{"host":"localhost","port":3000}';
      await command.execute({ key: 'server', value: jsonValue });

      expect(mockConfigModule.set).toHaveBeenCalledWith('server', {
        host: 'localhost',
        port: 3000
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('  server = {"host":"localhost","port":3000}');
    });

    it('should parse and set JSON array value', async () => {
      const arrayValue = '["item1","item2","item3"]';
      await command.execute({ key: 'items', value: arrayValue });

      expect(mockConfigModule.set).toHaveBeenCalledWith('items', ['item1', 'item2', 'item3']);
    });

    it('should parse and set boolean true value', async () => {
      await command.execute({ key: 'enabled', value: 'true' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('enabled', true);
      expect(consoleLogSpy).toHaveBeenCalledWith('  enabled = true');
    });

    it('should parse and set boolean false value', async () => {
      await command.execute({ key: 'disabled', value: 'false' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('disabled', false);
      expect(consoleLogSpy).toHaveBeenCalledWith('  disabled = false');
    });

    it('should parse and set number value', async () => {
      await command.execute({ key: 'timeout', value: '5000' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('timeout', 5000);
      expect(consoleLogSpy).toHaveBeenCalledWith('  timeout = 5000');
    });

    it('should keep invalid JSON as string', async () => {
      await command.execute({ key: 'data', value: '{invalid:json}' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('data', '{invalid:json}');
      expect(consoleLogSpy).toHaveBeenCalledWith('  data = "{invalid:json}"');
    });

    it('should error when key is missing', async () => {
      await expect(command.execute({ key: '', value: 'test' })).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Both key and value are required.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should error when value is missing', async () => {
      await expect(command.execute({ key: 'test', value: '' })).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Both key and value are required.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle decimal numbers', async () => {
      await command.execute({ key: 'price', value: '19.99' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('price', 19.99);
    });

    it('should handle negative numbers', async () => {
      await command.execute({ key: 'offset', value: '-10' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('offset', -10);
    });

    it('should handle zero values', async () => {
      await command.execute({ key: 'count', value: '0' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('count', 0);
    });

    it('should handle scientific notation numbers', async () => {
      await command.execute({ key: 'large', value: '1e6' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('large', 1000000);
    });

    it('should handle very large numbers', async () => {
      await command.execute({ key: 'big', value: '9007199254740991' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('big', 9007199254740991);
    });

    it('should handle empty string values', async () => {
      await command.execute({ key: 'empty', value: '""' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('empty', '');
      expect(consoleLogSpy).toHaveBeenCalledWith('  empty = ""');
    });

    it('should handle null values', async () => {
      await command.execute({ key: 'nullable', value: 'null' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('nullable', null);
      expect(consoleLogSpy).toHaveBeenCalledWith('  nullable = null');
    });

    it('should handle undefined string (not actual undefined)', async () => {
      await command.execute({ key: 'undef', value: 'undefined' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('undef', 'undefined');
      expect(consoleLogSpy).toHaveBeenCalledWith('  undef = "undefined"');
    });

    it('should handle nested JSON objects', async () => {
      const nested = '{"level1":{"level2":{"value":"deep"}}}';
      await command.execute({ key: 'nested', value: nested });

      expect(mockConfigModule.set).toHaveBeenCalledWith('nested', {
        level1: { level2: { value: 'deep' } }
      });
    });

    it('should handle complex arrays with mixed types', async () => {
      const mixed = '[1,"string",true,null,{"key":"value"}]';
      await command.execute({ key: 'mixed', value: mixed });

      expect(mockConfigModule.set).toHaveBeenCalledWith('mixed', [1, 'string', true, null, { key: 'value' }]);
    });

    it('should handle empty arrays', async () => {
      await command.execute({ key: 'emptyArray', value: '[]' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('emptyArray', []);
    });

    it('should handle empty objects', async () => {
      await command.execute({ key: 'emptyObj', value: '{}' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('emptyObj', {});
    });

    it('should handle strings that look like numbers but have leading zeros', async () => {
      await command.execute({ key: 'leadingZero', value: '"007"' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('leadingZero', '007');
    });

    it('should handle strings with special characters', async () => {
      await command.execute({ key: 'special', value: '"Hello\\nWorld\\t!"' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('special', 'Hello\nWorld\t!');
    });

    it('should handle unicode strings', async () => {
      await command.execute({ key: 'unicode', value: '"🌟✨"' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('unicode', '🌟✨');
    });

    it('should handle very long strings', async () => {
      const longString = 'a'.repeat(1000);
      await command.execute({ key: 'long', value: `"${longString}"` });

      expect(mockConfigModule.set).toHaveBeenCalledWith('long', longString);
    });

    it('should handle keys with special characters', async () => {
      await command.execute({ key: 'api.v2.endpoints[0]', value: '"value"' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('api.v2.endpoints[0]', 'value');
    });

    it('should handle multiple JSON parsing attempts with malformed JSON', async () => {
      await command.execute({ key: 'malformed1', value: '{key: value}' });
      await command.execute({ key: 'malformed2', value: '{key:}' });
      await command.execute({ key: 'malformed3', value: '{"key": value}' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('malformed1', '{key: value}');
      expect(mockConfigModule.set).toHaveBeenCalledWith('malformed2', '{key:}');
      expect(mockConfigModule.set).toHaveBeenCalledWith('malformed3', '{"key": value}');
    });

    it('should handle initialization failure gracefully', async () => {
      mockConfigModule.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(command.execute({ key: 'test', value: 'value' })).rejects.toThrow('Init failed');
    });

    it('should handle set method throwing an error', async () => {
      mockConfigModule.set.mockImplementation(() => {
        throw new Error('Set failed');
      });

      await expect(command.execute({ key: 'test', value: 'value' })).rejects.toThrow('Set failed');
    });

    it('should handle context with undefined key', async () => {
      await expect(command.execute({ key: undefined, value: 'test' })).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Both key and value are required.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle context with undefined value', async () => {
      await expect(command.execute({ key: 'test', value: undefined })).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Both key and value are required.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle context with null key', async () => {
      await expect(command.execute({ key: null, value: 'test' })).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Both key and value are required.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle context with null value', async () => {
      await expect(command.execute({ key: 'test', value: null })).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Both key and value are required.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle very large JSON objects', async () => {
      const largeObj = {};
      for (let i = 0; i < 100; i++) {
        largeObj[`key${i}`] = `value${i}`;
      }
      const largeJson = JSON.stringify(largeObj);
      
      await command.execute({ key: 'large', value: largeJson });

      expect(mockConfigModule.set).toHaveBeenCalledWith('large', largeObj);
    });

    it('should handle floating point precision edge cases', async () => {
      await command.execute({ key: 'precision', value: '0.1' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('precision', 0.1);
    });

    it('should handle Infinity values', async () => {
      await command.execute({ key: 'infinity', value: 'Infinity' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('infinity', 'Infinity');
    });

    it('should handle -Infinity values', async () => {
      await command.execute({ key: 'negInfinity', value: '-Infinity' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('negInfinity', '-Infinity');
    });

    it('should handle NaN values', async () => {
      await command.execute({ key: 'notANumber', value: 'NaN' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('notANumber', 'NaN');
    });

    it('should handle boolean-like strings that are not exact booleans', async () => {
      await command.execute({ key: 'truthy', value: 'True' });
      await command.execute({ key: 'falsy', value: 'False' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('truthy', 'True');
      expect(mockConfigModule.set).toHaveBeenCalledWith('falsy', 'False');
    });
  });

  describe('parseValue function edge cases', () => {
    it('should handle JSON with whitespace', async () => {
      await command.execute({ key: 'whitespace', value: '  { "key" : "value" }  ' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('whitespace', { key: 'value' });
    });

    it('should handle JSON arrays with whitespace', async () => {
      await command.execute({ key: 'arrayWs', value: '  [ 1 , 2 , 3 ]  ' });

      expect(mockConfigModule.set).toHaveBeenCalledWith('arrayWs', [1, 2, 3]);
    });
  });

  describe('formatValue function coverage', () => {
    it('should format different value types correctly in output', async () => {
      // Test string formatting
      await command.execute({ key: 'str', value: 'hello' });
      expect(consoleLogSpy).toHaveBeenCalledWith('  str = "hello"');

      // Test object formatting
      await command.execute({ key: 'obj', value: '{"a":1}' });
      expect(consoleLogSpy).toHaveBeenCalledWith('  obj = {"a":1}');

      // Test number formatting
      await command.execute({ key: 'num', value: '42' });
      expect(consoleLogSpy).toHaveBeenCalledWith('  num = 42');

      // Test boolean formatting
      await command.execute({ key: 'bool', value: 'true' });
      expect(consoleLogSpy).toHaveBeenCalledWith('  bool = true');

      // Test null formatting
      await command.execute({ key: 'nullVal', value: 'null' });
      expect(consoleLogSpy).toHaveBeenCalledWith('  nullVal = null');
    });
  });

  describe('command structure and metadata', () => {
    it('should have correct command description', () => {
      expect(command.description).toBe('Set configuration value');
    });

    it('should have execute function', () => {
      expect(typeof command.execute).toBe('function');
    });
  });

  describe('ConfigModule integration', () => {
    it('should initialize ConfigModule with correct config path', async () => {
      await command.execute({ key: 'test', value: 'value' });

      expect(mockConfigModule.initialize).toHaveBeenCalledWith();
    });

    it('should call ConfigModule constructor', async () => {
      await command.execute({ key: 'test', value: 'value' });

      expect(ConfigModule).toHaveBeenCalled();
    });
  });
});