import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/config/cli/get.js';
import { ConfigModule } from '../../../../../../src/modules/core/config/index.js';

vi.mock('../../../../../../src/modules/core/config/index.js');

describe('Config Get Command', () => {
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
      get: vi.fn()
    };

    vi.mocked(ConfigModule).mockImplementation(() => mockConfigModule);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should get and display config value for given key', async () => {
      const testValue = { apiUrl: 'https://api.example.com', timeout: 5000 };
      mockConfigModule.get.mockReturnValue(testValue);

      await command.execute({ key: 'api' });

      expect(mockConfigModule.initialize).toHaveBeenCalledWith({ 
        config: { configPath: './state/config' } 
      });
      expect(mockConfigModule.get).toHaveBeenCalledWith('api');
      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(testValue, null, 2));
    });

    it('should display all config when no key specified', async () => {
      const allConfig = { 
        api: { url: 'https://api.example.com' },
        auth: { provider: 'google' }
      };
      mockConfigModule.get.mockReturnValue(allConfig);

      await command.execute({});

      expect(mockConfigModule.get).toHaveBeenCalledWith(undefined);
      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(allConfig, null, 2));
    });

    it('should show error when key not found', async () => {
      mockConfigModule.get.mockReturnValue(undefined);

      await expect(command.execute({ key: 'nonexistent' })).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith("Configuration key 'nonexistent' not found.");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show message when no config values exist', async () => {
      mockConfigModule.get.mockReturnValue(undefined);

      await command.execute({});

      expect(consoleLogSpy).toHaveBeenCalledWith('No configuration values found.');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should handle string values', async () => {
      mockConfigModule.get.mockReturnValue('simple-string-value');

      await command.execute({ key: 'simple' });

      expect(consoleLogSpy).toHaveBeenCalledWith('"simple-string-value"');
    });

    it('should handle number values', async () => {
      mockConfigModule.get.mockReturnValue(42);

      await command.execute({ key: 'answer' });

      expect(consoleLogSpy).toHaveBeenCalledWith('42');
    });

    it('should handle boolean values', async () => {
      mockConfigModule.get.mockReturnValue(true);

      await command.execute({ key: 'enabled' });

      expect(consoleLogSpy).toHaveBeenCalledWith('true');
    });

    it('should handle array values', async () => {
      const arrayValue = ['item1', 'item2', 'item3'];
      mockConfigModule.get.mockReturnValue(arrayValue);

      await command.execute({ key: 'items' });

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(arrayValue, null, 2));
    });

    it('should handle ConfigModule initialization failure', async () => {
      mockConfigModule.initialize.mockRejectedValue(new Error('Initialization failed'));

      await expect(command.execute({ key: 'test' })).rejects.toThrow('Initialization failed');
    });

    it('should handle ConfigModule.get() throwing an error', async () => {
      mockConfigModule.get.mockImplementation(() => {
        throw new Error('Config get failed');
      });

      await expect(command.execute({ key: 'test' })).rejects.toThrow('Config get failed');
    });

    it('should handle ICLIContext format correctly', async () => {
      const testValue = 'test-value';
      mockConfigModule.get.mockReturnValue(testValue);

      await command.execute({
        args: { key: 'test' },
        flags: {},
        cwd: '/test',
        env: {}
      });

      expect(mockConfigModule.get).toHaveBeenCalledWith('test');
      expect(consoleLogSpy).toHaveBeenCalledWith('"test-value"');
    });

    it('should handle undefined args in ICLIContext format', async () => {
      const allConfig = { test: 'value' };
      mockConfigModule.get.mockReturnValue(allConfig);

      await command.execute({
        args: undefined,
        flags: {},
        cwd: '/test',
        env: {}
      });

      expect(mockConfigModule.get).toHaveBeenCalledWith(undefined);
      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(allConfig, null, 2));
    });

    it('should handle null values', async () => {
      mockConfigModule.get.mockReturnValue(null);

      await command.execute({ key: 'nullable' });

      expect(consoleLogSpy).toHaveBeenCalledWith('null');
    });

    it('should handle nested object values', async () => {
      const nestedObject = {
        level1: {
          level2: {
            level3: 'deeply nested value'
          }
        }
      };
      mockConfigModule.get.mockReturnValue(nestedObject);

      await command.execute({ key: 'nested' });

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(nestedObject, null, 2));
    });

    it('should handle empty object values', async () => {
      mockConfigModule.get.mockReturnValue({});

      await command.execute({ key: 'empty' });

      expect(consoleLogSpy).toHaveBeenCalledWith('{}');
    });

    it('should handle empty array values', async () => {
      mockConfigModule.get.mockReturnValue([]);

      await command.execute({ key: 'emptyArray' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[]');
    });

    it('should handle zero numeric values', async () => {
      mockConfigModule.get.mockReturnValue(0);

      await command.execute({ key: 'zero' });

      expect(consoleLogSpy).toHaveBeenCalledWith('0');
    });

    it('should handle false boolean values', async () => {
      mockConfigModule.get.mockReturnValue(false);

      await command.execute({ key: 'disabled' });

      expect(consoleLogSpy).toHaveBeenCalledWith('false');
    });

    it('should handle empty string values', async () => {
      mockConfigModule.get.mockReturnValue('');

      await command.execute({ key: 'empty' });

      expect(consoleLogSpy).toHaveBeenCalledWith('""');
    });

    it('should handle keys with special characters', async () => {
      const specialValue = 'special value';
      mockConfigModule.get.mockReturnValue(specialValue);

      await command.execute({ key: 'special-key.with_chars' });

      expect(mockConfigModule.get).toHaveBeenCalledWith('special-key.with_chars');
      expect(consoleLogSpy).toHaveBeenCalledWith('"special value"');
    });

    it('should handle empty key string', async () => {
      const allConfig = { test: 'all config data' };
      mockConfigModule.get.mockReturnValue(allConfig);

      await command.execute({ key: '' });

      // Empty string key should be treated as truthy, so should trigger key-specific behavior
      expect(mockConfigModule.get).toHaveBeenCalledWith('');
      expect(mockConfigModule.get).not.toHaveBeenCalledWith(undefined);
    });

    it('should handle whitespace-only key', async () => {
      const whitespaceValue = 'whitespace key value';
      mockConfigModule.get.mockReturnValue(whitespaceValue);

      await command.execute({ key: '   ' });

      expect(mockConfigModule.get).toHaveBeenCalledWith('   ');
      expect(consoleLogSpy).toHaveBeenCalledWith('"whitespace key value"');
    });

    it('should handle large nested objects', async () => {
      const largeObject = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          settings: {
            theme: 'dark',
            notifications: true,
            preferences: {
              language: 'en',
              timezone: 'UTC'
            }
          }
        }))
      };
      mockConfigModule.get.mockReturnValue(largeObject);

      await command.execute({ key: 'users' });

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(largeObject, null, 2));
    });

    it('should exit with code 1 when key is found but value is undefined', async () => {
      mockConfigModule.get.mockReturnValue(undefined);

      await expect(command.execute({ key: 'definitelyExists' })).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith("Configuration key 'definitelyExists' not found.");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should not exit when no key is provided and no config exists', async () => {
      mockConfigModule.get.mockReturnValue(undefined);

      await command.execute({});

      expect(consoleLogSpy).toHaveBeenCalledWith('No configuration values found.');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should handle JSON serialization errors gracefully', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      mockConfigModule.get.mockReturnValue(circularObj);

      await expect(command.execute({ key: 'circular' })).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error serializing configuration value:', expect.any(TypeError));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});