import { describe, it, expect } from 'vitest';
import { runCLICommand } from '../../../../../utils/cli-runner';
import { UsersRowSchema } from '../../../../../../src/modules/core/users/types/database.generated';

describe('users create CLI command', () => {
  describe('Execution', () => {
    it('should create user successfully with required arguments', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'testuser123',
          '--email', 'test123@example.com',
          '--format', 'json'
        ]
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      const user = JSON.parse(stdout);
      expect(() => UsersRowSchema.parse(user)).not.toThrow();
      expect(user.username).toBe('testuser123');
      expect(user.email).toBe('test123@example.com');
    });

    it('should create user with optional fields', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'testuser456',
          '--email', 'test456@example.com',
          '--display_name', 'Test User',
          '--bio', 'Test bio',
          '--timezone', 'America/New_York',
          '--language', 'en',
          '--status', 'active',
          '--emailVerified', 'true',
          '--format', 'json'
        ]
      );
      
      expect(exitCode).toBe(0);
      
      const user = JSON.parse(stdout);
      expect(user.display_name).toBe('Test User');
      expect(user.bio).toBe('Test bio');
      expect(user.timezone).toBe('America/New_York');
      expect(user.email_verified).toBe(true);
    });

    it('should return text format by default', async () => {
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'textuser',
          '--email', 'text@example.com'
        ]
      );
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('User created successfully');
      expect(stdout).toContain('Username');
      expect(stdout).toContain('textuser');
    });
  });

  describe('Validation', () => {
    it('should require username', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'create', 
        ['--email', 'test@example.com']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
      expect(stderr).toContain('username');
    });

    it('should require email', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'create', 
        ['--username', 'testuser']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
      expect(stderr).toContain('email');
    });

    it('should validate email format', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'testuser',
          '--email', 'invalid-email'
        ]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should validate status choices', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'testuser',
          '--email', 'test@example.com',
          '--status', 'invalid'
        ]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
});