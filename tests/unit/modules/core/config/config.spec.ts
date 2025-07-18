/**
 * @fileoverview Unit tests for Config module
 * @module tests/unit/modules/core/config
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConfigModule } from '../../../../../src/modules/core/config/index.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}));

describe('ConfigModule', () => {
  let configModule: ConfigModule;
  const originalEnv = process.env;
  
  beforeEach(() => {
    configModule = new ConfigModule();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
  
  describe('initialization', () => {
    it('should initialize with default config', async () => {
      const mockLogger = { info: vi.fn() };
      vi.mocked(existsSync).mockReturnValue(false);
      
      await configModule.initialize({ logger: mockLogger });
      
      expect(vi.mocked(mkdirSync)).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Config module initialized');
    });
    
    it('should load config from file if exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        test: { key: 'value' }
      }));
      
      await configModule.initialize({});
      
      expect(configModule.get('test.key')).toBe('value');
    });
    
    it('should load config from environment variables', async () => {
      process.env.SYSTEMPROMPT_TEST_VALUE = 'env-value';
      vi.mocked(existsSync).mockReturnValue(false);
      
      await configModule.initialize({});
      
      expect(configModule.get('test.value')).toBe('env-value');
    });
  });
  
  describe('get/set operations', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      await configModule.initialize({});
    });
    
    it('should set and get config values', async () => {
      await configModule.set('app.name', 'TestApp');
      
      expect(configModule.get('app.name')).toBe('TestApp');
    });
    
    it('should return all config when key is not provided', () => {
      configModule.set('app.name', 'TestApp');
      configModule.set('app.version', '1.0.0');
      
      const allConfig = configModule.get();
      
      expect(allConfig).toEqual({
        app: {
          name: 'TestApp',
          version: '1.0.0'
        }
      });
    });
    
    it('should save configuration to file', async () => {
      await configModule.set('app.name', 'TestApp');
      
      expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
    });
  });
  
  describe('validation', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      await configModule.initialize({});
    });
    
    it('should validate valid configuration', () => {
      const result = configModule.validate({
        system: { port: 8080 }
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect invalid port number', () => {
      const result = configModule.validate({
        system: { port: 99999 }
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid port number: must be between 1 and 65535');
    });
  });
  
  describe('lifecycle', () => {
    it('should save configuration on stop', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      await configModule.initialize({});
      await configModule.set('app.name', 'TestApp');
      
      vi.clearAllMocks();
      await configModule.stop();
      
      expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
    });
  });
  
  describe('healthCheck', () => {
    it('should return healthy when config directory exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      await configModule.initialize({});
      
      const result = await configModule.healthCheck();
      
      expect(result).toEqual({ healthy: true });
    });
  });
});