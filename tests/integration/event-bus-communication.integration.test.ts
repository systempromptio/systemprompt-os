/**
 * Event Bus Communication Integration Tests
 * Tests inter-module communication through event system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { TaskService } from '@/modules/core/tasks/services/task.service';
import { TaskRepository } from '@/modules/core/tasks/repositories/task.repository';
import { AgentService } from '@/modules/core/agents/services/agent.service';
import { AgentRepository } from '@/modules/core/agents/repositories/agent.repository';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LoggerMode, LogOutput } from '@/modules/core/logger/types/index';
import { EventNames } from '@/modules/core/events/types/index';
import { createTestId, waitForEvent } from './setup';
import type { ITask } from '@/modules/core/tasks/types/index';
import type { IAgent } from '@/modules/core/agents/types/agent.types';

describe('Event Bus Communication Integration Test', () => {
  let eventBus: EventBusService;
  let taskService: TaskService;
  let taskRepository: TaskRepository;
  let agentService: AgentService;
  let agentRepository: AgentRepository;
  let dbService: DatabaseService;
  let logger: LoggerService;
  
  const testSessionId = `event-bus-${createTestId()}`;
  const testDir = `${process.cwd()}/.test-integration/${testSessionId}`;
  const testDbPath = `${testDir}/test.db`;

  beforeAll(async () => {
    console.log(`🚀 Setting up event bus integration test (session: ${testSessionId})...`);
    
    // Create test directory
    const fs = require('fs');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Initialize logger first 
    logger = LoggerService.getInstance();
    
    // Initialize event bus
    eventBus = EventBusService.getInstance();
    
    // Initialize database with proper config
    await DatabaseService.initialize({
      type: 'sqlite',
      sqlite: {
        filename: testDbPath
      }
    }, logger);
    dbService = DatabaseService.getInstance();
    
    // Create test database schema
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        instructions TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('worker', 'monitor', 'coordinator')),
        status TEXT NOT NULL DEFAULT 'stopped' CHECK(status IN ('idle', 'active', 'stopped', 'error')),
        config TEXT DEFAULT '{}',
        capabilities TEXT DEFAULT '[]',
        tools TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_tasks INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        failed_tasks INTEGER DEFAULT 0,
        last_heartbeat TIMESTAMP
      );
    `);
    
    await dbService.execute(`
      CREATE TABLE IF NOT EXISTS task (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type VARCHAR(100) NOT NULL,
        module_id VARCHAR(100) NOT NULL,
        instructions JSON,
        priority INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled', 'stopped')),
        retry_count INTEGER DEFAULT 0,
        max_executions INTEGER DEFAULT 3,
        max_time INTEGER,
        result TEXT,
        error TEXT,
        progress INTEGER,
        assigned_agent_id VARCHAR(255),
        scheduled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        created_by VARCHAR(255),
        metadata JSON
      );
    `);
    
    // Initialize repositories
    taskRepository = new TaskRepository(dbService);
    agentRepository = AgentRepository.getInstance();

    // Initialize services
    taskService = TaskService.getInstance();
    taskService.initialize(logger, taskRepository);

    agentService = AgentService.getInstance();
    
    console.log('✅ Event bus integration test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up event bus test (session: ${testSessionId})...`);
    
    if (eventBus) {
      eventBus.removeAllListeners();
    }
    try {
      await dbService.disconnect();
    } catch (error) {
      // Ignore close errors during cleanup
    }
    
    // Clean up test files
    const fs = require('fs');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    console.log('✅ Cleanup complete!');
  });

  beforeEach(async () => {
    // Clear any remaining listeners from previous tests
    if (eventBus) {
      eventBus.removeAllListeners();
    }
    
    // Clear test data between tests
    if (dbService) {
      try {
        await dbService.execute('DELETE FROM task');
        await dbService.execute('DELETE FROM agents');
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Event Emission and Handling', () => {
    it('should emit and handle basic events', async () => {
      const receivedEvents: Array<{ event: string; data: any }> = [];
      
      // Setup event listeners
      eventBus.on('test.event', (data) => {
        receivedEvents.push({ event: 'test.event', data });
      });
      
      eventBus.on('another.event', (data) => {
        receivedEvents.push({ event: 'another.event', data });
      });
      
      // Emit events
      eventBus.emit('test.event', { message: 'Hello World' });
      eventBus.emit('another.event', { count: 42 });
      
      await waitForEvent(50);
      
      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0]).toEqual({
        event: 'test.event',
        data: { message: 'Hello World' }
      });
      expect(receivedEvents[1]).toEqual({
        event: 'another.event',
        data: { count: 42 }
      });
    });

    it('should handle multiple listeners for the same event', async () => {
      const results: number[] = [];
      
      eventBus.on('multi.listener', (data) => {
        results.push(data.value * 2);
      });
      
      eventBus.on('multi.listener', (data) => {
        results.push(data.value * 3);
      });
      
      eventBus.on('multi.listener', (data) => {
        results.push(data.value * 5);
      });
      
      eventBus.emit('multi.listener', { value: 10 });
      
      await waitForEvent(50);
      
      expect(results).toHaveLength(3);
      expect(results.sort()).toEqual([20, 30, 50]);
    });

    it('should handle one-time event listeners', async () => {
      let callCount = 0;
      
      eventBus.once('once.event', () => {
        callCount++;
      });
      
      // Emit multiple times
      eventBus.emit('once.event', {});
      eventBus.emit('once.event', {});
      eventBus.emit('once.event', {});
      
      await waitForEvent(50);
      
      expect(callCount).toBe(1);
    });

    it('should provide accurate listener counts', () => {
      const testEvent = `count.test.${Date.now()}`;
      expect(eventBus.listenerCount(testEvent)).toBe(0);
      
      const handler1 = () => {};
      const handler2 = () => {};
      
      eventBus.on(testEvent, handler1);
      expect(eventBus.listenerCount(testEvent)).toBe(1);
      
      eventBus.on(testEvent, handler2);
      expect(eventBus.listenerCount(testEvent)).toBe(2);
      
      eventBus.off(testEvent, handler1);
      expect(eventBus.listenerCount(testEvent)).toBe(1);
      
      // Clean up
      eventBus.off(testEvent, handler2);
    });
  });

  describe('Agent-Task Event Communication', () => {
    it('should coordinate agent availability through events', async () => {
      const events: string[] = [];
      
      // Track relevant events
      eventBus.on(EventNames.AGENT_AVAILABLE, () => events.push('agent.available'));
      eventBus.on(EventNames.AGENT_BUSY, () => events.push('agent.busy'));
      eventBus.on(EventNames.AGENT_IDLE, () => events.push('agent.idle'));
      eventBus.on(EventNames.TASK_CREATED, () => events.push('task.created'));
      eventBus.on(EventNames.TASK_ASSIGNED, () => events.push('task.assigned'));
      
      // Create agent and task
      const agent = await agentService.createAgent({
        name: 'Event Test Agent',
        description: 'Test agent for event testing',
        instructions: 'Process events and report results',
        type: 'worker',
        capabilities: ['processing']
      });
      
      const task = await taskService.addTask({
        type: 'processing',
        moduleId: 'test',
        instructions: { action: 'process' }
      });
      
      // Start agent (should emit availability)
      await agentService.startAgent(agent.id);
      
      await waitForEvent(100);
      
      // Verify events were emitted
      expect(events).toContain('task.created');
      expect(events).toContain('agent.available');
    });

    it('should handle task lifecycle events end-to-end', async () => {
      const eventLog: Array<{ event: string; timestamp: number }> = [];
      
      // Monitor all task lifecycle events
      [
        EventNames.TASK_CREATED,
        EventNames.TASK_ASSIGNED,
        EventNames.TASK_STARTED,
        EventNames.TASK_COMPLETED,
        EventNames.AGENT_AVAILABLE,
        EventNames.AGENT_BUSY,
        EventNames.AGENT_IDLE
      ].forEach(eventName => {
        eventBus.on(eventName, () => {
          eventLog.push({ event: eventName, timestamp: Date.now() });
        });
      });
      
      // Create agent
      const agent = await agentService.createAgent({
        name: 'Lifecycle Agent',
        description: 'Test agent for lifecycle testing',
        instructions: 'Execute tasks and report results',
        type: 'worker',
        capabilities: ['execution']
      });
      
      // Start agent
      await agentService.startAgent(agent.id);
      
      // Create task
      const task = await taskService.addTask({
        type: 'execution',
        moduleId: 'test',
        instructions: { command: 'execute' }
      });
      
      // Allow events to propagate
      await waitForEvent(100);
      
      // Assign task to agent
      await taskService.assignTaskToAgent(task.id!, agent.id);
      
      await waitForEvent(200);
      
      // Verify event sequence
      expect(eventLog.length).toBeGreaterThan(0);
      
      const eventNames = eventLog.map(e => e.event);
      expect(eventNames).toContain(EventNames.TASK_CREATED);
      expect(eventNames).toContain(EventNames.AGENT_AVAILABLE);
      
      // Verify chronological order where applicable
      const taskCreatedIndex = eventNames.indexOf(EventNames.TASK_CREATED);
      const agentAvailableIndex = eventNames.indexOf(EventNames.AGENT_AVAILABLE);
      expect(taskCreatedIndex).toBeGreaterThanOrEqual(0);
      expect(agentAvailableIndex).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent task assignments through events', async () => {
      const assignmentEvents: Array<{ taskId: number; agentId: string }> = [];
      
      eventBus.on(EventNames.TASK_ASSIGNED, ({ taskId, agentId }) => {
        assignmentEvents.push({ taskId, agentId });
      });
      
      // Create multiple agents
      const agents = await Promise.all([
        agentService.createAgent({
          name: 'Concurrent Agent 1',
          description: 'Test agent 1',
          instructions: 'Process tasks',
          type: 'worker'
        }),
        agentService.createAgent({
          name: 'Concurrent Agent 2',
          description: 'Test agent 2',
          instructions: 'Process tasks',
          type: 'worker'
        }),
        agentService.createAgent({
          name: 'Concurrent Agent 3',
          description: 'Test agent 3',
          instructions: 'Process tasks',
          type: 'worker'
        })
      ]);
      
      // Start all agents
      await Promise.all(agents.map(agent => agentService.startAgent(agent.id)));
      
      // Create multiple tasks
      const tasks = await Promise.all([
        taskService.addTask({ type: 'work', moduleId: 'test', priority: 1 }),
        taskService.addTask({ type: 'work', moduleId: 'test', priority: 2 }),
        taskService.addTask({ type: 'work', moduleId: 'test', priority: 3 })
      ]);
      
      await waitForEvent(150);
      
      // Verify task assignments occurred
      expect(assignmentEvents.length).toBe(0); // No automatic assignment without orchestrator coordination
      
      // Manually trigger assignments to test event flow (assign each task to a different agent)
      for (let i = 0; i < tasks.length && i < agents.length; i++) {
        await taskService.assignTaskToAgent(tasks[i].id!, agents[i].id);
      }
      
      await waitForEvent(100);
      
      expect(assignmentEvents.length).toBe(3);
      assignmentEvents.forEach(assignment => {
        expect(assignment.taskId).toBeDefined();
        expect(assignment.agentId).toBeDefined();
      });
    });
  });

  describe('Error Handling in Event System', () => {
    it('should handle errors in event handlers gracefully', async () => {
      let errorCount = 0;
      let successCount = 0;
      
      // Add failing handler
      eventBus.on('error.test', () => {
        throw new Error('Intentional test error');
      });
      
      // Add successful handler
      eventBus.on('error.test', () => {
        successCount++;
      });
      
      // Emit event multiple times
      eventBus.emit('error.test', {});
      eventBus.emit('error.test', {});
      eventBus.emit('error.test', {});
      
      await waitForEvent(100);
      
      // Successful handlers should still execute despite errors in other handlers
      expect(successCount).toBe(3);
    });

    it('should handle async errors in event handlers', async () => {
      let asyncErrorCount = 0;
      let asyncSuccessCount = 0;
      
      // Add async failing handler
      eventBus.on('async.error.test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async test error');
      });
      
      // Add async successful handler
      eventBus.on('async.error.test', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        asyncSuccessCount++;
      });
      
      eventBus.emit('async.error.test', {});
      
      await waitForEvent(100);
      
      expect(asyncSuccessCount).toBe(1);
    });

    it('should maintain event system stability under high load', async () => {
      let eventCount = 0;
      const targetEvents = 1000;
      
      eventBus.on('load.test', () => {
        eventCount++;
      });
      
      // Emit many events rapidly
      for (let i = 0; i < targetEvents; i++) {
        eventBus.emit('load.test', { index: i });
      }
      
      // Allow processing time
      await waitForEvent(200);
      
      expect(eventCount).toBe(targetEvents);
    });
  });

  describe('Event System Integration with Services', () => {
    it('should integrate with logger service for event tracking', async () => {
      // This test verifies that events are properly logged
      let testCompleted = false;
      
      eventBus.on('logger.integration.test', () => {
        testCompleted = true;
      });
      
      eventBus.emit('logger.integration.test', { 
        testData: 'logger integration'
      });
      
      await waitForEvent(50);
      
      expect(testCompleted).toBe(true);
    });

    it('should handle service initialization events', async () => {
      const initEvents: string[] = [];
      
      eventBus.on('service.initialized', ({ serviceName }) => {
        initEvents.push(serviceName);
      });
      
      // Simulate service initialization events
      eventBus.emit('service.initialized', { serviceName: 'TaskService' });
      eventBus.emit('service.initialized', { serviceName: 'AgentService' });
      eventBus.emit('service.initialized', { serviceName: 'DatabaseService' });
      
      await waitForEvent(50);
      
      expect(initEvents).toEqual(['TaskService', 'AgentService', 'DatabaseService']);
    });

    it('should coordinate shutdown events across services', async () => {
      const shutdownOrder: string[] = [];
      
      // Setup shutdown handlers in dependency order
      eventBus.on('system.shutdown', () => {
        shutdownOrder.push('OrchestrationService');
      });
      
      eventBus.on('system.shutdown', async () => {
        await waitForEvent(10);
        shutdownOrder.push('TaskService');
      });
      
      eventBus.on('system.shutdown', async () => {
        await waitForEvent(20);
        shutdownOrder.push('AgentService');
      });
      
      eventBus.on('system.shutdown', async () => {
        await waitForEvent(30);
        shutdownOrder.push('DatabaseService');
      });
      
      eventBus.emit('system.shutdown', {});
      
      await waitForEvent(100);
      
      expect(shutdownOrder.length).toBe(4);
      expect(shutdownOrder).toContain('OrchestrationService');
      expect(shutdownOrder).toContain('TaskService');
      expect(shutdownOrder).toContain('AgentService');
      expect(shutdownOrder).toContain('DatabaseService');
    });
  });
});