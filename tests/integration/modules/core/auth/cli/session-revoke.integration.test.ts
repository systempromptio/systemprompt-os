/**
 * Integration tests for auth session revoke CLI command.
 * @file Tests auth session revoke command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { randomUUID } from 'crypto';
import { describe, it, expect } from '@jest/globals';

describe('auth session:revoke CLI command', () => {
  const validSessionId = randomUUID();
  
  describe('Execution', () => {
    it('should execute with valid session ID', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:revoke',
        ['--session-id', validSessionId]
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Session revoked successfully');
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:revoke',
        ['--session-id', validSessionId, '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('sessionId', validSessionId);
      expect(data).toHaveProperty('status', 'revoked');
      expect(data).toHaveProperty('revokedAt');
    });
  });
  
  describe('Validation', () => {
    it('should require session-id argument', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:revoke'
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
    
    it('should validate UUID format for session-id', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:revoke',
        ['--session-id', 'invalid-uuid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid UUID format');
    });
    
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:revoke',
        ['--session-id', validSessionId, '--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure', async () => {
      const { stdout } = await runCLICommand(
        'auth', 
        'session:revoke',
        ['--session-id', validSessionId, '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(typeof data.sessionId).toBe('string');
      expect(data.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(data.status).toBe('revoked');
      expect(new Date(data.revokedAt)).toBeInstanceOf(Date);
    });
  });
});