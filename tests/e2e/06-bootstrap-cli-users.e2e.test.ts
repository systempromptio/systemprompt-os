import { describe, it, expect } from 'vitest';
import { execInContainer } from './bootstrap.js';

/**
 * Bootstrap and CLI Users E2E Tests
 * 
 * Tests the functionality of database bootstrapping and user CLI commands:
 * - Clear database
 * - Bootstrap with clean data
 * - List loaded modules
 * - Create user via CLI
 * - Display user information
 */
describe('[06] Bootstrap CLI and Users', () => {
  describe('Database and Bootstrap Operations', () => {
    it('should clear the database', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt database clear --force');
      
      expect(stderr).toBe('');
      expect(stdout).toContain('successfully');
    });

    it('should bootstrap the database with clean data', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt database rebuild --force');
      
      expect(stderr).toBe('');
      expect(stdout).toContain('Database rebuild completed');
    });

    it('should list loaded modules from fresh database', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt modules list --format=json');
      
      expect(stderr).toBe('');
      const modules = JSON.parse(stdout);
      
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      
      // Check for core modules
      const coreModules = modules.filter((m: any) => m.type === 'core');
      expect(coreModules.length).toBeGreaterThan(0);
      
      // Verify specific core modules are loaded
      const moduleNames = modules.map((m: any) => m.name);
      expect(moduleNames).toContain('users');
      expect(moduleNames).toContain('database');
      expect(moduleNames).toContain('cli');
      expect(moduleNames).toContain('logger');
    });
  });

  describe('User CLI Operations', () => {
    const testUser = {
      username: 'testuser123',
      email: 'testuser123@example.com',
      password: 'SecurePass123!'
    };

    it('should create a user via CLI', async () => {
      const { stdout, stderr } = await execInContainer(
        `/app/bin/systemprompt users create --username="${testUser.username}" --email="${testUser.email}" --password="${testUser.password}" --format=json`
      );
      
      expect(stderr).toBe('');
      const user = JSON.parse(stdout);
      
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe(testUser.username);
      expect(user.email).toBe(testUser.email);
      expect(user.status).toBe('active');
    });

    it('should list users including the created user', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt users list --format=json');
      
      expect(stderr).toBe('');
      const users = JSON.parse(stdout);
      
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      
      const createdUser = users.find((u: any) => u.username === testUser.username);
      expect(createdUser).toBeDefined();
      expect(createdUser.email).toBe(testUser.email);
    });

    it('should get user information by username', async () => {
      const { stdout, stderr } = await execInContainer(
        `/app/bin/systemprompt users get --username="${testUser.username}" --format=json`
      );
      
      expect(stderr).toBe('');
      const user = JSON.parse(stdout);
      
      expect(user).toBeDefined();
      expect(user.username).toBe(testUser.username);
      expect(user.email).toBe(testUser.email);
      expect(user.loginAttempts).toBe(0);
      expect(user.lastLoginAt).toBeNull();
    });

    it('should show users module status', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt users status');
      
      expect(stderr).toBe('');
      expect(stdout).toContain('Users Module Status');
      expect(stdout).toContain('Enabled: ✓');
      expect(stdout).toContain('Healthy: ✓');
      expect(stdout).toContain('Total users:');
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate username gracefully', async () => {
      try {
        await execInContainer(
          '/app/bin/systemprompt users create --username="testuser123" --email="another@example.com" --password="Pass123!"'
        );
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Username already exists');
      }
    });

    it('should handle missing required parameters', async () => {
      try {
        await execInContainer('/app/bin/systemprompt users create --username="onlyusername"');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('email are required');
      }
    });

    it('should handle non-existent user lookup', async () => {
      try {
        await execInContainer('/app/bin/systemprompt users get --username="nonexistentuser"');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('User not found');
      }
    });
  });
});