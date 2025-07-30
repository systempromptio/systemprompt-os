/**
 * System module tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  SystemModule, 
  createModule, 
  initialize,
  getSystemModule,
  ConfigTypeEnum,
  EventSeverityEnum,
  MaintenanceTypeEnum,
  ModulesStatus
} from '../../../../../src/modules/core/system/index.js';
import { ModulesType } from '../../../../../src/modules/core/modules/types/database.generated.js';
import { SystemService } from '../../../../../src/modules/core/system/services/system.service.js';
import { LoggerService } from '../../../../../src/modules/core/logger/services/logger.service.js';
import { LogSource } from '../../../../../src/modules/core/logger/types/index.js';

// Mock the services
vi.mock('../../../../../src/modules/core/system/services/system.service.js');
vi.mock('../../../../../src/modules/core/logger/services/logger.service.js');
vi.mock('@/modules/loader', () => ({
  getModuleLoader: vi.fn(() => ({
    getModule: vi.fn()
  }))
}));
vi.mock('@/modules/types/index', () => ({
  ModuleName: {
    SYSTEM: 'system'
  }
}));

describe('SystemModule', () => {
  let systemModule: SystemModule;
  let mockSystemService: any;
  let mockLogger: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    
    // Create mock system service
    mockSystemService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      setLogger: vi.fn()
    };
    
    // Mock LoggerService.getInstance
    vi.mocked(LoggerService.getInstance).mockReturnValue(mockLogger);
    
    // Mock SystemService.getInstance
    vi.mocked(SystemService.getInstance).mockReturnValue(mockSystemService);
    
    systemModule = new SystemModule();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Module Interface', () => {
    it('should have correct module properties', () => {
      expect(systemModule.name).toBe('system');
      expect(systemModule.version).toBe('1.0.0');
      expect(systemModule.type).toBe('service');
      expect(systemModule.description).toBe('Core system management and configuration functionality');
      expect(systemModule.dependencies).toEqual(['logger', 'database']);
      expect(systemModule.status).toBe(ModuleStatusEnum.STOPPED);
    });
    
    it('should implement required methods', () => {
      expect(systemModule.initialize).toBeDefined();
      expect(systemModule.start).toBeDefined();
      expect(systemModule.stop).toBeDefined();
      expect(systemModule.healthCheck).toBeDefined();
      expect(systemModule.getService).toBeDefined();
    });
    
    it('should have exports getter', () => {
      expect(systemModule.exports).toBeDefined();
      expect(typeof systemModule.exports.service).toBe('function');
    });
    
    it('should not be initialized or started initially', () => {
      expect((systemModule as any).initialized).toBe(false);
      expect((systemModule as any).started).toBe(false);
    });
  });
  
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await systemModule.initialize();
      
      expect(LoggerService.getInstance).toHaveBeenCalled();
      expect(SystemService.getInstance).toHaveBeenCalled();
      expect(mockSystemService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'System module initialized');
      expect((systemModule as any).initialized).toBe(true);
    });
    
    it('should throw error if already initialized', async () => {
      await systemModule.initialize();
      
      await expect(systemModule.initialize()).rejects.toThrow('System module already initialized');
    });
    
    it('should handle initialization error from system service', async () => {
      const error = new Error('SystemService initialization failed');
      mockSystemService.initialize.mockRejectedValue(error);
      
      await expect(systemModule.initialize()).rejects.toThrow('Failed to initialize system module: SystemService initialization failed');
      expect((systemModule as any).initialized).toBe(false);
    });
    
    it('should handle non-Error objects during initialization', async () => {
      mockSystemService.initialize.mockRejectedValue('String error');
      
      await expect(systemModule.initialize()).rejects.toThrow('Failed to initialize system module: String error');
    });
  });
  
  describe('start', () => {
    it('should start successfully when initialized', async () => {
      await systemModule.initialize();
      await systemModule.start();
      
      expect(systemModule.status).toBe(ModuleStatusEnum.RUNNING);
      expect((systemModule as any).started).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'System module started');
    });
    
    it('should throw error when not initialized', async () => {
      await expect(systemModule.start()).rejects.toThrow('System module not initialized');
      expect(systemModule.status).toBe(ModuleStatusEnum.STOPPED);
      expect((systemModule as any).started).toBe(false);
    });
    
    it('should handle multiple start calls gracefully', async () => {
      await systemModule.initialize();
      await systemModule.start();
      await systemModule.start(); // Second call should not throw
      
      expect(systemModule.status).toBe(ModuleStatusEnum.RUNNING);
      expect((systemModule as any).started).toBe(true);
    });
  });
  
  describe('stop', () => {
    it('should stop successfully when started', async () => {
      await systemModule.initialize();
      await systemModule.start();
      await systemModule.stop();
      
      expect(systemModule.status).toBe(ModuleStatusEnum.STOPPED);
      expect((systemModule as any).started).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'System module stopped');
    });
    
    it('should handle stop when not started', async () => {
      await systemModule.initialize();
      await systemModule.stop(); // Not started yet
      
      expect(systemModule.status).toBe(ModuleStatusEnum.STOPPED);
      expect((systemModule as any).started).toBe(false);
      // Should not log stop message since it wasn't started
      expect(mockLogger.info).not.toHaveBeenCalledWith(LogSource.SYSTEM, 'System module stopped');
    });
    
    it('should handle multiple stop calls gracefully', async () => {
      await systemModule.initialize();
      await systemModule.start();
      await systemModule.stop();
      await systemModule.stop(); // Second call should not throw
      
      expect(systemModule.status).toBe(ModuleStatusEnum.STOPPED);
    });
  });
  
  describe('healthCheck', () => {
    it('should return unhealthy when not initialized', async () => {
      const result = await systemModule.healthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('System module not initialized');
    });
    
    it('should return unhealthy when not started', async () => {
      await systemModule.initialize();
      
      const result = await systemModule.healthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('System module not started');
    });
    
    it('should return healthy when initialized and started', async () => {
      await systemModule.initialize();
      await systemModule.start();
      
      const result = await systemModule.healthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.message).toBe('System module is healthy');
    });
  });
  
  describe('getService', () => {
    it('should return system service when initialized', async () => {
      await systemModule.initialize();
      
      const service = systemModule.getService();
      
      expect(service).toBe(mockSystemService);
    });
    
    it('should throw error when not initialized', () => {
      expect(() => systemModule.getService()).toThrow('System module not initialized');
    });
  });
  
  describe('exports', () => {
    it('should return system service through exports when initialized', async () => {
      await systemModule.initialize();
      
      const service = systemModule.exports.service();
      
      expect(service).toBe(mockSystemService);
    });
    
    it('should throw error when accessing exports.service() before initialization', () => {
      expect(() => systemModule.exports.service()).toThrow('System module not initialized');
    });
  });
  
});

describe('Factory Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('createModule', () => {
    it('should create a new SystemModule instance', () => {
      const module = createModule();
      
      expect(module).toBeInstanceOf(SystemModule);
      expect(module.name).toBe('system');
      expect(module.version).toBe('1.0.0');
      expect(module.type).toBe('service');
    });
  });
  
  describe('initialize', () => {
    it('should create and initialize a SystemModule', async () => {
      const mockSystemService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        setLogger: vi.fn()
      };
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };
      
      vi.mocked(LoggerService.getInstance).mockReturnValue(mockLogger);
      vi.mocked(SystemService.getInstance).mockReturnValue(mockSystemService);
      
      const module = await initialize();
      
      expect(module).toBeInstanceOf(SystemModule);
      expect(mockSystemService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.SYSTEM, 'System module initialized');
    });
  });
  
  describe('getSystemModule', () => {
    it('should return system module with valid exports', () => {
      const mockModule = {
        exports: {
          service: vi.fn()
        }
      };
      const mockModuleLoader = {
        getModule: vi.fn().mockReturnValue(mockModule)
      };
      const mockGetModuleLoader = vi.fn().mockReturnValue(mockModuleLoader);
      
      vi.doMock('@/modules/loader', () => ({
        getModuleLoader: mockGetModuleLoader
      }));
      
      const result = getSystemModule();
      
      expect(result).toBe(mockModule);
      expect(mockModuleLoader.getModule).toHaveBeenCalledWith('system');
    });
    
    it('should throw error when service export is missing', () => {
      const mockModule = {
        exports: {}
      };
      const mockModuleLoader = {
        getModule: vi.fn().mockReturnValue(mockModule)
      };
      const mockGetModuleLoader = vi.fn().mockReturnValue(mockModuleLoader);
      
      vi.doMock('@/modules/loader', () => ({
        getModuleLoader: mockGetModuleLoader
      }));
      
      expect(() => getSystemModule()).toThrow('System module missing required service export');
    });
    
    it('should throw error when service export is not a function', () => {
      const mockModule = {
        exports: {
          service: 'not a function'
        }
      };
      const mockModuleLoader = {
        getModule: vi.fn().mockReturnValue(mockModule)
      };
      const mockGetModuleLoader = vi.fn().mockReturnValue(mockModuleLoader);
      
      vi.doMock('@/modules/loader', () => ({
        getModuleLoader: mockGetModuleLoader
      }));
      
      expect(() => getSystemModule()).toThrow('System module missing required service export');
    });
  });
});