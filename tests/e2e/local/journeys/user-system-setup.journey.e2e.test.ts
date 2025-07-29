/**
 * User Journey: System Setup and Configuration
 * 
 * Tests the complete user journey for setting up and configuring the system:
 * - Initial database setup and verification
 * - System configuration management
 * - Module discovery and initialization
 * - Basic system health checks
 * - CLI tool familiarization
 * 
 * This test simulates a new user's first experience with the system,
 * from initial setup to having a working environment.
 */

import { describe, it, expect } from 'vitest';
import { execInContainer, expectCLISuccess } from '../shared/bootstrap.js';

describe('User Journey: System Setup and Configuration', () => {
  
  describe('Initial System Discovery', () => {
    it('should help new user discover available commands', async () => {
      // Step 1: New user runs help to see what's available
      const { stdout } = await execInContainer('/app/bin/systemprompt --help');
      
      expect(stdout).toContain('systemprompt');
      expect(stdout).toContain('Commands');
      expect(stdout).toContain('auth');
      expect(stdout).toContain('cli');
      expect(stdout).toContain('config');
      expect(stdout).toContain('database');
      expect(stdout).toContain('help');
      expect(stdout).toContain('agents');
      expect(stdout).toContain('tasks');
    });

    it('should show system version information', async () => {
      // User checks what version they're running
      const { stdout } = await execInContainer('/app/bin/systemprompt --version');
      expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Semantic version pattern
    });
  });

  describe('Database Setup Journey', () => {
    it('should walk through database initialization process', async () => {
      // Step 1: User checks current database status
      const { stdout: statusBefore } = await execInContainer('/app/bin/systemprompt database status');
      expect(statusBefore).toContain('Database Status');
      expect(statusBefore).toContain('Connected');

      // Step 2: User rebuilds database with fresh schema
      const { stdout: rebuildResult } = await execInContainer('/app/bin/systemprompt database rebuild --force');
      // Database rebuild might not produce output but should not error
      expect(rebuildResult).toBeDefined();

      // Step 3: User verifies database is working after rebuild
      const { stdout: statusAfter } = await execInContainer('/app/bin/systemprompt database status');
      expect(statusAfter).toContain('Connected');
      expect(statusAfter).toContain('Database Status');
    });

    it('should handle database maintenance operations', async () => {
      // User performs database cleanup
      const { stdout } = await execInContainer('/app/bin/systemprompt database clear --force');
      expect(stdout).toBeDefined(); // Command should execute without error

      // User checks database integrity after cleanup
      const { stdout: statusCheck } = await execInContainer('/app/bin/systemprompt database status');
      expect(statusCheck).toContain('Connected');
    });
  });

  describe('System Configuration Journey', () => {
    it('should guide user through configuration discovery', async () => {
      // Step 1: User explores available configuration
      const { stdout: configList } = await execInContainer('/app/bin/systemprompt config list');
      expect(configList).toBeDefined();

      // Step 2: User checks specific configuration values
      const { stdout: portConfig } = await execInContainer('/app/bin/systemprompt config get --key PORT');
      expect(portConfig).toBeDefined();

      // Step 3: User understands configuration structure
      // Config might return null or actual values depending on setup
      expect(typeof portConfig).toBe('string');
    });
  });

  describe('Module Discovery Journey', () => {
    it('should help user understand system modules', async () => {
      // Step 1: User discovers available modules
      const { stdout } = await execInContainer('/app/bin/systemprompt modules list --format json');
      const modules = JSON.parse(stdout);
      
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      
      // Step 2: User identifies core system modules
      const coreModules = modules.filter((m: any) => m.metadata?.core === true);
      expect(coreModules.length).toBeGreaterThan(0);
      
      // Step 3: User verifies essential modules are present
      const moduleNames = coreModules.map((m: any) => m.name || m.id);
      expect(moduleNames).toEqual(expect.arrayContaining(['logger', 'database']));
    });

    it('should show detailed module information', async () => {
      // User wants to understand module structure
      const { stdout } = await execInContainer('/app/bin/systemprompt modules list');
      
      expect(stdout).toContain('Name:');
      expect(stdout).toContain('Type:');
      expect(stdout).toContain('core');
    });
  });

  describe('System Health Verification Journey', () => {
    it('should verify all system components are healthy', async () => {
      // Step 1: User checks database connectivity
      const { stdout: dbStatus } = await execInContainer('/app/bin/systemprompt database status');
      expect(dbStatus).toContain('Connected');

      // Step 2: User verifies modules are loaded
      const { stdout: moduleStatus } = await execInContainer('/app/bin/systemprompt modules list --format json');
      const modules = JSON.parse(moduleStatus);
      
      const coreModules = modules.filter((m: any) => m.metadata?.core === true);
      expect(coreModules.length).toBeGreaterThan(0);

      // Step 3: User confirms system is ready for use
      expect(modules.length).toBeGreaterThan(0);
    });
  });

  describe('Getting Started Journey', () => {
    it('should guide user through first-time setup verification', async () => {
      // Step 1: User verifies they can create their first agent
      const testAgentName = `first-agent-${Date.now()}`;
      const { stdout: agentResult } = await execInContainer(
        `/app/bin/systemprompt agents create --name "${testAgentName}" --description "My first agent" --instructions "Learn how to use the system" --type "worker"`
      );
      
      expect(agentResult).toMatch(/created successfully|success/i);

      // Step 2: User verifies they can see their agent
      const { stdout: listResult } = await execInContainer('/app/bin/systemprompt agents list');
      expect(listResult).toContain(testAgentName);

      // Step 3: User creates their first task
      const { stdout: taskResult } = await execInContainer([
        '/app/bin/systemprompt', 'tasks', 'add',
        '--type=learning',
        '--module-id=tutorial',
        '--instructions={"goal": "understand system basics"}',
        '--priority=5',
        '--format=json'
      ].join(' '));

      const task = JSON.parse(taskResult);
      expect(task.type).toBe('learning');
      expect(task.instructions.goal).toBe('understand system basics');
    });

    it('should help user understand error messages and troubleshooting', async () => {
      // User encounters an error and learns how to interpret it
      try {
        await execInContainer('/app/bin/systemprompt agents create --name "invalid-agent"');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        const errorOutput = (error.stdout || '') + (error.stderr || '');
        expect(errorOutput).toMatch(/required|missing|description|instructions|type/i);
        
        // User learns that the error message guides them to what's missing
        expect(errorOutput.length).toBeGreaterThan(0);
      }
    });
  });

  describe('System Exploration Journey', () => {
    it('should encourage user exploration of advanced features', async () => {
      // Step 1: User explores JSON output for programmatic use
      const { stdout: jsonAgents } = await execInContainer('/app/bin/systemprompt agents list --format json');
      const agents = JSON.parse(jsonAgents);
      expect(Array.isArray(agents)).toBe(true);

      // Step 2: User explores filtering capabilities
      const { stdout: filteredAgents } = await execInContainer('/app/bin/systemprompt agents list --status stopped');
      expect(filteredAgents).toContain('Listing Agents');

      // Step 3: User learns about task management
      const { stdout: taskList } = await execInContainer('/app/bin/systemprompt tasks list --format json');
      const tasks = JSON.parse(taskList);
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Configuration Mastery Journey', () => {
    it('should help user become proficient with configuration', async () => {
      // Step 1: User learns to inspect current configuration
      const { stdout: allConfig } = await execInContainer('/app/bin/systemprompt config list');
      expect(allConfig).toBeDefined();

      // Step 2: User understands how to check specific values
      const { stdout: specificConfig } = await execInContainer('/app/bin/systemprompt config get --key NODE_ENV');
      expect(specificConfig).toBeDefined();

      // Step 3: User becomes comfortable with config commands
      // All config commands should execute without errors even if returning null
      expect(typeof specificConfig).toBe('string');
    });
  });
});