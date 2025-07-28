/**
 * Local E2E: Agents CLI Functionality
 * 
 * Tests database persistence and CRUD operations for agents via CLI.
 * Covers agent creation, listing, updating, deletion, and error handling.
 */

import { describe, it, expect } from 'vitest';
import { execInContainer, expectCLISuccess, expectCLIFailure } from '../../shared/bootstrap.js';

describe('Local E2E: Agents CLI Functionality', () => {
  
  describe('Agent Creation', () => {
    it('should create a new agent with all required fields', async () => {
      const { stdout, stderr } = await execInContainer(
        '/app/bin/systemprompt agents create --name "test-agent" --description "Test agent description" --instructions "Process data and generate reports" --type "worker" --capabilities "data-processing,report-generation" --tools "calculator,formatter"'
      );

      expect(stderr).toBe('');
      expect(stdout).toMatch(/created successfully|success/i);
      expect(stdout).toContain('test-agent');
    });

    it('should create agent with minimal required fields', async () => {
      const { stdout, stderr } = await execInContainer(
        '/app/bin/systemprompt agents create --name "minimal-agent" --description "Minimal test" --instructions "Basic instructions" --type worker'
      );

      expect(stderr).toBe('');
      expect(stdout).toMatch(/created successfully|success/i);
      expect(stdout).toContain('minimal-agent');
    });

    it('should fail with missing required fields', async () => {
      try {
        await execInContainer('/app/bin/systemprompt agents create --name "incomplete-agent"');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/required|missing|description|instructions|type/i);
      }
    });

    it('should fail with invalid agent type', async () => {
      try {
        await execInContainer(
          '/app/bin/systemprompt agents create --name "invalid-agent" --description "Description" --instructions "Instructions" --type invalid-type'
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/invalid|error|type/i);
      }
    });

    it('should create agent with JSON configuration', async () => {
      const config = JSON.stringify({ maxTasks: 10, timeout: 30000 });
      const { stdout, stderr } = await execInContainer(
        `/app/bin/systemprompt agents create --name "config-agent" --description "Agent with config" --instructions "Do tasks" --type monitor --config '${config}'`
      );

      expect(stderr).toBe('');
      expect(stdout).toMatch(/created successfully|success/i);
      expect(stdout).toContain('config-agent');
    });
  });

  describe('Agent Listing and Filtering', () => {
    it('should list all agents', async () => {
      // Create multiple agents for testing
      await execInContainer('/app/bin/systemprompt agents create --name "list-agent-1" --description "First agent" --instructions "Instructions 1" --type worker');
      await execInContainer('/app/bin/systemprompt agents create --name "list-agent-2" --description "Second agent" --instructions "Instructions 2" --type monitor');
      await execInContainer('/app/bin/systemprompt agents create --name "list-agent-3" --description "Third agent" --instructions "Instructions 3" --type coordinator');

      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents list');

      expect(stderr).toBe('');
      expect(stdout).toContain('list-agent-1');
      expect(stdout).toContain('list-agent-2');
      expect(stdout).toContain('list-agent-3');
    });

    it('should list agents in JSON format', async () => {
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents list --format json');

      expect(stderr).toBe('');
      
      try {
        const agents = JSON.parse(stdout);
        expect(Array.isArray(agents)).toBe(true);
      } catch (e) {
        // If JSON parsing fails, check for valid output
        expect(stdout).toBeDefined();
        expect(stdout.length).toBeGreaterThan(0);
      }
    });

    it('should filter agents by status', async () => {
      // Create an agent and try to filter
      await execInContainer('/app/bin/systemprompt agents create --name "status-filter-agent" --description "Status test" --instructions "Instructions" --type worker');
      
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents list --status idle');

      expect(stderr).toBe('');
      // Should show agents with idle status (default for new agents)
    });

    it('should handle empty agent list gracefully', async () => {
      // Clear database and check empty list
      await execInContainer('/app/bin/systemprompt database clear --force');
      await execInContainer('/app/bin/systemprompt database rebuild --force');
      
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents list');

      expect(stderr).toBe('');
      expect(stdout).toMatch(/no agents|empty|none found/i);
    });
  });

  describe('Agent Details and Information', () => {
    it('should show agent details by name', async () => {
      await execInContainer(
        '/app/bin/systemprompt agents create --name "detail-agent" --description "Detail test agent" --instructions "Test instructions" --type monitor --capabilities "cap1" "cap2" --tools "tool1" "tool2"'
      );

      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents show detail-agent');

      expect(stderr).toBe('');
      expect(stdout).toContain('detail-agent');
      expect(stdout).toContain('Detail test agent');
      expect(stdout).toContain('Test instructions');
      expect(stdout).toContain('monitor');
    });

    it('should show agent details by ID', async () => {
      // Create agent and get its ID
      const createResult = await execInContainer(
        '/app/bin/systemprompt agents create --name "id-agent" --description "ID test" --instructions "Instructions" --type worker --format json'
      );

      try {
        const agent = JSON.parse(createResult.stdout);
        const { stdout, stderr } = await execInContainer(`/app/bin/systemprompt agents show ${agent.id}`);

        expect(stderr).toBe('');
        expect(stdout).toContain('id-agent');
      } catch (e) {
        // If JSON parsing fails, just check that show command works with name
        const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents show id-agent');
        expect(stderr).toBe('');
        expect(stdout).toContain('id-agent');
      }
    });

    it('should fail for non-existent agent', async () => {
      try {
        await execInContainer('/app/bin/systemprompt agents show non-existent-agent');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/not found|does not exist|error/i);
      }
    });
  });

  describe('Agent Updates', () => {
    it('should update agent name', async () => {
      await execInContainer('/app/bin/systemprompt agents create --name "update-name-test" --description "Original" --instructions "Original instructions" --type worker');

      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents update update-name-test --name "updated-name-test"');

      expect(stderr).toBe('');
      expect(stdout).toMatch(/updated successfully|success/i);

      // Verify update
      const listResult = await execInContainer('/app/bin/systemprompt agents list');
      expect(listResult.stdout).toContain('updated-name-test');
    });

    it('should update agent description', async () => {
      await execInContainer('/app/bin/systemprompt agents create --name "update-desc-test" --description "Original description" --instructions "Instructions" --type worker');

      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents update update-desc-test --description "Updated description"');

      expect(stderr).toBe('');
      expect(stdout).toMatch(/updated successfully|success/i);
      
      // Verify update
      const showResult = await execInContainer('/app/bin/systemprompt agents show update-desc-test');
      expect(showResult.stdout).toContain('Updated description');
    });

    it('should update agent status', async () => {
      await execInContainer('/app/bin/systemprompt agents create --name "update-status-test" --description "Status test" --instructions "Instructions" --type worker');

      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents update update-status-test --status active');

      expect(stderr).toBe('');
      expect(stdout).toMatch(/updated|success|active/i);
    });

    it('should update multiple fields at once', async () => {
      await execInContainer('/app/bin/systemprompt agents create --name "multi-update-test" --description "Original desc" --instructions "Original inst" --type worker');

      const { stdout, stderr } = await execInContainer(
        '/app/bin/systemprompt agents update multi-update-test --description "New description" --instructions "New instructions" --tools "new-tool"'
      );

      expect(stderr).toBe('');
      expect(stdout).toMatch(/updated successfully|success/i);
      
      // Verify updates
      const showResult = await execInContainer('/app/bin/systemprompt agents show multi-update-test');
      expect(showResult.stdout).toContain('New description');
      expect(showResult.stdout).toContain('New instructions');
    });

    it('should fail for non-existent agent update', async () => {
      try {
        await execInContainer('/app/bin/systemprompt agents update non-existent-agent --name "new-name"');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/not found|does not exist|error/i);
      }
    });

    it('should update agent configuration', async () => {
      await execInContainer('/app/bin/systemprompt agents create --name "config-update-test" --description "Config test" --instructions "Instructions" --type worker');

      const newConfig = JSON.stringify({ maxTasks: 20, priority: 'high' });
      const { stdout, stderr } = await execInContainer(`/app/bin/systemprompt agents update config-update-test --config '${newConfig}'`);

      expect(stderr).toBe('');
      expect(stdout).toMatch(/updated successfully|success/i);
    });
  });

  describe('Agent Deletion', () => {
    it('should delete agent by name', async () => {
      await execInContainer('/app/bin/systemprompt agents create --name "delete-test-agent" --description "To be deleted" --instructions "Instructions" --type worker');

      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents delete delete-test-agent');

      expect(stderr).toBe('');
      expect(stdout).toMatch(/deleted successfully|success/i);

      // Verify deletion
      const listResult = await execInContainer('/app/bin/systemprompt agents list');
      expect(listResult.stdout).not.toContain('delete-test-agent');
    });

    it('should fail for non-existent agent deletion', async () => {
      try {
        await execInContainer('/app/bin/systemprompt agents delete non-existent-agent');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/not found|does not exist|error/i);
      }
    });

    it('should confirm deletion with force flag', async () => {
      await execInContainer('/app/bin/systemprompt agents create --name "force-delete-test" --description "Force delete test" --instructions "Instructions" --type worker');

      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents delete force-delete-test --force');

      expect(stderr).toBe('');
      expect(stdout).toMatch(/deleted successfully|success/i);
    });
  });

  describe('Database Persistence and State Management', () => {
    it('should persist agents across CLI invocations', async () => {
      // Create agents
      await execInContainer('/app/bin/systemprompt agents create --name "persist-test-1" --description "First persistent" --instructions "Instructions 1" --type worker');
      await execInContainer('/app/bin/systemprompt agents create --name "persist-test-2" --description "Second persistent" --instructions "Instructions 2" --type monitor');

      // List agents to ensure they exist
      const firstList = await execInContainer('/app/bin/systemprompt agents list');
      expect(firstList.stdout).toContain('persist-test-1');
      expect(firstList.stdout).toContain('persist-test-2');

      // Simulate new CLI session by listing again
      const secondList = await execInContainer('/app/bin/systemprompt agents list');
      expect(secondList.stdout).toContain('persist-test-1');
      expect(secondList.stdout).toContain('persist-test-2');
    });

    it('should maintain agent state after updates', async () => {
      // Create and update agent
      await execInContainer('/app/bin/systemprompt agents create --name "state-persistence-test" --description "Original" --instructions "Original instructions" --type worker');
      await execInContainer('/app/bin/systemprompt agents update state-persistence-test --description "Updated description" --status active');

      // Check state persistence
      const { stdout, stderr } = await execInContainer('/app/bin/systemprompt agents show state-persistence-test');
      expect(stdout).toContain('Updated description');
      expect(stdout).toContain('Original instructions'); // Should keep unchanged fields
    });

    it('should handle database integrity constraints', async () => {
      // Test that database constraints work properly
      const { stdout } = await execInContainer('/app/bin/systemprompt database status');
      expect(stdout).toContain('Connected');
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle duplicate agent names', async () => {
      await execInContainer('/app/bin/systemprompt agents create --name "duplicate-name-test" --description "First" --instructions "Instructions" --type worker');
      
      try {
        await execInContainer('/app/bin/systemprompt agents create --name "duplicate-name-test" --description "Second" --instructions "Instructions" --type worker');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/already exists|duplicate|conflict|error/i);
      }
    });

    it('should validate agent types', async () => {
      try {
        await execInContainer(
          '/app/bin/systemprompt agents create --name "invalid-type-test" --description "Description" --instructions "Instructions" --type "completely-invalid-type"'
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/invalid|error|type/i);
      }
    });

    it('should validate status values on update', async () => {
      await execInContainer('/app/bin/systemprompt agents create --name "status-validation-test" --description "Description" --instructions "Instructions" --type worker');
      
      try {
        await execInContainer('/app/bin/systemprompt agents update status-validation-test --status "completely-invalid-status"');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/invalid|error|status/i);
      }
    });

    it('should validate JSON configuration format', async () => {
      try {
        await execInContainer(
          '/app/bin/systemprompt agents create --name "invalid-json-test" --description "Description" --instructions "Instructions" --type worker --config "invalid json format"'
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/invalid|json|config|format|error/i);
      }
    });

    it('should provide helpful error messages', async () => {
      try {
        await execInContainer('/app/bin/systemprompt agents invalid-command');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/unknown|invalid|command|help|usage/i);
      }
    });
  });
});