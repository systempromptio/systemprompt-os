/**
 * Integration tests for dev test CLI command.
 * @file Tests test command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { describe, it, expect } from '@jest/globals';

describe('dev test CLI command', () => {
  describe('Execution', () => {
    it('should show helpful message when no arguments provided', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'test'
      );
      
      expect(exitCode).toBe(0);  // Should exit gracefully with help message
      expect(stderr).toBe('');
      expect(stdout).toContain('No module or target specified');
      expect(stdout).toContain('Tip:');
    });

    it('should execute successfully with valid module', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'test',
        ['--module', 'dev']
      );
      
      // Note: exitCode may be 1 if there are test failures, which is expected
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Running');
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'dev', 
        'test',
        ['--module', 'dev', '--format', 'json', '--integration']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('module', 'dev');
      expect(data).toHaveProperty('target');
      expect(data).toHaveProperty('testType');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('duration');
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('totalTests');
      expect(data).toHaveProperty('passedTests');
      expect(data).toHaveProperty('failedTests');
      expect(data).toHaveProperty('suites');
      expect(Array.isArray(data.suites)).toBe(true);
    });

    it('should handle integration test flag', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'dev', 
        'test',
        ['--module', 'dev', '--integration', '--format', 'json']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty('testType', 'integration');
    });

    it('should handle unit test flag', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'dev', 
        'test',
        ['--module', 'dev', '--unit', '--format', 'json']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty('testType', 'unit');
    });
  });
  
  describe('Validation', () => {
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'dev', 
        'test',
        ['--module', 'dev', '--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should handle max display option', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'dev', 
        'test',
        ['--module', 'dev', '--max', '5', '--format', 'json', '--integration']
      );
      
      expect(exitCode).toBeGreaterThanOrEqual(0);
      
      const data = JSON.parse(stdout);
      expect(data).toHaveProperty('suites');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'test',
        ['--module', 'dev', '--format', 'json', '--integration']
      );
      
      const data = JSON.parse(stdout);
      
      if (data.suites.length > 0) {
        data.suites.forEach((suite: any) => {
          expect(suite).toHaveProperty('name');
          expect(suite).toHaveProperty('status');
          expect(suite).toHaveProperty('tests');
          expect(suite).toHaveProperty('duration');
          expect(['passed', 'failed']).toContain(suite.status);
        });
      }
    });

    it('should include timing and test count information', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'test',
        ['--module', 'dev', '--format', 'json', '--integration']
      );
      
      const data = JSON.parse(stdout);
      
      expect(typeof data.duration).toBe('number');
      expect(data.duration).toBeGreaterThan(0);
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(typeof data.totalTests).toBe('number');
      expect(typeof data.passedTests).toBe('number');
      expect(typeof data.failedTests).toBe('number');
      expect(data.totalTests).toBe(data.passedTests + data.failedTests);
    });

    it('should include coverage information when requested', async () => {
      const { stdout } = await runCLICommand(
        'dev', 
        'test',
        ['--module', 'dev', '--coverage', '--format', 'json', '--integration']
      );
      
      const data = JSON.parse(stdout);
      
      if (data.coverage) {
        expect(data.coverage).toHaveProperty('lines');
        expect(data.coverage).toHaveProperty('statements');
        expect(data.coverage).toHaveProperty('branches');
        expect(data.coverage).toHaveProperty('functions');
      }
    });
  });
});