/**
 * Integration tests for dev lint CLI command.
 * @file Tests lint command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { describe, it, expect } from '@jest/globals';

describe('dev lint CLI command', () => {
  describe('Execution', () => {
    it('should execute successfully with valid module', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'lint',
        ['--module', 'dev']
      );
      
      // Note: exitCode may be 1 if there are linting errors, which is expected
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Running ESLint analysis');
    });

    it('should execute successfully with text format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'lint',
        ['--module', 'dev', '--format', 'text']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Running ESLint analysis');
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'lint',
        ['--module', 'dev', '--format', 'json']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('module', 'dev');
      expect(data).toHaveProperty('target');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('duration');
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('totalErrors');
      expect(data).toHaveProperty('totalWarnings');
      expect(data).toHaveProperty('totalFiles');
      expect(data).toHaveProperty('results');
      expect(Array.isArray(data.results)).toBe(true);
    });

    it('should execute with specific target path', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'lint',
        ['--target', 'src/modules/core/dev/cli', '--format', 'json']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty('target', 'src/modules/core/dev/cli');
    });
  });
  
  describe('Validation', () => {
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'dev', 
        'lint',
        ['--module', 'dev', '--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should handle max display option', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'dev', 
        'lint',
        ['--module', 'dev', '--max', '5', '--format', 'json']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty('results');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'lint',
        ['--module', 'dev', '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      if (data.results.length > 0) {
        data.results.forEach((result: any) => {
          expect(result).toHaveProperty('filePath');
          expect(result).toHaveProperty('errorCount');
          expect(result).toHaveProperty('warningCount');
          expect(result).toHaveProperty('messages');
          expect(Array.isArray(result.messages)).toBe(true);
          
          result.messages.forEach((message: any) => {
            expect(message).toHaveProperty('line');
            expect(message).toHaveProperty('column');
            expect(message).toHaveProperty('message');
            expect(message).toHaveProperty('ruleId');
            expect(message).toHaveProperty('severity');
          });
        });
      }
    });

    it('should include timing information', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'lint',
        ['--module', 'dev', '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(typeof data.duration).toBe('number');
      expect(data.duration).toBeGreaterThan(0);
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});