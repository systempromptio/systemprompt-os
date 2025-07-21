import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/config/cli/set';
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

      expect(mockConfigModule.initialize).toHaveBeenCalledWith({ 
        config: { configPath: './state/config' } 
      });
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
  });
});