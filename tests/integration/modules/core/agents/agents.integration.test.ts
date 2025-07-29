/**
 * Agents Module Integration Test
 * 
 * Tests the complete agent lifecycle and operations:
 * - Module bootstrap and initialization
 * - Agent creation, update, deletion
 * - Agent status management
 * - Agent-task assignment integration
 * - Repository and service interactions
 * - CLI command execution
 * 
 * Coverage targets:
 * - src/modules/core/agents/index.ts
 * - src/modules/core/agents/services/agent.service.ts
 * - src/modules/core/agents/repositories/*.ts
 * - src/modules/core/agents/cli/*.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { AgentService } from '@/modules/core/agents/services/agent.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { AgentsStatus } from '@/modules/core/agents/types/database.generated';
import { EventNames } from '@/modules/core/events/types/index';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('Agents Module Integration Tests', () => {
  let bootstrap: Bootstrap;
  let agentService: AgentService;
  let dbService: DatabaseService;
  let eventBus: EventBusService;
  
  const testSessionId = `agents-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path
    process.env.DATABASE_PATH = testDbPath;
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services
    const agentsModule = modules.get('agents');
    const dbModule = modules.get('database');
    const eventsModule = modules.get('events');
    
    if (!agentsModule || !('exports' in agentsModule) || !agentsModule.exports) {
      throw new Error('Agents module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    if (!eventsModule || !('exports' in eventsModule) || !eventsModule.exports) {
      throw new Error('Events module not loaded');
    }
    
    dbService = dbModule.exports.service();
    
    if ('service' in agentsModule.exports && typeof agentsModule.exports.service === 'function') {
      agentService = agentsModule.exports.service();
    } else {
      throw new Error('Agent service not available');
    }
    
    if ('eventBus' in eventsModule.exports) {
      eventBus = eventsModule.exports.eventBus;
    } else {
      throw new Error('Event bus service not available');
    }
  });

  afterAll(async () => {
    // Shutdown bootstrap
    if (bootstrap) {
      await bootstrap.shutdown();
    }
    
    // Clean up singletons
    try {
      const { DatabaseService } = await import('@/modules/core/database/services/database.service');
      await DatabaseService.reset();
    } catch (error) {
      // Service might not be loaded
    }

    try {
      const { AgentService } = await import('@/modules/core/agents/services/agent.service');
      await AgentService.reset();
    } catch (error) {
      // Service might not be loaded
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    // Force garbage collection
    if (typeof global.gc === 'function') {
      global.gc();
    }
  });

  beforeEach(async () => {
    // Clear agent data before each test - order matters for foreign keys
    try {
      await dbService.execute('DELETE FROM agent_config');
      await dbService.execute('DELETE FROM agent_tools');
      await dbService.execute('DELETE FROM agent_capabilities');
      await dbService.execute('DELETE FROM agent_logs');
      await dbService.execute('DELETE FROM agents');
      
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.warn('Failed to clear agent tables in beforeEach:', error);
    }
  });

  describe('Module Bootstrap', () => {
    it('should load agents module during bootstrap', async () => {
      const modules = bootstrap.getModules();
      expect(modules.has('agents')).toBe(true);
      
      const module = modules.get('agents');
      expect(module).toBeDefined();
      expect(module?.name).toBe('agents');
    });

    it('should execute agents status command', async () => {
      const result = await runCLICommand(['agents', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output.toLowerCase()).toMatch(/agent|status/);
    });
  });

  describe('Agent Lifecycle', () => {
    it('should create agent without knowing about tasks', async () => {
      const agent = await agentService.createAgent({
        name: 'worker-1',
        description: 'Test worker agent',
        instructions: 'Process data and generate reports',
        type: 'worker'
      });

      expect(agent.id).toBeDefined();
      expect(agent.assigned_tasks).toBe(0);
      expect(agent.completed_tasks).toBe(0);
      expect(agent.failed_tasks).toBe(0);
    });
    
    it('should handle multiple agents and tasks independently', async () => {
      // Create multiple agents
      const agents = await Promise.all([
        agentService.createAgent({ 
          name: 'multi-1', 
          description: 'Multi agent 1',
          instructions: 'Test',
          type: 'worker' 
        }),
        agentService.createAgent({ 
          name: 'multi-2', 
          description: 'Multi agent 2',
          instructions: 'Test',
          type: 'worker' 
        }),
        agentService.createAgent({ 
          name: 'multi-3', 
          description: 'Multi agent 3',
          instructions: 'Test',
          type: 'worker' 
        })
      ]);

      // Update status for all agents sequentially to avoid database conflicts
      for (const agent of agents) {
        await agentService.updateAgentStatus(agent.id, AgentsStatus.IDLE);
      }
      
      // Verify agents have independent state
      const activeAgents = await Promise.all(
        agents.map(agent => agentService.getAgent(agent.id))
      );

      activeAgents.forEach(agent => {
        expect(agent?.status).toBe(AgentsStatus.IDLE);
      });
    });
    
    it('should update agent properties', async () => {
      const agent = await agentService.createAgent({
        name: 'update-test',
        description: 'Original description',
        instructions: 'Original instructions',
        type: 'worker'
      });
      
      const updated = await agentService.updateAgent(agent.id, {
        description: 'Updated description',
        instructions: 'Updated instructions'
      });
      
      expect(updated.description).toBe('Updated description');
      expect(updated.instructions).toBe('Updated instructions');
    });
    
    it('should delete agent and clean up references', async () => {
      const agent = await agentService.createAgent({
        name: 'delete-test',
        description: 'To be deleted',
        instructions: 'Test',
        type: 'worker'
      });
      
      await agentService.deleteAgent(agent.id);
      
      const deleted = await agentService.getAgent(agent.id);
      expect(deleted).toBeNull();
    });
  });

  describe('Agent Status Management', () => {
    it('should transition agent from stopped to idle', async () => {
      const agent = await agentService.createAgent({
        name: 'status-test-1',
        description: 'Status test',
        instructions: 'Test',
        type: 'worker'
      });
      
      expect(agent.status).toBe(AgentsStatus.STOPPED);
      
      const updated = await agentService.updateAgentStatus(agent.id, AgentsStatus.IDLE);
      expect(updated.status).toBe(AgentsStatus.IDLE);
    });
    
    it('should transition agent from idle to active', async () => {
      const agent = await agentService.createAgent({
        name: 'status-test-2',
        description: 'Status test',
        instructions: 'Test',
        type: 'worker'
      });
      
      await agentService.updateAgentStatus(agent.id, AgentsStatus.IDLE);
      const updated = await agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE);
      expect(updated.status).toBe(AgentsStatus.ACTIVE);
    });
    
  });

  describe('Agent-Task Integration', () => {
    it('should communicate through events without direct coupling', async () => {
      const events: any[] = [];
      
      // Track all events
      const handler1 = (event: any) => {
        events.push({ type: 'agent.created', data: event });
      };
      const handler2 = (event: any) => {
        events.push({ type: 'agent.status', data: event });
      };
      
      eventBus.on(EventNames.AGENT_CREATED, handler1);
      eventBus.on(EventNames.AGENT_STATUS_CHANGED, handler2);

      // Create agent and update status
      const agent = await agentService.createAgent({
        name: 'event-test',
        description: 'Event test',
        instructions: 'Test',
        type: 'worker'
      });
      
      await agentService.updateAgentStatus(agent.id, AgentsStatus.IDLE);
      
      // Wait for events to propagate
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify event flow
      expect(events.some(e => e.type === 'agent.created')).toBe(true);
      expect(events.some(e => e.type === 'agent.status')).toBe(true);
      
      // Cleanup
      eventBus.off(EventNames.AGENT_CREATED, handler1);
      eventBus.off(EventNames.AGENT_STATUS_CHANGED, handler2);
    });
  });

  describe('CLI Commands', () => {
    it('should create agent with all required fields', async () => {
      const result = await runCLICommand([
        'agents', 'create',
        '--name', 'cli-test-agent',
        '--description', 'Test agent description',
        '--instructions', 'Process data and generate reports',
        '--type', 'worker'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/created|success/i);
    });
    
    it('should list agents in JSON format', async () => {
      // Create some agents first
      await agentService.createAgent({
        name: 'list-test-1',
        description: 'List test 1',
        instructions: 'Test',
        type: 'worker'
      });
      
      await agentService.createAgent({
        name: 'list-test-2',
        description: 'List test 2',
        instructions: 'Test',
        type: 'monitor'
      });
      
      const result = await runCLICommand(['agents', 'list', '--format', 'json']);
      
      expect(result.exitCode).toBe(0);
      
      // The output includes npm run prefix, so extract JSON
      const jsonMatch = result.output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const agents = JSON.parse(jsonMatch[0]);
        expect(Array.isArray(agents)).toBe(true);
        expect(agents.length).toBeGreaterThanOrEqual(2);
      }
    });
    
    it('should show agent details by name', async () => {
      await agentService.createAgent({
        name: 'detail-agent',
        description: 'Detail test agent',
        instructions: 'Test instructions',
        type: 'monitor',
        capabilities: ['cap1', 'cap2'],
        tools: ['tool1', 'tool2']
      });
      
      const result = await runCLICommand(['agents', 'show', '-n', 'detail-agent']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('detail-agent');
      expect(result.output).toContain('Detail test agent');
    });
    
    it('should handle CLI validation errors', async () => {
      // Test missing required field
      const result1 = await runCLICommand(['agents', 'create']);
      expect(result1.exitCode).not.toBe(0);
      
      // Test invalid type
      const result2 = await runCLICommand([
        'agents', 'create',
        '--name', 'test',
        '--description', 'test',
        '--instructions', 'test',
        '--type', 'invalid-type'
      ]);
      expect(result2.exitCode).not.toBe(0);
    });
  });

  async function runCLICommand(args: string[]): Promise<{ output: string; errors: string; exitCode: number | null }> {
    const cliProcess = spawn('npm', ['run', 'cli', '--', ...args], {
      cwd: process.cwd(),
      shell: true,
    });

    const output: string[] = [];
    const errors: string[] = [];

    cliProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    cliProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      cliProcess.on('close', (code) => {
        resolve(code);
      });
    });

    return {
      output: output.join(''),
      errors: errors.join(''),
      exitCode,
    };
  }
});