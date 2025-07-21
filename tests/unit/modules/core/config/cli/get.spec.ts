import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/config/cli/get';
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
  });
});