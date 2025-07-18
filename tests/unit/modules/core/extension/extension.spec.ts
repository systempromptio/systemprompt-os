/**
 * @fileoverview Unit tests for Extension module
 * @module tests/unit/modules/core/extension
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionModule } from '../../../../../src/modules/core/extension/index.js';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'fs';
import * as yaml from 'yaml';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn()
}));

vi.mock('yaml', () => ({
  parse: vi.fn()
}));

describe('ExtensionModule', () => {
  let extensionModule: ExtensionModule;
  
  beforeEach(() => {
    extensionModule = new ExtensionModule();
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('should create required directories', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      await extensionModule.initialize({ config: {} });
      
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledTimes(4);
    });
    
    it('should not create directories if they exist', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      await extensionModule.initialize({ config: {} });
      
      expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled();
    });
  });
  
  describe('getExtensions', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      await extensionModule.initialize({ config: {} });
    });
    
    it('should return empty array when no extensions exist', () => {
      const extensions = extensionModule.getExtensions();
      expect(extensions).toEqual([]);
    });
    
    it('should filter extensions by type', () => {
      const modules = extensionModule.getExtensions('module');
      const servers = extensionModule.getExtensions('server');
      
      expect(Array.isArray(modules)).toBe(true);
      expect(Array.isArray(servers)).toBe(true);
    });
  });
  
  describe('validateExtension', () => {
    it('should validate valid module structure', () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(true)  // path exists
        .mockReturnValueOnce(true)  // module.yaml exists
        .mockReturnValueOnce(true); // index.ts exists
      
      vi.mocked(readFileSync).mockReturnValue('name: test\nversion: 1.0.0\ntype: service');
      vi.mocked(yaml.parse).mockReturnValue({
        name: 'test',
        version: '1.0.0',
        type: 'service'
      });
      
      const result = extensionModule.validateExtension('/test/path');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect missing required fields', () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);
      
      vi.mocked(readFileSync).mockReturnValue('name: test');
      vi.mocked(yaml.parse).mockReturnValue({ name: 'test' });
      
      const result = extensionModule.validateExtension('/test/path');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: version');
    });
    
    it('should check CLI commands if defined', () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)  // index.ts
        .mockReturnValueOnce(true)  // cli dir
        .mockReturnValueOnce(false); // command file
      
      vi.mocked(yaml.parse).mockReturnValue({
        name: 'test',
        version: '1.0.0',
        type: 'service',
        cli: {
          commands: [{ name: 'test' }]
        }
      });
      
      const result = extensionModule.validateExtension('/test/path');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CLI command file missing: cli/test.ts');
    });
  });
  
  describe('removeExtension', () => {
    it('should prevent removal of core modules', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      await extensionModule.initialize({ config: {} });
      
      // Manually set up a core module
      extensionModule['extensions'].set('auth', {
        name: 'auth',
        type: 'module',
        version: '1.0.0',
        path: '/path/to/core/auth'
      });
      
      await expect(extensionModule.removeExtension('auth'))
        .rejects.toThrow('Cannot remove core modules');
    });
    
    it('should remove custom extension', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      await extensionModule.initialize({ config: {} });
      
      // Add a custom extension
      extensionModule['extensions'].set('custom', {
        name: 'custom',
        type: 'module',
        version: '1.0.0',
        path: '/path/to/custom/module'
      });
      
      await extensionModule.removeExtension('custom');
      
      expect(vi.mocked(rmSync)).toHaveBeenCalledWith(
        '/path/to/custom/module',
        { recursive: true, force: true }
      );
    });
  });
  
  describe('module properties', () => {
    it('should have correct module metadata', () => {
      expect(extensionModule.name).toBe('extension');
      expect(extensionModule.version).toBe('1.0.0');
      expect(extensionModule.type).toBe('service');
    });
  });
  
  describe('healthCheck', () => {
    it('should return healthy when modules directory exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      await extensionModule.initialize({ config: {} });
      
      const result = await extensionModule.healthCheck();
      
      expect(result).toEqual({ healthy: true });
    });
    
    it('should return unhealthy when modules directory is missing', async () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(true)  // for initialization
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false); // for health check
        
      await extensionModule.initialize({ config: {} });
      
      const result = await extensionModule.healthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Modules directory not found');
    });
  });
});