/**
 * Integration tests for dev generate-types CLI command.
 * @file Tests generate-types command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { describe, it, expect } from '@jest/globals';

describe('dev generate-types CLI command', () => {
  describe('Execution', () => {
    it('should execute successfully with valid module', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'generate-types',
        ['--module', 'dev']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Successfully generated types');
    });

    it('should execute successfully with text format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'generate-types',
        ['--module', 'dev', '--format', 'text']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Successfully generated types');
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'generate-types',
        ['--module', 'dev', '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('module', 'dev');
      expect(data).toHaveProperty('types');
      expect(data).toHaveProperty('files');
      expect(data).toHaveProperty('timestamp');
      expect(Array.isArray(data.types)).toBe(true);
      expect(Array.isArray(data.files)).toBe(true);
    });

    it('should generate types for all modules with --all flag', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'generate-types',
        ['--all', '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('modules');
      expect(data).toHaveProperty('timestamp');
      expect(Array.isArray(data.modules)).toBe(true);
      expect(data.modules.length).toBeGreaterThan(1);
    });
  });
  
  describe('Validation', () => {
    it('should handle missing arguments gracefully', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'generate-types'
      );
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Either --module, --pattern, or --all is required');
    });

    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'dev', 
        'generate-types',
        ['--module', 'dev', '--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure for single module', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'generate-types',
        ['--module', 'dev', '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(data.files).toContain('src/modules/core/dev/types/database.generated.ts');
      expect(data.files).toContain('src/modules/core/dev/types/dev.module.generated.ts');
      expect(data.files).toContain('src/modules/core/dev/types/dev.service.generated.ts');
    });

    it('should have consistent JSON structure for all modules', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'generate-types',
        ['--all', '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      data.modules.forEach((moduleResult: any) => {
        expect(moduleResult).toHaveProperty('module');
        expect(moduleResult).toHaveProperty('status');
        if (moduleResult.status === 'success') {
          expect(moduleResult).toHaveProperty('files');
          expect(Array.isArray(moduleResult.files)).toBe(true);
        } else {
          expect(moduleResult).toHaveProperty('error');
        }
      });
    });
  });
});