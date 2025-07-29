/**
 * Event Bus Communication Integration Tests
 * Tests inter-module communication through event system using proper bootstrap
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { EventBusService } from '@/modules/core/events/services/event-bus.service';
import type { TaskService } from '@/modules/core/tasks/services/task.service';
import type { AgentService } from '@/modules/core/agents/services/agent.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { EventNames } from '@/modules/core/events/types/index';
import { createTestId, waitForEvent } from '../../../setup';
import type { ITask } from '@/modules/core/tasks/types/index';
import type { IAgent } from '@/modules/core/agents/types/agent.types';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Event Bus Communication Integration Test', () => {
  let bootstrap: Bootstrap;
  let eventBus: EventBusService;
  let taskService: TaskService;
  let agentService: AgentService;
  let dbService: DatabaseService;
  
  const testSessionId = `event-bus-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    console.log(`🚀 Setting up event bus integration test (session: ${testSessionId})...`);
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path
    process.env.DATABASE_PATH = testDbPath;
    
    // Bootstrap the system properly
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get services from bootstrapped modules
    const eventsModule = modules.get('events');
    const tasksModule = modules.get('tasks');
    const agentsModule = modules.get('agents');
    const dbModule = modules.get('database');
    
    if (!eventsModule || !('exports' in eventsModule) || !eventsModule.exports) {
      throw new Error('Events module not loaded');
    }
    
    if (!tasksModule || !('exports' in tasksModule) || !tasksModule.exports) {
      throw new Error('Tasks module not loaded');
    }
    
    if (!agentsModule || !('exports' in agentsModule) || !agentsModule.exports) {
      throw new Error('Agents module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    // Get service instances
    dbService = dbModule.exports.service();
    
    if ('service' in eventsModule.exports && typeof eventsModule.exports.service === 'function') {
      eventBus = eventsModule.exports.service();
    }
    
    if ('service' in tasksModule.exports && typeof tasksModule.exports.service === 'function') {
      taskService = tasksModule.exports.service();
    }
    
    if ('service' in agentsModule.exports && typeof agentsModule.exports.service === 'function') {
      agentService = agentsModule.exports.service();
    }
    
    console.log('✅ Event bus integration test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up event bus test (session: ${testSessionId})...`);
    
    try {
      await bootstrap.shutdown();
    } catch (error) {
      // Ignore shutdown errors
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    console.log('✅ Cleanup complete!');
  });

  beforeEach(async () => {
    // Clear test data before each test
    try {
      await dbService.execute('DELETE FROM task_execution_history');
      await dbService.execute('DELETE FROM task');
      await dbService.execute('DELETE FROM agents');
    } catch (error) {
      // Tables might not exist yet, ignore
    }
  });

  describe('Event Bus Basic Operations', () => {
    it('should emit and handle events', async () => {
      const testPayload = { test: 'data' };
      let receivedPayload: any = null;
      
      // Subscribe to event
      const unsubscribe = eventBus.on('test.event', (payload) => {
        receivedPayload = payload;
      });
      
      // Emit event
      eventBus.emit('test.event', testPayload);
      
      // Wait for event to be processed
      await waitForEvent(10);
      
      expect(receivedPayload).toEqual(testPayload);
      
      // Cleanup
      unsubscribe();
    });

    it('should handle multiple subscribers', async () => {
      let count = 0;
      
      // Subscribe multiple handlers
      const unsubscribe1 = eventBus.on('multi.event', () => count++);
      const unsubscribe2 = eventBus.on('multi.event', () => count++);
      const unsubscribe3 = eventBus.on('multi.event', () => count++);
      
      // Emit event
      eventBus.emit('multi.event', {});
      
      // Wait for events to be processed
      await waitForEvent(10);
      
      expect(count).toBe(3);
      
      // Cleanup
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    });
  });

  describe('Cross-Module Event Communication', () => {
    it('should handle task creation events', async () => {
      let taskCreatedEvent: any = null;
      
      // Listen for task created events
      const unsubscribe = eventBus.on(EventNames.TASK_CREATED, (event) => {
        taskCreatedEvent = event;
      });
      
      // Create a task
      const taskData = {
        type: 'test-task',
        module_id: 'test',
        instructions: { action: 'test' },
        priority: 1
      };
      
      const taskId = await taskService.createTask(taskData);
      
      // Wait for event
      await waitForEvent(50);
      
      // Verify event was emitted
      expect(taskCreatedEvent).toBeDefined();
      expect(taskCreatedEvent.taskId).toBe(taskId);
      
      // Cleanup
      unsubscribe();
    });

    it('should handle agent creation events', async () => {
      let agentCreatedEvent: any = null;
      
      // Listen for agent created events
      const unsubscribe = eventBus.on(EventNames.AGENT_CREATED, (event) => {
        agentCreatedEvent = event;
      });
      
      // Create an agent
      const agentData = {
        name: `test-agent-${Date.now()}`,
        description: 'Test agent',
        instructions: 'Test instructions',
        type: 'worker' as const
      };
      
      const agent = await agentService.createAgent(agentData);
      
      // Wait for event
      await waitForEvent(50);
      
      // Verify event was emitted
      expect(agentCreatedEvent).toBeDefined();
      expect(agentCreatedEvent.agentId).toBe(agent.id);
      
      // Cleanup
      unsubscribe();
    });
  });

  describe('Event Error Handling', () => {
    it('should handle errors in event handlers gracefully', async () => {
      let errorHandled = false;
      
      // Subscribe with error-throwing handler
      const unsubscribe = eventBus.on('error.event', () => {
        errorHandled = true;
        throw new Error('Test error');
      });
      
      // Emit event - should not throw
      expect(() => eventBus.emit('error.event', {})).not.toThrow();
      
      // Wait for event processing
      await waitForEvent(10);
      
      expect(errorHandled).toBe(true);
      
      // Cleanup
      unsubscribe();
    });
  });

  describe('Event Patterns', () => {
    it('should support wildcard event patterns', async () => {
      let eventCount = 0;
      
      // Subscribe to pattern
      const unsubscribe = eventBus.on('test.*', () => {
        eventCount++;
      });
      
      // Emit multiple matching events
      eventBus.emit('test.one', {});
      eventBus.emit('test.two', {});
      eventBus.emit('test.three', {});
      eventBus.emit('other.event', {}); // Should not match
      
      // Wait for events
      await waitForEvent(20);
      
      expect(eventCount).toBe(3);
      
      // Cleanup
      unsubscribe();
    });
  });
});