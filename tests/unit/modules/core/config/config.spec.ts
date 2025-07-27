/**
 * @fileoverview Unit tests for Config module
 * @module tests/unit/modules/core/config
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConfigModule, createModule, initialize, getConfigModule } from '../../../../../src/modules/core/config/index.js';
import { ConfigService } from '../../../../../src/modules/core/config/services/config.service.js';
import { LoggerService } from '../../../../../src/modules/core/logger/services/logger.service.js';
import { ModuleStatusEnum } from '../../../../../src/modules/core/modules/types/index.js';

// Mock ConfigService
vi.mock('../../../../../src/modules/core/config/services/config.service.js', () => ({
  ConfigService: {
    getInstance: vi.fn()
  }
}));

// Mock LoggerService
vi.mock('../../../../../src/modules/core/logger/services/logger.service.js', () => ({
  LoggerService: {
    getInstance: vi.fn()
  }
}));

// Mock module loader for getConfigModule tests
vi.mock('../../../../../src/modules/loader.ts', () => ({
  getModuleLoader: vi.fn()
}));

vi.mock('../../../../../src/modules/types/index.ts', () => ({
  ModuleName: {
    CONFIG: 'config'
  }
}));

describe('ConfigModule', () => {
  let configModule: ConfigModule;
  let mockConfigService: any;
  let mockLogger: any;
  
  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    // Setup mock config service
    mockConfigService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue('test-value'),
      set: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      validate: vi.fn().mockResolvedValue({ valid: true })
    };
    
    vi.mocked(LoggerService.getInstance).mockReturnValue(mockLogger);
    vi.mocked(ConfigService.getInstance).mockReturnValue(mockConfigService);
    
    configModule = new ConfigModule();
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await configModule.initialize();
      
      expect(LoggerService.getInstance).toHaveBeenCalled();
      expect(ConfigService.getInstance).toHaveBeenCalled();
      expect(mockConfigService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('modules', 'Config module initialized');
    });
    
    it('should throw error if already initialized', async () => {
      await configModule.initialize();
      
      await expect(configModule.initialize()).rejects.toThrow('Config module already initialized');
    });
    
    it('should handle initialization errors', async () => {
      const error = new Error('Service initialization failed');
      mockConfigService.initialize.mockRejectedValue(error);
      
      await expect(configModule.initialize()).rejects.toThrow('Failed to initialize config module: Service initialization failed');
    });
    
    it('should handle non-Error initialization failures', async () => {
      mockConfigService.initialize.mockRejectedValue('String error');
      
      await expect(configModule.initialize()).rejects.toThrow('Failed to initialize config module: String error');
    });
  });
  
  describe('lifecycle management', () => {
    beforeEach(async () => {
      await configModule.initialize();
    });
    
    describe('start', () => {
      it('should start successfully when initialized', async () => {
        await configModule.start();
        
        expect(configModule.status).toBe(ModuleStatusEnum.RUNNING);
        expect(mockLogger.info).toHaveBeenCalledWith('modules', 'Config module started');
      });
      
      it('should throw error if not initialized', async () => {
        const uninitializedModule = new ConfigModule();
        
        await expect(uninitializedModule.start()).rejects.toThrow('Config module not initialized');
      });
      
      it('should not start again if already started', async () => {
        await configModule.start();
        vi.clearAllMocks();
        
        await configModule.start();
        
        expect(mockLogger.info).not.toHaveBeenCalled();
      });
    });
    
    describe('stop', () => {
      it('should stop successfully when started', async () => {
        await configModule.start();
        await configModule.stop();
        
        expect(configModule.status).toBe(ModuleStatusEnum.STOPPED);
        expect(mockLogger.info).toHaveBeenCalledWith('modules', 'Config module stopped');
      });
      
      it('should not log when stopping if not started', async () => {
        await configModule.stop();
        
        expect(mockLogger.info).not.toHaveBeenCalledWith('modules', 'Config module stopped');
      });
    });
  });
  
  describe('get/set operations', () => {
    beforeEach(async () => {
      await configModule.initialize();
    });
    
    it('should get config value with key', async () => {
      const result = await configModule.get('test.key');
      
      expect(mockConfigService.get).toHaveBeenCalledWith('test.key');
      expect(result).toBe('test-value');
    });
    
    it('should list all config when key is not provided', async () => {
      const mockEntries = [{ key: 'test', value: 'value', createdAt: new Date(), updatedAt: new Date() }];
      mockConfigService.list.mockResolvedValue(mockEntries);
      
      const result = await configModule.get();
      
      expect(mockConfigService.list).toHaveBeenCalled();
      expect(result).toBe(mockEntries);
    });
    
    it('should set config value', async () => {
      await configModule.set('app.name', 'TestApp');
      
      expect(mockConfigService.set).toHaveBeenCalledWith('app.name', 'TestApp');
    });
  });
  
  describe('healthCheck', () => {
    it('should return unhealthy when not initialized', async () => {
      const result = await configModule.healthCheck();
      
      expect(result).toEqual({
        healthy: false,
        message: 'Config module not initialized'
      });
    });
    
    it('should return unhealthy when initialized but not started', async () => {
      await configModule.initialize();
      
      const result = await configModule.healthCheck();
      
      expect(result).toEqual({
        healthy: false,
        message: 'Config module not started'
      });
    });
    
    it('should return healthy when initialized and started', async () => {
      await configModule.initialize();
      await configModule.start();
      
      const result = await configModule.healthCheck();
      
      expect(result).toEqual({
        healthy: true,
        message: 'Config module is healthy'
      });
    });
  });
  
  describe('exports', () => {
    beforeEach(async () => {
      await configModule.initialize();
    });
    
    it('should provide service export', () => {
      const exports = configModule.exports;
      
      expect(exports.service).toBeInstanceOf(Function);
      expect(exports.service()).toBe(mockConfigService);
    });
    
    it('should provide get export', async () => {
      const exports = configModule.exports;
      
      expect(exports.get).toBeInstanceOf(Function);
      const result = await exports.get('test.key');
      expect(result).toBe('test-value');
    });
    
    it('should provide set export', async () => {
      const exports = configModule.exports;
      
      expect(exports.set).toBeInstanceOf(Function);
      await exports.set('test.key', 'test-value');
      expect(mockConfigService.set).toHaveBeenCalledWith('test.key', 'test-value');
    });
  });
  
  describe('module properties', () => {
    it('should have correct module properties', () => {
      expect(configModule.name).toBe('config');
      expect(configModule.type).toBe('core');
      expect(configModule.version).toBe('1.0.0');
      expect(configModule.description).toBe('Configuration management module for SystemPrompt OS');
      expect(configModule.dependencies).toEqual(['database', 'logger']);
      expect(configModule.status).toBe(ModuleStatusEnum.STOPPED);
    });
  });
  
});

describe('Factory Functions', () => {
  let mockConfigService: any;
  let mockLogger: any;
  
  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    // Setup mock config service
    mockConfigService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue('test-value'),
      set: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      validate: vi.fn().mockResolvedValue({ valid: true })
    };
    
    vi.mocked(LoggerService.getInstance).mockReturnValue(mockLogger);
    vi.mocked(ConfigService.getInstance).mockReturnValue(mockConfigService);
    vi.clearAllMocks();
  });
  
  describe('createModule', () => {
    it('should create a new ConfigModule instance', () => {
      const module = createModule();
      
      expect(module).toBeInstanceOf(ConfigModule);
      expect(module.name).toBe('config');
    });
  });
  
  describe('initialize', () => {
    it('should create and initialize a ConfigModule', async () => {
      const module = await initialize();
      
      expect(module).toBeInstanceOf(ConfigModule);
      expect(LoggerService.getInstance).toHaveBeenCalled();
      expect(ConfigService.getInstance).toHaveBeenCalled();
    });
  });
  
  describe('getConfigModule', () => {
    let mockModuleLoader: any;
    
    beforeEach(() => {
      mockModuleLoader = {
        getModule: vi.fn()
      };
      
      const { getModuleLoader } = require('../../../../../src/modules/loader.ts');
      vi.mocked(getModuleLoader).mockReturnValue(mockModuleLoader);
    });
    
    it('should return config module with valid exports', () => {
      const mockModule = {
        exports: {
          service: vi.fn(),
          get: vi.fn(),
          set: vi.fn()
        }
      };
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      
      const result = getConfigModule();
      
      expect(result).toBe(mockModule);
      expect(mockModuleLoader.getModule).toHaveBeenCalledWith('config');
    });
    
    it('should throw error if service export is missing', () => {
      const mockModule = {
        exports: {
          get: vi.fn(),
          set: vi.fn()
        }
      };
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      
      expect(() => getConfigModule()).toThrow('Config module missing required service export');
    });
    
    it('should throw error if service export is not a function', () => {
      const mockModule = {
        exports: {
          service: 'not-a-function',
          get: vi.fn(),
          set: vi.fn()
        }
      };
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      
      expect(() => getConfigModule()).toThrow('Config module missing required service export');
    });
    
    it('should throw error if get export is missing', () => {
      const mockModule = {
        exports: {
          service: vi.fn(),
          set: vi.fn()
        }
      };
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      
      expect(() => getConfigModule()).toThrow('Config module missing required get export');
    });
    
    it('should throw error if get export is not a function', () => {
      const mockModule = {
        exports: {
          service: vi.fn(),
          get: 'not-a-function',
          set: vi.fn()
        }
      };
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      
      expect(() => getConfigModule()).toThrow('Config module missing required get export');
    });
    
    it('should throw error if set export is missing', () => {
      const mockModule = {
        exports: {
          service: vi.fn(),
          get: vi.fn()
        }
      };
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      
      expect(() => getConfigModule()).toThrow('Config module missing required set export');
    });
    
    it('should throw error if set export is not a function', () => {
      const mockModule = {
        exports: {
          service: vi.fn(),
          get: vi.fn(),
          set: 'not-a-function'
        }
      };
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      
      expect(() => getConfigModule()).toThrow('Config module missing required set export');
    });
  });
});