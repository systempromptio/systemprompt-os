/**
 * User Journey: Agent Management
 * 
 * Tests the complete user journey for managing agents:
 * - Creating agents with different configurations
 * - Listing and filtering agents
 * - Updating agent properties and status
 * - Viewing agent details and performance
 * - Deleting agents when no longer needed
 * 
 * This test simulates real user workflows and validates
 * the end-to-end functionality from a user perspective.
 */

import { describe, it, expect } from 'vitest';
import { execInContainer, execLocalCLI, expectCLISuccess, expectCLIFailure, getAgentIdByName } from '../shared/bootstrap.js';

describe('User Journey: Agent Management', () => {
  const testId = Date.now();
  
  describe('Agent Creation Journey', () => {
    it('should walk through creating a complete agent setup', async () => {
      // Step 1: User creates a basic worker agent
      const workerName = `worker-agent-${testId}`;
      const { stdout: createResult } = await execInContainer(
        `/app/bin/systemprompt agents create --name "${workerName}" --description "Data processing worker" --instructions "Process incoming data and generate reports" --type "worker" --capabilities "data-processing,report-generation"`
      );

      expect(createResult).toMatch(/created successfully|success/i);
      expect(createResult).toContain(workerName);

      // Step 2: User verifies the agent appears in the list
      const { stdout: listResult } = await execInContainer('/app/bin/systemprompt agents list');
      expect(listResult).toContain(workerName);
      expect(listResult).toContain('worker');

      // Step 3: User checks detailed information about their agent
      const { stdout: detailResult } = await execInContainer(`/app/bin/systemprompt agents show -n "${workerName}"`);
      expect(detailResult).toContain(workerName);
      expect(detailResult).toContain('Data processing worker');
      expect(detailResult).toContain('data-processing');
    });

    it('should handle agent creation with JSON configuration', async () => {
      // User creates an advanced agent with custom configuration
      const monitorName = `monitor-agent-${testId}`;
      const config = JSON.stringify({ maxTasks: 5, alertThreshold: 90 });
      
      const result = await execLocalCLI([
        'agents', 'create',
        '--name', monitorName,
        '--description', 'System monitoring agent',
        '--instructions', 'Monitor system health and send alerts',
        '--type', 'monitor',
        '--config', config
      ]);

      expect(result.stderr).toBe('');
      expect(result.stdout).toMatch(/created successfully|success/i);
      expect(result.stdout).toContain(monitorName);
    });
  });

  describe('Agent Management Journey', () => {
    it('should walk through updating and managing an agent', async () => {
      // Step 1: Create an agent to manage
      const agentName = `manageable-agent-${testId}`;
      await execInContainer(
        `/app/bin/systemprompt agents create --name "${agentName}" --description "Test agent for management" --instructions "Basic instructions" --type "worker"`
      );

      // Step 2: User updates the agent description
      const { stdout: updateResult } = await execInContainer(
        `/app/bin/systemprompt agents update -n "${agentName}" --description "Updated description for better clarity"`
      );
      expect(updateResult).toMatch(/updated successfully|success/i);

      // Step 3: User changes the agent type
      const { stdout: typeUpdateResult } = await execInContainer(
        `/app/bin/systemprompt agents update -n "${agentName}" --type "coordinator"`
      );
      expect(typeUpdateResult).toMatch(/updated successfully|success/i);

      // Step 4: User verifies the changes
      const { stdout: verifyResult } = await execInContainer(`/app/bin/systemprompt agents show -n "${agentName}"`);
      expect(verifyResult).toContain('Updated description for better clarity');
      expect(verifyResult).toContain('coordinator');
    });

    it('should handle agent status transitions', async () => {
      // User manages agent lifecycle states
      const statusAgent = `status-agent-${testId}`;
      await execInContainer(
        `/app/bin/systemprompt agents create --name "${statusAgent}" --description "Status test agent" --instructions "Test instructions" --type "worker"`
      );

      // Start the agent
      const { stdout: startResult } = await execInContainer(`/app/bin/systemprompt agents update -n "${statusAgent}" --status "active"`);
      expect(startResult).toMatch(/updated successfully|success/i);

      // Verify status change
      const { stdout: statusCheck } = await execInContainer('/app/bin/systemprompt agents list --status active');
      expect(statusCheck).toContain(statusAgent);
    });
  });

  describe('Agent Discovery and Filtering Journey', () => {
    it('should help user find agents using various filters', async () => {
      // Step 1: User lists all agents to see what's available
      const { stdout: allAgents } = await execInContainer('/app/bin/systemprompt agents list');
      expect(allAgents).toContain('Listing Agents');

      // Step 2: User wants to see only worker type agents
      const { stdout: workerAgents } = await execInContainer('/app/bin/systemprompt agents list --format json');
      const agents = JSON.parse(workerAgents);
      expect(Array.isArray(agents)).toBe(true);

      // Step 3: User exports agent data for external analysis
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0]).toHaveProperty('name');
    });
  });

  describe('Agent Cleanup Journey', () => {
    it('should walk through agent deletion process', async () => {
      // Step 1: User creates a temporary agent for testing
      const tempAgent = `temp-agent-${testId}`;
      await execInContainer(
        `/app/bin/systemprompt agents create --name "${tempAgent}" --description "Temporary test agent" --instructions "Temporary instructions" --type "worker"`
      );

      // Step 2: User realizes they no longer need the agent and deletes it
      const agentId = await getAgentIdByName(tempAgent);
      const { stdout: deleteResult } = await execInContainer(`/app/bin/systemprompt agents delete --id "${agentId}" --force`);
      expect(deleteResult).toMatch(/deleted successfully|success/i);

      // Step 3: User verifies the agent is no longer in the list
      const { stdout: listAfterDelete } = await execInContainer('/app/bin/systemprompt agents list');
      expect(listAfterDelete).not.toContain(tempAgent);
    });
  });

  describe('Error Handling in Agent Journey', () => {
    it('should guide user through error scenarios', async () => {
      // User attempts to create agent with missing required fields
      try {
        await execInContainer('/app/bin/systemprompt agents create --name "incomplete-agent"');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect((error.stdout || '') + (error.stderr || '')).toMatch(/required|missing|description|instructions|type/i);
      }

      // User attempts to create agent with invalid type
      try {
        await execInContainer(
          `/app/bin/systemprompt agents create --name "invalid-type-agent-${testId}" --description "Test" --instructions "Test" --type "invalid-type"`
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect((error.stdout || '') + (error.stderr || '')).toMatch(/invalid|error|type/i);
      }
    });
  });
});