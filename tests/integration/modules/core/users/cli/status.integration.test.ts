import { describe, it, expect } from 'vitest';
import { runCLICommand } from '../../../../../utils/cli-runner';

describe('users status CLI command', () => {
  describe('Execution', () => {
    it('should execute successfully with text format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'users', 
        'status'
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Users Module Status');
    });

    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'users', 
        'status', 
        ['--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const statusData = JSON.parse(stdout);
      
      expect(statusData).toHaveProperty('module', 'users');
      expect(statusData).toHaveProperty('status');
      expect(statusData).toHaveProperty('statistics');
      expect(statusData).toHaveProperty('timestamp');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'status', 
        ['--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
});