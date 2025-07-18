/**
 * @fileoverview Unit tests for Auth module
 * @module tests/unit/modules/core/auth
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthModule } from '../../../../../src/modules/core/auth/index.js';
import { existsSync, mkdirSync } from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}));

describe('AuthModule', () => {
  let authModule: AuthModule;
  
  beforeEach(() => {
    authModule = new AuthModule();
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize with default config', async () => {
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn()
      };
      
      vi.mocked(existsSync).mockReturnValue(false);
      
      await authModule.initialize({ logger: mockLogger });
      
      expect(vi.mocked(mkdirSync)).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Auth module initialized');
    });
    
    it('should not create directory if it exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      await authModule.initialize({});
      
      expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled();
    });
  });
  
  describe('lifecycle', () => {
    it('should start successfully', async () => {
      const mockLogger = { info: vi.fn() };
      await authModule.initialize({ logger: mockLogger });
      
      await authModule.start();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Auth module started');
    });
    
    it('should stop successfully', async () => {
      const mockLogger = { info: vi.fn() };
      await authModule.initialize({ logger: mockLogger });
      
      await authModule.stop();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Auth module stopped');
    });
  });
  
  describe('healthCheck', () => {
    it('should return healthy when key store exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      await authModule.initialize({});
      
      const result = await authModule.healthCheck();
      
      expect(result).toEqual({ healthy: true });
    });
    
    it('should return unhealthy when key store does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      await authModule.initialize({});
      
      const result = await authModule.healthCheck();
      
      expect(result).toEqual({ 
        healthy: false, 
        message: 'Key store directory not found' 
      });
    });
  });
  
  describe('module properties', () => {
    it('should have correct module metadata', () => {
      expect(authModule.name).toBe('auth');
      expect(authModule.version).toBe('1.0.0');
      expect(authModule.type).toBe('service');
    });
  });
});