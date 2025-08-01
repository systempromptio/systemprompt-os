import { describe, it, expect } from 'vitest';
import { runCLICommand } from '../../../../../utils/cli-runner';

describe('users delete CLI command', () => {
  describe('Execution', () => {
    it('should delete user successfully with force flag', async () => {
      // First create a user to delete
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'deletetest1',
          '--email', 'deletetest1@example.com',
          '--format', 'json'
        ]
      );
      
      expect(createResult.exitCode).toBe(0);
      const createdUser = JSON.parse(createResult.stdout);
      
      // Then delete the user
      const { stdout, stderr, exitCode } = await runCLICommand(
        'users', 
        'delete', 
        [
          '--id', createdUser.id,
          '--force', 'true',
          '--format', 'json'
        ]
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      const result = JSON.parse(stdout);
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
      expect(result.deletedUser.id).toBe(createdUser.id);
    });

    it('should require confirmation without force flag', async () => {
      // First create a user to delete
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'deletetest2',
          '--email', 'deletetest2@example.com',
          '--format', 'json'
        ]
      );
      
      const createdUser = JSON.parse(createResult.stdout);
      
      // Try to delete without force flag
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'delete', 
        [
          '--id', createdUser.id,
          '--format', 'json'
        ]
      );
      
      expect(exitCode).toBe(1);
      
      const result = JSON.parse(stdout);
      expect(result.error).toContain('confirmation');
      expect(result.message).toContain('--force');
    });

    it('should return text format by default', async () => {
      // First create a user to delete
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'deletetest3',
          '--email', 'deletetest3@example.com',
          '--format', 'json'
        ]
      );
      
      const createdUser = JSON.parse(createResult.stdout);
      
      // Delete in text format
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'delete', 
        [
          '--id', createdUser.id,
          '--force', 'true'
        ]
      );
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('User deleted successfully');
      expect(stdout).toContain('deletetest3');
    });

    it('should show confirmation warning in text format', async () => {
      // First create a user to delete
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'deletetest4',
          '--email', 'deletetest4@example.com',
          '--format', 'json'
        ]
      );
      
      const createdUser = JSON.parse(createResult.stdout);
      
      // Try to delete without force in text format
      const { stdout, exitCode } = await runCLICommand(
        'users', 
        'delete', 
        ['--id', createdUser.id]
      );
      
      expect(exitCode).toBe(1);
      expect(stdout).toContain('Warning');
      expect(stdout).toContain('permanently delete');
      expect(stdout).toContain('deletetest4');
      expect(stdout).toContain('--force true');
    });
  });

  describe('Validation', () => {
    it('should require user ID', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'delete', 
        ['--force', 'true']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
      expect(stderr).toContain('id');
    });

    it('should validate UUID format for ID', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'delete', 
        [
          '--id', 'invalid-uuid',
          '--force', 'true'
        ]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });

    it('should handle non-existent user', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'delete', 
        [
          '--id', '12345678-1234-1234-1234-123456789012',
          '--force', 'true'
        ]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('User not found');
    });

    it('should validate force flag values', async () => {
      const createResult = await runCLICommand(
        'users', 
        'create', 
        [
          '--username', 'deletetest5',
          '--email', 'deletetest5@example.com',
          '--format', 'json'
        ]
      );
      
      const createdUser = JSON.parse(createResult.stdout);
      
      const { stderr, exitCode } = await runCLICommand(
        'users', 
        'delete', 
        [
          '--id', createdUser.id,
          '--force', 'invalid'
        ]
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
});