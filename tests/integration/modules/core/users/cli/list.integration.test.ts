import { describe, it, expect } from 'vitest';
import { runCLICommand } from '../../../../../utils/cli-runner';

describe('users list CLI command', () => {
  describe('Execution', () => {
    it('should list users successfully with text format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'users', 
        'list'
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Users');
    });

    it('should return valid JSON array with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'users', 
        'list', 
        ['--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const users = JSON.parse(stdout);
      expect(Array.isArray(users)).toBe(true);
    });

    it('should support filtering by status', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'list', 
        ['--status', 'active', '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      
      const users = JSON.parse(stdout);
      users.forEach(user => {
        expect(user.status).toBe('active');
      });
    });

    it('should support pagination', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'list', 
        ['--limit', '5', '--page', '1', '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      
      const users = JSON.parse(stdout);
      expect(users.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Validation', () => {
    it('should validate status choices', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'list', 
        ['--status', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should validate limit range', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'list', 
        ['--limit', '200']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should validate page number', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'list', 
        ['--page', '0']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
});