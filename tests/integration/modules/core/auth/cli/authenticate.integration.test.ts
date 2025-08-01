/**
 * Integration tests for auth authenticate CLI command.
 * @file Tests auth authenticate command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { describe, it, expect } from '@jest/globals';

describe('auth authenticate CLI command', () => {
  const testEmail = 'test@example.com';
  const testPassword = 'testpassword123';
  
  describe('Execution', () => {
    it('should execute with valid credentials', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'authenticate',
        ['--email', testEmail, '--password', testPassword]
      );
      
      // Note: This might exit with 1 if authentication fails, which is expected
      expect(stderr).toBe('');
      expect(stdout).toContain('Authentication');
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'authenticate',
        ['--email', testEmail, '--password', testPassword, '--format', 'json']
      );
      
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('authenticatedAt');
      expect(typeof data.success).toBe('boolean');
      
      if (data.success) {
        expect(data).toHaveProperty('userId');
        expect(data).toHaveProperty('sessionId');
      } else {
        expect(data).toHaveProperty('error');
      }
    });
  });
  
  describe('Validation', () => {
    it('should require email argument', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'authenticate',
        ['--password', testPassword]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
    
    it('should require password argument', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'authenticate',
        ['--email', testEmail]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
    
    it('should validate email format', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'authenticate',
        ['--email', 'invalid-email', '--password', testPassword]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid email format');
    });
    
    it('should require non-empty password', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'authenticate',
        ['--email', testEmail, '--password', '']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Password is required');
    });
    
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'authenticate',
        ['--email', testEmail, '--password', testPassword, '--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure for both success and failure', async () => {
      const { stdout } = await runCLICommand(
        'auth', 
        'authenticate',
        ['--email', testEmail, '--password', testPassword, '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(typeof data.success).toBe('boolean');
      expect(new Date(data.authenticatedAt)).toBeInstanceOf(Date);
      
      if (data.success) {
        expect(typeof data.userId).toBe('string');
        expect(typeof data.sessionId).toBe('string');
      } else {
        expect(typeof data.error).toBe('string');
      }
    });
  });
});