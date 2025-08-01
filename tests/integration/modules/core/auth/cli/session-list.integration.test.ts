/**
 * Integration tests for auth session list CLI command.
 * @file Tests auth session list command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { randomUUID } from 'crypto';
import { describe, it, expect } from '@jest/globals';

describe('auth session:list CLI command', () => {
  const validUserId = randomUUID();
  
  describe('Execution', () => {
    it('should execute successfully with valid user ID', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:list',
        ['--user-id', validUserId]
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain(`Sessions for User: ${validUserId}`);
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:list',
        ['--user-id', validUserId, '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('userId', validUserId);
      expect(data).toHaveProperty('sessions');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');
      expect(Array.isArray(data.sessions)).toBe(true);
    });
    
    it('should handle pagination options', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:list',
        ['--user-id', validUserId, '--limit', '10', '--page', '2', '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      const data = JSON.parse(stdout);
      expect(data.limit).toBe(10);
      expect(data.page).toBe(2);
    });
  });
  
  describe('Validation', () => {
    it('should require user-id argument', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:list'
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
    
    it('should validate UUID format for user-id', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:list',
        ['--user-id', 'invalid-uuid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid UUID format');
    });
    
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:list',
        ['--user-id', validUserId, '--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
    
    it('should validate pagination parameters', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'session:list',
        ['--user-id', validUserId, '--limit', '-1']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure', async () => {
      const { stdout } = await runCLICommand(
        'auth', 
        'session:list',
        ['--user-id', validUserId, '--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(typeof data.userId).toBe('string');
      expect(data.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(typeof data.total).toBe('number');
      expect(typeof data.page).toBe('number');
      expect(typeof data.limit).toBe('number');
      
      if (data.sessions.length > 0) {
        expect(data.sessions[0]).toHaveProperty('sessionId');
        expect(data.sessions[0]).toHaveProperty('status');
      }
    });
  });
});