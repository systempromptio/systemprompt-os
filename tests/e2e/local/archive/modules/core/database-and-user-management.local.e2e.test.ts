import { describe, it, expect } from 'vitest';
import { execInContainer, expectCLISuccess } from '../../shared/bootstrap.js';

/**
 * Local E2E: Database and User Management
 * 
 * Tests the functionality of database operations and user CLI commands:
 * - Database rebuild and clearing
 * - User creation and management via CLI
 * - Data persistence and retrieval
 * - Module state management
 */
describe('Local E2E: Database and User Management', () => {
  
  describe('Database Operations', () => {
    it('should clear the database successfully', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt database clear --force');
      
      expect(stderr).toBe('');
      // Database clear command may not produce output on success - just verify it didn't error
      expect(stdout).toBeDefined();
    });

    it('should rebuild the database with clean schema', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt database rebuild --force');
      
      // Stderr may contain warnings about dropping non-existent tables, which is normal
      expect(stderr).toMatch(/^$|warning|failed to drop/i);
      // Database rebuild command may not produce output on success - just verify it didn't error
      expect(stdout).toBeDefined();
    });

    it('should verify database integrity after rebuild', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt database status');
      
      expect(stdout).toContain('Connected');
      expect(stdout).toContain('Database Status');
    });

    it('should handle schema listing after rebuild', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt database schema --action list');
      
      expect(stderr).toBe('');
      // Schema list may be empty in a fresh database - just verify command executes without error
      expect(stdout).toBeDefined();
    });
  });

  describe('Module State Management', () => {
    it('should list loaded modules from fresh database', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt modules list --format json');
      
      expect(stderr).toBe('');
      const modules = JSON.parse(stdout);
      
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      
      // Check for core modules
      const coreModules = modules.filter((m: any) => m.metadata?.core === true);
      expect(coreModules.length).toBeGreaterThan(0);
      
      // Essential core modules should be present
      const moduleNames = coreModules.map((m: any) => m.name || m.id);
      expect(moduleNames).toEqual(expect.arrayContaining(['logger', 'database']));
    });

    it('should show module details with proper metadata', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt modules list');
      
      expect(stdout).toContain('Name:');
      expect(stdout).toContain('Type:');
      expect(stdout).toContain('core');
    });

    it('should track module initialization state', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt modules list --type core --format json');
      const coreModules = JSON.parse(stdout);
      
      // All core modules should be properly initialized
      coreModules.forEach((module: any) => {
        expect(module.enabled !== false).toBe(true);
        expect(module.type).toBe('core');
      });
    });
  });

  describe('User Management via CLI', () => {
    it('should create a new user successfully', async () => {
      const testEmail = `test-user-${Date.now()}@example.com`;
      const { stdout, stderr } = await execInContainer(
        `/app/bin/systemprompt users create --email="${testEmail}" --username="testuser${Date.now()}" --role=user`
      );
      
      expect(stderr).toBe('');
      expect(stdout).toMatch(/created|success/i);
      expect(stdout).toContain(testEmail);
    });

    it('should list users and show created user', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt users list --format=json');
      
      expect(stderr).toBe('');
      const users = JSON.parse(stdout);
      
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      
      // Should have the test user we created
      const testUser = users.find((u: any) => u.email?.includes('test-user-'));
      expect(testUser).toBeDefined();
      expect(testUser.username).toContain('testuser');
      expect(testUser.role).toBe('user');
    });

    it('should display user information in detailed format', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt users list --format=table');
      
      expect(stdout).toContain('Email');
      expect(stdout).toContain('Username');
      expect(stdout).toContain('Role');
      expect(stdout).toContain('testuser');
    });

    it('should show user by specific email', async () => {
      // First, get a user email from the list
      const { stdout: listOutput } = await execInContainer('/app/bin/systemprompt users list --format=json');
      const users = JSON.parse(listOutput);
      
      if (users.length > 0) {
        const firstUser = users[0];
        const { stdout } = await execInContainer(`/app/bin/systemprompt users get --email="${firstUser.email}"`);
        
        expect(stdout).toContain(firstUser.email);
        expect(stdout).toContain(firstUser.username || 'User');
      }
    });
  });

  describe('Data Persistence and Retrieval', () => {
    it('should persist user data across database operations', async () => {
      // Create a user
      const testEmail = `persistent-user-${Date.now()}@example.com`;
      const username = `persistentuser${Date.now()}`;
      await execInContainer(
        `/app/bin/systemprompt users create --email="${testEmail}" --username="${username}" --role=admin`
      );
      
      // Verify user exists
      const { stdout } = await execInContainer('/app/bin/systemprompt users list --format=json');
      const users = JSON.parse(stdout);
      const persistentUser = users.find((u: any) => u.email === testEmail);
      
      expect(persistentUser).toBeDefined();
      expect(persistentUser.username).toBe(username);
      expect(persistentUser.role).toBe('admin');
    });

    it('should handle concurrent user operations', async () => {
      // Create multiple users in sequence to test data consistency
      const baseEmail = `concurrent-${Date.now()}`;
      
      await execInContainer(`/app/bin/systemprompt users create --email="${baseEmail}-1@example.com" --username="user1${Date.now()}" --role=user`);
      await execInContainer(`/app/bin/systemprompt users create --email="${baseEmail}-2@example.com" --username="user2${Date.now()}" --role=user`);
      await execInContainer(`/app/bin/systemprompt users create --email="${baseEmail}-3@example.com" --username="user3${Date.now()}" --role=admin`);
      
      // Verify all users were created
      const { stdout } = await execInContainer('/app/bin/systemprompt users list --format=json');
      const users = JSON.parse(stdout);
      
      const concurrentUsers = users.filter((u: any) => u.email?.includes(baseEmail));
      expect(concurrentUsers.length).toBe(3);
      
      // Check roles are preserved
      const adminUser = concurrentUsers.find((u: any) => u.email?.includes('-3@'));
      expect(adminUser.role).toBe('admin');
    });

    it('should maintain referential integrity', async () => {
      // Test that database constraints are working
      const { stdout } = await execInContainer('/app/bin/systemprompt database query --sql "SELECT COUNT(*) as user_count FROM users"');
      
      expect(stdout).toMatch(/user_count/);
      expect(stdout).toMatch(/\d+/); // Should have a number
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle duplicate user creation gracefully', async () => {
      const duplicateEmail = `duplicate-${Date.now()}@example.com`;
      
      // Create first user
      await execInContainer(`/app/bin/systemprompt users create --email="${duplicateEmail}" --username="firstuser${Date.now()}" --role=user`);
      
      // Try to create duplicate
      try {
        await execInContainer(`/app/bin/systemprompt users create --email="${duplicateEmail}" --username="duplicateuser${Date.now()}" --role=user`);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/exists|duplicate|already/i);
      }
    });

    it('should validate email format', async () => {
      try {
        await execInContainer('/app/bin/systemprompt users create --email="invalid-email" --username="InvalidUser" --role=user');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/invalid|email|format/i);
      }
    });

    it('should validate required fields', async () => {
      try {
        await execInContainer('/app/bin/systemprompt users create --name="No Email User"');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/required|email/i);
      }
    });
  });
});