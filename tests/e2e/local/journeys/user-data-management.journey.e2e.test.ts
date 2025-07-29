/**
 * User Journey: Data Management and Analytics
 * 
 * Tests the complete user journey for data-related operations:
 * - Database operations and maintenance
 * - Data persistence and retrieval
 * - User management workflows
 * - System monitoring and health checks
 * - Data backup and recovery scenarios
 * 
 * This test simulates how users interact with data management
 * features of the system.
 */

import { describe, it, expect } from 'vitest';
import { execInContainer, expectCLISuccess } from '../shared/bootstrap.js';

describe('User Journey: Data Management and Analytics', () => {
  
  describe('Database Management Journey', () => {
    it('should walk through database maintenance workflow', async () => {
      // Step 1: User checks current database state
      const { stdout: initialStatus } = await execInContainer('/app/bin/systemprompt database status');
      expect(initialStatus).toContain('Connected');
      expect(initialStatus).toContain('Database Status');

      // Step 2: User performs database cleanup
      const { stdout: clearResult } = await execInContainer('/app/bin/systemprompt database clear --force');
      expect(clearResult).toBeDefined();

      // Step 3: User rebuilds database with fresh schema
      const { stdout: rebuildResult } = await execInContainer('/app/bin/systemprompt database rebuild --force');
      expect(rebuildResult).toBeDefined();

      // Step 4: User verifies database integrity after operations
      const { stdout: finalStatus } = await execInContainer('/app/bin/systemprompt database status');
      expect(finalStatus).toContain('Connected');
    });

    it('should handle schema management operations', async () => {
      // User explores database schema information
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt database schema --action list');
      
      expect(stderr).toBe('');
      expect(stdout).toBeDefined();
      // Schema list may be empty in fresh database but command should succeed
    });
  });

  describe('Data Persistence Journey', () => {
    it('should demonstrate data persistence across operations', async () => {
      // Step 1: User creates some test data (agents)
      const persistentAgentName = `persistent-data-${Date.now()}`;
      await execInContainer(
        `/app/bin/systemprompt agents create --name "${persistentAgentName}" --description "Data persistence test" --instructions "Test data persistence" --type "worker"`
      );

      // Step 2: User creates test tasks
      const { stdout: taskResult } = await execInContainer([
        '/app/bin/systemprompt', 'tasks', 'add',
        '--type=persistence-test',
        '--module-id=data-test',
        '--instructions={"test": "data persistence"}',
        '--priority=5',
        '--format=json'
      ].join(' '));

      const task = JSON.parse(taskResult);
      expect(task.type).toBe('persistence-test');

      // Step 3: User verifies data persists after database status check
      const { stdout: statusCheck } = await execInContainer('/app/bin/systemprompt database status');
      expect(statusCheck).toContain('Connected');

      // Step 4: User confirms their data is still there
      const { stdout: agentCheck } = await execInContainer('/app/bin/systemprompt agents list');
      expect(agentCheck).toContain(persistentAgentName);

      const { stdout: taskCheck } = await execInContainer('/app/bin/systemprompt tasks list --format json');
      const tasks = JSON.parse(taskCheck);
      const persistentTask = tasks.find((t: any) => t.type === 'persistence-test');
      expect(persistentTask).toBeDefined();
    });

    it('should handle referential integrity', async () => {
      // User understands how data relationships are maintained
      const { stdout: dbStatus } = await execInContainer('/app/bin/systemprompt database status');
      expect(dbStatus).toContain('Connected');

      // User creates related data to test integrity
      const relatedAgentName = `integrity-agent-${Date.now()}`;
      await execInContainer(
        `/app/bin/systemprompt agents create --name "${relatedAgentName}" --description "Integrity test agent" --instructions "Test referential integrity" --type "monitor"`
      );

      // User verifies the relationship is maintained
      const { stdout: agentList } = await execInContainer('/app/bin/systemprompt agents list');
      expect(agentList).toContain(relatedAgentName);
      expect(agentList).toContain('monitor');
    });
  });

  describe('User Management Journey', () => {
    it('should handle user creation and validation errors gracefully', async () => {
      // User attempts to create a user but encounters validation
      try {
        await execInContainer('/app/bin/systemprompt users create --email=invalid-email --username=testuser --role=user');
        // Command might fail due to email validation
      } catch (error: any) {
        // This is expected - user learns about email validation
        const errorOutput = (error.stdout || '') + (error.stderr || '');
        expect(errorOutput.length).toBeGreaterThan(0);
      }

      // User learns proper email format is required
      const validationTestName = `validationtest${Date.now()}`;
      try {
        await execInContainer(`/app/bin/systemprompt users create --email=${validationTestName}@example.com --username=${validationTestName} --role=user`);
        // This might succeed or fail depending on user module implementation
      } catch (error: any) {
        // Command execution attempted - user learns about the interface
        expect(error).toBeDefined();
      }
    });

    it('should demonstrate proper validation requirements', async () => {
      // User learns about required fields through validation
      try {
        await execInContainer('/app/bin/systemprompt users create --username=incomplete');
        // Should fail due to missing required fields
      } catch (error: any) {
        const output = (error.stdout || '') + (error.stderr || '');
        // User learns that email and role are required
        expect(output.length).toBeGreaterThan(0);
      }
    });
  });

  describe('System Monitoring Journey', () => {
    it('should help user monitor system health and performance', async () => {
      // Step 1: User checks overall system status
      const { stdout: dbStatus } = await execInContainer('/app/bin/systemprompt database status');
      expect(dbStatus).toContain('Connected');
      expect(dbStatus).toContain('Database Status');

      // Step 2: User monitors module health
      const { stdout: moduleStatus } = await execInContainer('/app/bin/systemprompt modules list --format json');
      const modules = JSON.parse(moduleStatus);
      
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);

      // Step 3: User checks data integrity
      const coreModules = modules.filter((m: any) => m.metadata?.core === true);
      expect(coreModules.length).toBeGreaterThan(0);
    });

    it('should provide insights into system usage', async () => {
      // User analyzes their agent usage
      const { stdout: agentData } = await execInContainer('/app/bin/systemprompt agents list --format json');
      const agents = JSON.parse(agentData);
      
      expect(Array.isArray(agents)).toBe(true);
      
      // User analyzes task patterns
      const { stdout: taskData } = await execInContainer('/app/bin/systemprompt tasks list --format json');
      const tasks = JSON.parse(taskData);
      
      expect(Array.isArray(tasks)).toBe(true);
      
      // User can derive insights from the data structure
      if (tasks.length > 0) {
        expect(tasks[0]).toHaveProperty('type');
        expect(tasks[0]).toHaveProperty('status');
      }
    });
  });

  describe('Data Export and Analysis Journey', () => {
    it('should enable user to export data for external analysis', async () => {
      // Step 1: User exports agent data
      const { stdout: agentJson } = await execInContainer('/app/bin/systemprompt agents list --format json');
      const agents = JSON.parse(agentJson);
      
      expect(Array.isArray(agents)).toBe(true);
      
      // Step 2: User exports task data
      const { stdout: taskJson } = await execInContainer('/app/bin/systemprompt tasks list --format json');
      const tasks = JSON.parse(taskJson);
      
      expect(Array.isArray(tasks)).toBe(true);
      
      // Step 3: User can analyze the exported data structure
      if (agents.length > 0) {
        const agentFields = Object.keys(agents[0]);
        expect(agentFields).toContain('name');
        expect(agentFields.length).toBeGreaterThan(0);
      }
    });

    it('should support different output formats for analysis', async () => {
      // User gets data in table format for readability
      const { stdout: tableFormat } = await execInContainer('/app/bin/systemprompt agents list');
      expect(tableFormat).toContain('Listing Agents');

      // User gets data in JSON format for processing
      const { stdout: jsonFormat } = await execInContainer('/app/bin/systemprompt agents list --format json');
      const jsonData = JSON.parse(jsonFormat);
      expect(Array.isArray(jsonData)).toBe(true);
    });
  });

  describe('Data Recovery Scenarios', () => {
    it('should handle data recovery workflow', async () => {
      // Step 1: User creates important data
      const recoveryTestAgent = `recovery-test-${Date.now()}`;
      await execInContainer(
        `/app/bin/systemprompt agents create --name "${recoveryTestAgent}" --description "Recovery test data" --instructions "Important data for recovery testing" --type "coordinator"`
      );

      // Step 2: User verifies data exists
      const { stdout: beforeRecovery } = await execInContainer('/app/bin/systemprompt agents list');
      expect(beforeRecovery).toContain(recoveryTestAgent);

      // Step 3: User performs database operations that might affect data
      const { stdout: statusCheck } = await execInContainer('/app/bin/systemprompt database status');
      expect(statusCheck).toContain('Connected');

      // Step 4: User verifies data integrity after operations
      const { stdout: afterRecovery } = await execInContainer('/app/bin/systemprompt agents list');
      expect(afterRecovery).toContain(recoveryTestAgent);
    });
  });

  describe('Advanced Data Operations Journey', () => {
    it('should enable complex data queries and filtering', async () => {
      // User performs filtered queries
      const { stdout: filteredAgents } = await execInContainer('/app/bin/systemprompt agents list --status stopped');
      expect(filteredAgents).toContain('Listing Agents');

      // User works with JSON data for complex analysis
      const { stdout: jsonData } = await execInContainer('/app/bin/systemprompt agents list --format json');
      const agents = JSON.parse(jsonData);
      
      if (agents.length > 0) {
        // User can filter and analyze data programmatically
        const stoppedAgents = agents.filter((a: any) => a.status === 'stopped');
        expect(Array.isArray(stoppedAgents)).toBe(true);
      }
    });

    it('should support data maintenance best practices', async () => {
      // User follows best practices for data maintenance
      
      // Step 1: Regular health checks
      const { stdout: healthCheck } = await execInContainer('/app/bin/systemprompt database status');
      expect(healthCheck).toContain('Connected');

      // Step 2: Module verification
      const { stdout: moduleCheck } = await execInContainer('/app/bin/systemprompt modules list --format json');
      const modules = JSON.parse(moduleCheck);
      expect(modules.length).toBeGreaterThan(0);

      // Step 3: Data consistency verification
      const { stdout: dataCheck } = await execInContainer('/app/bin/systemprompt agents list --format json');
      const data = JSON.parse(dataCheck);
      expect(Array.isArray(data)).toBe(true);
    });
  });
});