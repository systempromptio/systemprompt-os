import { describe, it, expect } from 'vitest';
import { runCLICommand } from '../../../../../utils/cli-runner';
import { UsersRowSchema } from '../../../../../../src/modules/core/users/types/database.generated';

describe('users get CLI command', () => {
  describe('Execution', () => {
    it('should get user by ID with JSON format', async () => {
      // First create a user to get
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'gettest1',
          '--email', 'gettest1@example.com',
          '--format', 'json'
        ]
      );
      
      expect(createResult.exitCode).toBe(0);
      const createdUser = JSON.parse(createResult.stdout);
      
      // Then get the user by ID
      const { stdout, stderr, exitCode } = await runCLICommand(
        'users', 
        'get', 
        ['--id', createdUser.id, '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      const user = JSON.parse(stdout);
      expect(() => UsersRowSchema.parse(user)).not.toThrow();
      expect(user.id).toBe(createdUser.id);
      expect(user.username).toBe('gettest1');
    });

    it('should get user by username', async () => {
      // First create a user to get
      await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'gettest2',
          '--email', 'gettest2@example.com'
        ]
      );
      
      // Then get the user by username
      const { stdout, stderr, exitCode } = await runCLICommand(
        'users', 
        'get', 
        ['--username', 'gettest2', '--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      const user = JSON.parse(stdout);
      expect(user.username).toBe('gettest2');
    });

    it('should return text format by default', async () => {
      // First create a user to get
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'gettest3',
          '--email', 'gettest3@example.com',
          '--format', 'json'
        ]
      );
      
      const createdUser = JSON.parse(createResult.stdout);
      
      // Then get the user in text format
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'get', 
        ['--id', createdUser.id]
      );
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('User Information');
      expect(stdout).toContain('gettest3');
    });
  });

  describe('Validation', () => {
    it('should require either ID or username', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'get', 
        []
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should validate UUID format for ID', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'get', 
        ['--id', 'invalid-uuid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should handle non-existent user', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'get', 
        ['--id', '12345678-1234-1234-1234-123456789012']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('User not found');
    });
  });
});