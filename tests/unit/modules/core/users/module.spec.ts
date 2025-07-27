/**
 * Users module tests - Complete test coverage for UsersModule implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UsersModule, createModule, initialize, getUsersModule } from '../../../../../src/modules/core/users/index.js';
import type { IUsersModuleExports } from '../../../../../src/modules/core/users/index.js';
import { ModuleStatusEnum } from '../../../../../src/modules/core/modules/types/index.js';
import { LogSource } from '../../../../../src/modules/core/logger/types/index.js';

// Mock dependencies
vi.mock('../../../../../src/modules/core/logger/services/logger.service.js', () => ({
  LoggerService: {
    getInstance: vi.fn()
  }
}));

vi.mock('../../../../../src/modules/core/users/services/users.service.js', () => ({
  UsersService: {
    getInstance: vi.fn()
  }
}));

// Mock module loader for getUsersModule tests
vi.mock('../../../../../src/modules/loader', () => ({
  getModuleLoader: vi.fn()
}));

vi.mock('../../../../../src/modules/types/module-names.types', () => ({
  ModuleName: {
    USERS: 'users'
  }
}));

describe('UsersModule', () => {
  let module: UsersModule;
  let mockLogger: any;
  let mockUsersService: any;
  let mockLoggerService: any;
  let mockUsersServiceClass: any;
  
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    // Create mock users service
    mockUsersService = {
      initialize: vi.fn().mockResolvedValue(undefined)
    };
    
    // Mock LoggerService.getInstance
    mockLoggerService = await import('../../../../../src/modules/core/logger/services/logger.service.js');
    mockLoggerService.LoggerService.getInstance.mockReturnValue(mockLogger);
    
    // Mock UsersService.getInstance
    mockUsersServiceClass = await import('../../../../../src/modules/core/users/services/users.service.js');
    mockUsersServiceClass.UsersService.getInstance.mockReturnValue(mockUsersService);
    
    // Create fresh module instance
    module = new UsersModule();
  });
  
  afterEach(async () => {
    // Clean up
    await module.stop();
  });

  describe('Constructor and Properties', () => {
    it('should have correct module properties', () => {
      expect(module.name).toBe('users');
      expect(module.type).toBe('service');
      expect(module.version).toBe('1.0.0');
      expect(module.description).toBe('User management system');
      expect(module.dependencies).toEqual(['logger', 'database', 'auth']);
      expect(module.status).toBe(ModuleStatusEnum.STOPPED);
    });
    
    it('should start with correct initial state', () => {
      expect(module.status).toBe(ModuleStatusEnum.STOPPED);
      // Private properties are tested through behavior
    });
  });
  
  describe('exports getter', () => {
    it('should return exports object with service function', () => {
      const exports = module.exports;
      expect(exports).toBeDefined();
      expect(typeof exports.service).toBe('function');
    });
    
    it('should call getService when exports.service is called', async () => {
      // Initialize first so getService doesn't throw
      await module.initialize();
      
      const exports = module.exports;
      const service = exports.service();
      expect(service).toBe(mockUsersService);
    });
  });
  
  describe('Module Lifecycle - initialize()', () => {
    it('should initialize successfully', async () => {
      await module.initialize();
      
      expect(mockLoggerService.LoggerService.getInstance).toHaveBeenCalled();
      expect(mockUsersServiceClass.UsersService.getInstance).toHaveBeenCalled();
      expect(mockUsersService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Users module initialized');
    });
    
    it('should throw error if already initialized', async () => {
      await module.initialize();
      
      await expect(module.initialize()).rejects.toThrow('Users module already initialized');
    });
    
    it('should handle service initialization failure with Error object', async () => {
      const error = new Error('Service init failed');
      mockUsersService.initialize.mockRejectedValue(error);
      
      await expect(module.initialize()).rejects.toThrow('Failed to initialize users module: Service init failed');
    });
    
    it('should handle service initialization failure with non-Error object', async () => {
      mockUsersService.initialize.mockRejectedValue('String error');
      
      await expect(module.initialize()).rejects.toThrow('Failed to initialize users module: String error');
    });
  });
  
  describe('Module Lifecycle - start()', () => {
    it('should throw error if not initialized', async () => {
      await expect(module.start()).rejects.toThrow('Users module not initialized');
    });
    
    it('should start successfully when initialized', async () => {
      await module.initialize();
      await module.start();
      
      expect(module.status).toBe(ModuleStatusEnum.RUNNING);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Users module started');
    });
    
    it('should not start again if already started', async () => {
      await module.initialize();
      await module.start();
      
      // Clear previous calls
      mockLogger.info.mockClear();
      
      await module.start();
      
      // Should not log start message again
      expect(mockLogger.info).not.toHaveBeenCalledWith(LogSource.AUTH, 'Users module started');
    });
  });
  
  describe('Module Lifecycle - stop()', () => {
    it('should stop when started', async () => {
      await module.initialize();
      await module.start();
      await module.stop();
      
      expect(module.status).toBe(ModuleStatusEnum.STOPPED);
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Users module stopped');
    });
    
    it('should not log stop message if not started', async () => {
      await module.stop();
      
      expect(mockLogger.info).not.toHaveBeenCalledWith(LogSource.AUTH, 'Users module stopped');
    });
  });
  
  describe('healthCheck()', () => {
    it('should return unhealthy when not initialized', async () => {
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Users module not initialized');
    });
    
    it('should return unhealthy when initialized but not started', async () => {
      await module.initialize();
      
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Users module not started');
    });
    
    it('should return healthy when initialized and started', async () => {
      await module.initialize();
      await module.start();
      
      const health = await module.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.message).toBe('Users module is healthy');
    });
  });
  
  describe('getService()', () => {
    it('should throw error if not initialized', () => {
      expect(() => module.getService()).toThrow('Users module not initialized');
    });
    
    it('should return users service when initialized', async () => {
      await module.initialize();
      
      const service = module.getService();
      expect(service).toBe(mockUsersService);
    });
  });
});

describe('Factory Functions', () => {
  let mockLoggerService: any;
  let mockUsersServiceClass: any;
  let mockLogger: any;
  let mockUsersService: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    mockUsersService = {
      initialize: vi.fn().mockResolvedValue(undefined)
    };
    
    mockLoggerService = await import('../../../../../src/modules/core/logger/services/logger.service.js');
    mockLoggerService.LoggerService.getInstance.mockReturnValue(mockLogger);
    
    mockUsersServiceClass = await import('../../../../../src/modules/core/users/services/users.service.js');
    mockUsersServiceClass.UsersService.getInstance.mockReturnValue(mockUsersService);
  });
  
  describe('createModule()', () => {
    it('should create a new UsersModule instance', () => {
      const moduleInstance = createModule();
      
      expect(moduleInstance).toBeInstanceOf(UsersModule);
      expect(moduleInstance.name).toBe('users');
      expect(moduleInstance.status).toBe(ModuleStatusEnum.STOPPED);
    });
  });
  
  describe('initialize()', () => {
    it('should create and initialize a UsersModule instance', async () => {
      const moduleInstance = await initialize();
      
      expect(moduleInstance).toBeInstanceOf(UsersModule);
      expect(mockUsersService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(LogSource.AUTH, 'Users module initialized');
    });
  });
});

describe('getUsersModule()', () => {
  let mockModuleLoader: any;
  let mockGetModuleLoader: any;
  let mockModuleName: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    mockModuleLoader = {
      getModule: vi.fn()
    };
    
    mockGetModuleLoader = await import('../../../../../src/modules/loader');
    mockGetModuleLoader.getModuleLoader.mockReturnValue(mockModuleLoader);
    
    mockModuleName = await import('../../../../../src/modules/types/module-names.types');
  });
  
  it('should return users module with valid exports', () => {
    const mockModule = {
      exports: {
        service: vi.fn()
      }
    };
    
    mockModuleLoader.getModule.mockReturnValue(mockModule);
    
    const result = getUsersModule();
    
    expect(mockGetModuleLoader.getModuleLoader).toHaveBeenCalled();
    expect(mockModuleLoader.getModule).toHaveBeenCalledWith(mockModuleName.ModuleName.USERS);
    expect(result).toBe(mockModule);
  });
  
  it('should throw error if service export is missing', () => {
    const mockModule = {
      exports: {}
    };
    
    mockModuleLoader.getModule.mockReturnValue(mockModule);
    
    expect(() => getUsersModule()).toThrow('Users module missing required service export');
  });
  
  it('should throw error if service export is not a function', () => {
    const mockModule = {
      exports: {
        service: 'not-a-function'
      }
    };
    
    mockModuleLoader.getModule.mockReturnValue(mockModule);
    
    expect(() => getUsersModule()).toThrow('Users module missing required service export');
  });
  
  it('should throw error if exports is null', () => {
    const mockModule = {
      exports: null
    };
    
    mockModuleLoader.getModule.mockReturnValue(mockModule);
    
    expect(() => getUsersModule()).toThrow('Users module missing required service export');
  });
  
  it('should throw error if exports is undefined', () => {
    const mockModule = {};
    
    mockModuleLoader.getModule.mockReturnValue(mockModule);
    
    expect(() => getUsersModule()).toThrow('Users module missing required service export');
  });
});