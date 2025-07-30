/**
 * Agents Module Integration Test
 * 
 * Tests the complete agent lifecycle and operations:
 * - Module bootstrap and initialization
 * - Agent creation, update, deletion
 * - Agent status management
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
import type { AgentRepository } from '@/modules/core/agents/repositories/agent.repository';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { EventBusService } from '@/modules/core/events/services/event-bus.service';
import type { IAgentsModuleExports } from '@/modules/core/agents/types/index';
import { AgentsStatus } from '@/modules/core/agents/types/database.generated';
import { EventNames } from '@/modules/core/events/types/index';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('Agents Module Integration Tests', () => {
  let bootstrap: Bootstrap;
  let agentService: AgentService;
  let agentRepository: AgentRepository;
  let dbService: DatabaseService;
  let eventBus: EventBusService;
  let agentsModule: any;
  
  const testSessionId = `agents-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    console.log(`🚀 Setting up agents integration test (session: ${testSessionId})...`);
    
    // Reset any existing singletons first
    try {
      const { DatabaseService } = await import('@/modules/core/database/services/database.service');
      await DatabaseService.reset();
    } catch (error) {
      // Ignore
    }
    
    try {
      const { LoggerService } = await import('@/modules/core/logger/services/logger.service');
      (LoggerService as any).instance = null;
    } catch (error) {
      // Ignore
    }
    
    try {
      const { AgentService } = await import('@/modules/core/agents/services/agent.service');
      await AgentService.reset();
    } catch (error) {
      // Ignore
    }
    
    try {
      const { ModulesModuleService } = await import('@/modules/core/modules/services/modules-module.service');
      ModulesModuleService.reset();
    } catch (error) {
      // Ignore
    }
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path and environment
    process.env.DATABASE_PATH = testDbPath;
    process.env.DATABASE_FILE = testDbPath;
    process.env.LOG_LEVEL = 'error';
    process.env.DISABLE_TELEMETRY = 'true';
    process.env.NODE_ENV = 'test';
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services
    const agentsModuleRef = modules.get('agents');
    const dbModule = modules.get('database');
    const eventsModule = modules.get('events');
    
    if (!agentsModuleRef || !('exports' in agentsModuleRef) || !agentsModuleRef.exports) {
      throw new Error('Agents module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    if (!eventsModule || !('exports' in eventsModule) || !eventsModule.exports) {
      throw new Error('Events module not loaded');
    }
    
    agentsModule = agentsModuleRef;
    dbService = (dbModule as any).exports.service();
    
    const agentExports = agentsModuleRef.exports as IAgentsModuleExports;
    agentService = agentExports.service();
    agentRepository = agentExports.repository();
    
    if ('eventBus' in eventsModule.exports) {
      eventBus = eventsModule.exports.eventBus;
    } else {
      throw new Error('Event bus service not available');
    }
    
    // Give event handlers time to set up
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('✅ Agents integration test environment ready');
  }, 60000);

  afterAll(async () => {
    console.log('🧹 Cleaning up agents integration test environment...');
    
    // Set a timeout for cleanup
    const cleanupTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Cleanup timeout')), 10000)
    );
    
    try {
      await Promise.race([
        (async () => {
          // Shutdown bootstrap
          if (bootstrap) {
            try {
              await bootstrap.shutdown();
            } catch (error) {
              console.warn('Bootstrap shutdown error:', error);
            }
          }
          
          // Reset singletons
          try {
            const { DatabaseService } = await import('@/modules/core/database/services/database.service');
            await DatabaseService.reset();
          } catch (error) {
            // Ignore
          }

          try {
            const { AgentService } = await import('@/modules/core/agents/services/agent.service');
            await AgentService.reset();
          } catch (error) {
            // Ignore
          }
          
          // Clean up test files
          if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
          }

          // Force garbage collection
          if (typeof global.gc === 'function') {
            global.gc();
          }
        })(),
        cleanupTimeout
      ]);
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
    
    console.log('✅ Agents integration test environment cleaned up');
  }, 30000);

  beforeEach(async () => {
    // Clear agent data before each test - order matters for foreign keys
    try {
      // Get list of existing tables first
      const tableNames = await dbService.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const existingTables = tableNames.map(row => row.name);
      
      // Clear tables in order that respects foreign key constraints
      const tablesToClear = [
        'agent_config',
        'agent_tools', 
        'agent_capabilities',
        'agent_logs',
        'agents'
      ];
      
      for (const table of tablesToClear) {
        if (existingTables.includes(table)) {
          await dbService.execute(`DELETE FROM ${table}`);
        }
      }
      
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 50));
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
    it('should create agent with basic properties', async () => {
      const agent = await agentService.createAgent({
        name: 'test-worker-1',
        description: 'Test worker agent',
        instructions: 'Process data and generate reports',
        type: 'worker'
      });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('test-worker-1');
      expect(agent.description).toBe('Test worker agent');
      expect(agent.type).toBe('worker');
      expect(agent.status).toBe(AgentsStatus.STOPPED);
      expect(agent.assigned_tasks).toBe(0);
      expect(agent.completed_tasks).toBe(0);
      expect(agent.failed_tasks).toBe(0);
    });
    
    it('should handle multiple agents independently', async () => {
      // Create multiple agents
      const agents = await Promise.all([
        agentService.createAgent({ 
          name: 'multi-agent-1', 
          description: 'Multi agent 1',
          instructions: 'Test instructions',
          type: 'worker' 
        }),
        agentService.createAgent({ 
          name: 'multi-agent-2', 
          description: 'Multi agent 2',
          instructions: 'Test instructions', 
          type: 'worker' 
        }),
        agentService.createAgent({ 
          name: 'multi-agent-3', 
          description: 'Multi agent 3',
          instructions: 'Test instructions',
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
        name: 'update-test-agent',
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
        name: 'delete-test-agent',
        description: 'To be deleted',
        instructions: 'Test instructions',
        type: 'worker'
      });
      
      const deleted = await agentService.deleteAgent(agent.id);
      expect(deleted).toBe(true);
      
      const retrieved = await agentService.getAgent(agent.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Agent Status Management', () => {
    it('should transition agent from stopped to idle', async () => {
      const agent = await agentService.createAgent({
        name: 'status-test-1',
        description: 'Status test agent',
        instructions: 'Test instructions',
        type: 'worker'
      });
      
      expect(agent.status).toBe(AgentsStatus.STOPPED);
      
      const updated = await agentService.updateAgentStatus(agent.id, AgentsStatus.IDLE);
      expect(updated.status).toBe(AgentsStatus.IDLE);
    });
    
    it('should transition agent from idle to active', async () => {
      const agent = await agentService.createAgent({
        name: 'status-test-2',
        description: 'Status test agent',
        instructions: 'Test instructions',
        type: 'worker'
      });
      
      await agentService.updateAgentStatus(agent.id, AgentsStatus.IDLE);
      const updated = await agentService.updateAgentStatus(agent.id, AgentsStatus.ACTIVE);
      expect(updated.status).toBe(AgentsStatus.ACTIVE);
    });

    it('should start and stop agents', async () => {
      const agent = await agentService.createAgent({
        name: 'start-stop-test',
        description: 'Start stop test agent',
        instructions: 'Test instructions',
        type: 'worker'
      });
      
      // Start agent
      await agentService.startAgent(agent.id);
      const startedAgent = await agentService.getAgent(agent.id);
      expect(startedAgent?.status).toBe(AgentsStatus.ACTIVE);
      
      // Stop agent
      await agentService.stopAgent(agent.id);
      const stoppedAgent = await agentService.getAgent(agent.id);
      expect(stoppedAgent?.status).toBe(AgentsStatus.STOPPED);
    });
  });

  describe('Agent Availability and Querying', () => {
    it('should list all agents', async () => {
      // Create some test agents
      await agentService.createAgent({
        name: 'list-test-1',
        description: 'List test agent 1',
        instructions: 'Test instructions',
        type: 'worker'
      });
      
      await agentService.createAgent({
        name: 'list-test-2',
        description: 'List test agent 2', 
        instructions: 'Test instructions',
        type: 'monitor'
      });
      
      const agents = await agentService.listAgents();
      expect(agents.length).toBeGreaterThanOrEqual(2);
      
      const names = agents.map(a => a.name);
      expect(names).toContain('list-test-1');
      expect(names).toContain('list-test-2');
    });

    it('should get available agents', async () => {
      const agent = await agentService.createAgent({
        name: 'available-test',
        description: 'Available test agent',
        instructions: 'Test instructions',
        type: 'worker'
      });
      
      // Agent should not be available when stopped
      let availableAgents = await agentService.getAvailableAgents();
      expect(availableAgents.some(a => a.id === agent.id)).toBe(false);
      
      // Start agent to make it available
      await agentService.startAgent(agent.id);
      availableAgents = await agentService.getAvailableAgents();
      expect(availableAgents.some(a => a.id === agent.id)).toBe(true);
    });
  });

  describe('Agent Events', () => {
    it('should emit events for agent lifecycle', async () => {
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
        name: 'event-test-agent',
        description: 'Event test agent',
        instructions: 'Test instructions',
        type: 'worker'
      });
      
      await agentService.updateAgentStatus(agent.id, AgentsStatus.IDLE);
      
      // Wait for events to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

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
      // Use a unique name to avoid conflicts
      const uniqueName = `cli-test-agent-${Date.now()}`;
      
      const result = await runCLICommand([
        'agents', 'create',
        '--name', uniqueName,
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
        name: 'list-json-test-1',
        description: 'List test 1',
        instructions: 'Test instructions',
        type: 'worker'
      });
      
      await agentService.createAgent({
        name: 'list-json-test-2',
        description: 'List test 2',
        instructions: 'Test instructions',
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
        name: 'detail-agent-test',
        description: 'Detail test agent',
        instructions: 'Test instructions',
        type: 'monitor',
        capabilities: ['cap1', 'cap2'],
        tools: ['tool1', 'tool2']
      });
      
      const result = await runCLICommand(['agents', 'show', '-n', 'detail-agent-test']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('detail-agent-test');
      expect(result.output).toContain('Detail test agent');
    });
    
    it('should handle CLI validation errors', async () => {
      // Test missing required field
      const result1 = await runCLICommand(['agents', 'create']);
      expect(result1.exitCode).not.toBe(0);
      
      // Test invalid type
      const result2 = await runCLICommand([
        'agents', 'create',
        '--name', 'test-invalid',
        '--description', 'test',
        '--instructions', 'test',
        '--type', 'invalid-type'
      ]);
      expect(result2.exitCode).not.toBe(0);
    });
  });

  async function runCLICommand(args: string[]): Promise<{ output: string; errors: string; exitCode: number | null }> {
    const cliPath = join(process.cwd(), 'src', 'modules', 'core', 'cli', 'cli', 'main.ts');
    const cliProcess = spawn('npx', ['tsx', cliPath, ...args], {
      cwd: process.cwd(),
    });

    const output: string[] = [];
    const errors: string[] = [];

    cliProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    cliProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      cliProcess.on('error', reject);
      cliProcess.on('exit', (code) => {
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