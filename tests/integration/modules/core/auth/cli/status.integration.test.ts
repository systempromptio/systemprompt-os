/**
 * Integration tests for auth status CLI command.
 * @file Tests auth status command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { describe, it, expect } from '@jest/globals';

describe('auth status CLI command', () => {
  describe('Execution', () => {
    it('should execute successfully with default format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'status'
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Auth Module Status');
    });

    it('should execute successfully with text format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'status',
        ['--format', 'text']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Auth Module Status');
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'status',
        ['--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('module', 'auth');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('enabled');
      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('components');
      expect(data).toHaveProperty('timestamp');
    });
  });
  
  describe('Validation', () => {
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'status',
        ['--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure', async () => {
      const { stdout } = await runCLICommand(
        'auth', 
        'status',
        ['--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(data.components).toHaveProperty('authService');
      expect(data.components).toHaveProperty('sessionService');
      expect(data.components).toHaveProperty('oauthService');
      expect(data.components).toHaveProperty('eventBus');
    });
  });
});