import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/config/cli/list.js';
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
  });
});