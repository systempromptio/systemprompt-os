/**
 * Integration tests for auth session create CLI command.
 * @file Tests auth session create command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { randomUUID } from 'crypto';
import { describe, it, expect } from '@jest/globals';

describe('auth session:create CLI command', () => {
  const validUserId = randomUUID();
  
  describe('Execution', () => {
    it('should execute successfully with valid user ID', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:create',
        ['--user-id', validUserId]
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Session created successfully');
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:create',
        ['--user-id', validUserId, '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('sessionId');
      expect(data).toHaveProperty('userId', validUserId);
      expect(data).toHaveProperty('created');
      expect(data).toHaveProperty('type', 'web');
      expect(data).toHaveProperty('status', 'active');
    });
  });
  
  describe('Validation', () => {
    it('should require user-id argument', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:create'
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
    
    it('should validate UUID format for user-id', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:create',
        ['--user-id', 'invalid-uuid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid UUID format');
    });
    
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:create',
        ['--user-id', validUserId, '--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure', async () => {
      const { stdout } = await runCLICommand(
        'auth', 
        'session:create',
        ['--user-id', validUserId, '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(typeof data.sessionId).toBe('string');
      expect(data.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(data.userId).toBe(validUserId);
      expect(new Date(data.created)).toBeInstanceOf(Date);
    });
  });
});