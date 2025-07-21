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
  
  describe('Extension management', () => {
    it('handles initialization and directory creation', async () => {
      // Test when directories don't exist
      vi.mocked(existsSync).mockReturnValue(false);
      await extensionModule.initialize({ config: {} });
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledTimes(4);
      
      // Test when directories exist
      vi.clearAllMocks();
      vi.mocked(existsSync).mockReturnValue(true);
      await extensionModule.initialize({ config: {} });
      expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled();
    });

    it('manages extension retrieval and filtering', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      await extensionModule.initialize({ config: {} });
      
      // No extensions
      expect(extensionModule.getExtensions()).toEqual([]);
      
      // Filter by type
      expect(Array.isArray(extensionModule.getExtensions('module'))).toBe(true);
      expect(Array.isArray(extensionModule.getExtensions('server'))).toBe(true);
    });
  });

  describe('Extension validation', () => {
    it.each([
      // Valid cases
      [
        { name: 'test', version: '1.0.0', type: 'service' },
        { valid: true, errors: [] },
        'valid module structure'
      ],
      // Missing fields
      [
        { name: 'test' },
        { valid: false, errors: ['Missing required field: version'] },
        'missing version'
      ],
      [
        { name: 'test', version: '1.0.0', type: 'service', cli: { commands: [{ name: 'test' }] } },
        { valid: false, errors: ['CLI command file missing: cli/test.ts'] },
        'missing CLI command file'
      ]
    ])('validates %s', (yamlContent, expected, scenario) => {
      // Setup mocks for valid path
      vi.mocked(existsSync)
        .mockReturnValueOnce(true)  // path exists
        .mockReturnValueOnce(true)  // module.yaml exists
        .mockReturnValueOnce(true)  // index.ts exists
        .mockReturnValueOnce(yamlContent.cli ? true : false)  // cli dir
        .mockReturnValueOnce(false); // command file
      
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(yamlContent));
      vi.mocked(yaml.parse).mockReturnValue(yamlContent);
      
      const result = extensionModule.validateExtension('/test/path');
      
      expect(result.valid).toBe(expected.valid);
      if (expected.errors.length > 0) {
        expect(result.errors).toContain(expected.errors[0]);
      } else {
        expect(result.errors).toHaveLength(0);
      }
    });
  });

  describe('Extension removal', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      await extensionModule.initialize({ config: {} });
    });

    it('prevents removal of core modules', async () => {
      extensionModule['extensions'].set('auth', {
        name: 'auth',
        type: 'module',
        version: '1.0.0',
        path: '/path/to/core/auth'
      });
      
      await expect(extensionModule.removeExtension('auth'))
        .rejects.toThrow('Cannot remove core modules');
    });

    it('removes custom extensions', async () => {
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

  describe('Health check', () => {
    it.each([
      [true, { healthy: true }, 'modules directory exists'],
      [false, { healthy: false, message: 'Modules directory not found' }, 'modules directory missing']
    ])('returns %s when %s', async (existsValue, expected, scenario) => {
      // Initialize first
      vi.mocked(existsSync).mockReturnValue(true);
      await extensionModule.initialize({ config: {} });
      
      // Then test health check
      vi.mocked(existsSync).mockReturnValue(existsValue);
      const result = await extensionModule.healthCheck();
      
      expect(result).toEqual(expected);
    });
  });
});