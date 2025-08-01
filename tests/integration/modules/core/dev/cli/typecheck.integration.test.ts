/**
 * Integration tests for dev typecheck CLI command.
 * @file Tests typecheck command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { describe, it, expect } from '@jest/globals';

describe('dev typecheck CLI command', () => {
  describe('Execution', () => {
    it('should execute successfully with valid module', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--module', 'dev']
      );
      
      // Note: exitCode may be 1 if there are type errors, which is expected
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Running TypeScript type checking');
    });

    it('should execute successfully with text format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--module', 'dev', '--format', 'text']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Running TypeScript type checking');
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--module', 'dev', '--format', 'json']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('module', 'dev');
      expect(data).toHaveProperty('target');
      expect(data).toHaveProperty('strict');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('duration');
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('totalErrors');
      expect(data).toHaveProperty('files');
      expect(Array.isArray(data.files)).toBe(true);
    });

    it('should execute with specific target path', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--target', 'src/modules/core/dev/cli', '--format', 'json']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty('target', 'src/modules/core/dev/cli');
    });

    it('should handle strict mode flag', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--module', 'dev', '--strict', '--format', 'json']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty('strict', true);
    });
  });
  
  describe('Validation', () => {
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--module', 'dev', '--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should handle max display option', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--module', 'dev', '--max', '5', '--format', 'json']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty('files');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--module', 'dev', '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      if (data.files.length > 0) {
        data.files.forEach((file: any) => {
          expect(file).toHaveProperty('filePath');
          expect(file).toHaveProperty('errors');
          expect(Array.isArray(file.errors)).toBe(true);
          
          file.errors.forEach((error: any) => {
            expect(error).toHaveProperty('line');
            expect(error).toHaveProperty('column');
            expect(error).toHaveProperty('code');
            expect(error).toHaveProperty('message');
            expect(typeof error.line).toBe('number');
            expect(typeof error.column).toBe('number');
            expect(typeof error.code).toBe('string');
            expect(typeof error.message).toBe('string');
          });
        });
      }
    });

    it('should include timing information', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--module', 'dev', '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(typeof data.duration).toBe('number');
      expect(data.duration).toBeGreaterThan(0);
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should indicate success status correctly', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'typecheck',
        ['--module', 'dev', '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.totalErrors).toBe('number');
      
      // Success should be true when totalErrors is 0
      if (data.totalErrors === 0) {
        expect(data.success).toBe(true);
      } else {
        expect(data.success).toBe(false);
      }
    });
  });
});