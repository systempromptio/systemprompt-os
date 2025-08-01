import { describe, it, expect } from 'vitest';
import { runCLICommand } from '../../../../../utils/cli-runner';
import { UsersRowSchema } from '../../../../../../src/modules/core/users/types/database.generated';

describe('users update CLI command', () => {
  describe('Execution', () => {
    it('should update user successfully', async () => {
      // First create a user to update
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'updatetest1',
          '--email', 'updatetest1@example.com',
          '--format', 'json'
        ]
      );
      
      expect(createResult.exitCode).toBe(0);
      const createdUser = JSON.parse(createResult.stdout);
      
      // Then update the user
      const { stdout, stderr, exitCode } = await runCLICommand(
        'users', 
        'update', 
        [
          '--id', createdUser.id,
          '--email', 'updated@example.com',
          '--display_name', 'Updated Name',
          '--status', 'inactive',
          '--format', 'json'
        ]
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      const updatedUser = JSON.parse(stdout);
      expect(() => UsersRowSchema.parse(updatedUser)).not.toThrow();
      expect(updatedUser.id).toBe(createdUser.id);
      expect(updatedUser.email).toBe('updated@example.com');
      expect(updatedUser.display_name).toBe('Updated Name');
      expect(updatedUser.status).toBe('inactive');
    });

    it('should update single field', async () => {
      // First create a user to update
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'updatetest2',
          '--email', 'updatetest2@example.com',
          '--format', 'json'
        ]
      );
      
      const createdUser = JSON.parse(createResult.stdout);
      
      // Update only email
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'update', 
        [
          '--id', createdUser.id,
          '--email', 'newemailonly@example.com',
          '--format', 'json'
        ]
      );
      
      expect(exitCode).toBe(0);
      
      const updatedUser = JSON.parse(stdout);
      expect(updatedUser.email).toBe('newemailonly@example.com');
      expect(updatedUser.username).toBe('updatetest2'); // Should remain unchanged
    });

    it('should return text format by default', async () => {
      // First create a user to update
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'updatetest3',
          '--email', 'updatetest3@example.com',
          '--format', 'json'
        ]
      );
      
      const createdUser = JSON.parse(createResult.stdout);
      
      // Update in text format
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'update', 
        [
          '--id', createdUser.id,
          '--email', 'textupdate@example.com'
        ]
      );
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('User updated successfully');
      expect(stdout).toContain('textupdate@example.com');
    });
  });

  describe('Validation', () => {
    it('should require user ID', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'update', 
        ['--email', 'test@example.com']
      );
        
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
      expect(stderr).toContain('id');
    });

    it('should validate UUID format for ID', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'update', 
        [
          '--id', 'invalid-uuid',
          '--email', 'test@example.com'
        ]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should require at least one update field', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'update', 
        ['--id', '12345678-1234-1234-1234-123456789012']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should validate email format', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'update', 
        [
          '--id', '12345678-1234-1234-1234-123456789012',
          '--email', 'invalid-email'
        ]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should validate status choices', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'update', 
        [
          '--id', '12345678-1234-1234-1234-123456789012',
          '--status', 'invalid'
        ]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
});