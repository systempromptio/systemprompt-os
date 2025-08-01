/**
 * Events CLI Status Command Integration Tests
 * Tests the events status CLI command following SystemPrompt OS CLI testing standards
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import type { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { createTestId } from '../../../../setup';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Events CLI Status Command Integration Tests', () => {
  let bootstrap: Bootstrap;
  let dbService: DatabaseService;
  let eventBus: EventBusService;
  
  const testSessionId = `events-cli-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    console.log(`🚀 Setting up events CLI status integration test (session: ${testSessionId})...`);
    
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
    
    // Get services
    const eventsModule = modules.get('events');
    const dbModule = modules.get('database');
    
    if (!eventsModule || !('exports' in eventsModule) || !eventsModule.exports) {
      throw new Error('Events module not loaded');
    }
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    dbService = dbModule.exports.service();
    eventBus = eventsModule.exports.eventBus;
    
    console.log('✅ Events CLI status integration test ready!');
  });

  afterAll(async () => {
    console.log(`🧹 Cleaning up events CLI test (session: ${testSessionId})...`);
    
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
      await dbService.execute('DELETE FROM events');
      await dbService.execute('DELETE FROM event_subscriptions');
    } catch (error) {
      // Tables might not exist yet, ignore
    }
  });

  describe('CLI Command Execution', () => {
    it('should execute status command successfully with default format', async () => {
      // Create some test events first
      await dbService.execute(`
        INSERT INTO events (event_name, emitted_at, module_source, event_data)
        VALUES 
          ('test.event1', datetime('now'), 'test-module', '{"data": "test1"}'),
          ('test.event2', datetime('now'), 'test-module', '{"data": "test2"}')
      `);

      // Execute CLI command
      const { stdout, stderr } = await execAsync(
        `DATABASE_PATH=${testDbPath} ./bin/systemprompt events status`,
        { cwd: process.cwd() }
      );
      
      expect(stderr).toBe('');
      expect(stdout).toContain('Event Bus Status');
      expect(stdout).toContain('Total Events');
      expect(stdout).toContain('Active Subscriptions');
    });

    it('should return valid JSON with --format json', async () => {
      // Create test events
      await dbService.execute(`
        INSERT INTO events (event_name, emitted_at, module_source, event_data)
        VALUES 
          ('test.json.event', datetime('now'), 'test-module', '{"test": true}')
      `);

      // Execute CLI command with JSON format
      const { stdout, stderr } = await execAsync(
        `DATABASE_PATH=${testDbPath} ./bin/systemprompt events status --format json`,
        { cwd: process.cwd() }
      );
      
      expect(stderr).toBe('');
      
      // Parse and validate JSON output
      const output = JSON.parse(stdout);
      
      expect(output).toHaveProperty('module', 'events');
      expect(output).toHaveProperty('statistics');
      expect(output.statistics).toHaveProperty('total_events');
      expect(output.statistics).toHaveProperty('active_subscriptions');
      expect(output.statistics).toHaveProperty('recent_events_count');
      expect(output).toHaveProperty('subscriptions');
      expect(output).toHaveProperty('recent_events');
      expect(output).toHaveProperty('timestamp');
      
      // Verify data structure
      expect(Array.isArray(output.subscriptions)).toBe(true);
      expect(Array.isArray(output.recent_events)).toBe(true);
      expect(output.statistics.total_events).toBeGreaterThan(0);
    });

    it('should handle --verbose flag correctly', async () => {
      // Create test event with data
      await dbService.execute(`
        INSERT INTO events (event_name, emitted_at, module_source, event_data)
        VALUES ('test.verbose.event', datetime('now'), 'test-module', '{"verbose": true, "data": "detailed"}')
      `);

      // Execute with verbose flag
      const { stdout } = await execAsync(
        `DATABASE_PATH=${testDbPath} ./bin/systemprompt events status --verbose --format json`,
        { cwd: process.cwd() }
      );
      
      const output = JSON.parse(stdout);
      
      // Verify event data is included
      expect(output.recent_events).toHaveLength(1);
      expect(output.recent_events[0]).toHaveProperty('event_data');
      expect(output.recent_events[0].event_data).toEqual({ verbose: true, data: 'detailed' });
    });

    it('should handle --limit flag correctly', async () => {
      // Create multiple test events
      for (let i = 1; i <= 15; i++) {
        await dbService.execute(`
          INSERT INTO events (event_name, emitted_at, module_source, event_data)
          VALUES ('test.limit.event${i}', datetime('now', '-${i} seconds'), 'test-module', '{"index": ${i}}')
        `);
      }

      // Execute with limit
      const { stdout } = await execAsync(
        `DATABASE_PATH=${testDbPath} ./bin/systemprompt events status --limit 5 --format json`,
        { cwd: process.cwd() }
      );
      
      const output = JSON.parse(stdout);
      
      // Verify limit is respected
      expect(output.recent_events).toHaveLength(5);
      expect(output.statistics.recent_events_count).toBe(5);
      expect(output.statistics.total_events).toBe(15);
    });

    it('should validate argument types', async () => {
      // Test invalid limit value
      try {
        await execAsync(
          `DATABASE_PATH=${testDbPath} ./bin/systemprompt events status --limit -5`,
          { cwd: process.cwd() }
        );
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stderr).toContain('Invalid arguments');
      }
    });

    it('should handle empty database gracefully', async () => {
      // Execute on empty database
      const { stdout } = await execAsync(
        `DATABASE_PATH=${testDbPath} ./bin/systemprompt events status --format json`,
        { cwd: process.cwd() }
      );
      
      const output = JSON.parse(stdout);
      
      expect(output.statistics.total_events).toBe(0);
      expect(output.statistics.active_subscriptions).toBe(0);
      expect(output.statistics.recent_events_count).toBe(0);
      expect(output.subscriptions).toHaveLength(0);
      expect(output.recent_events).toHaveLength(0);
    });
  });

  describe('JSON Output Validation', () => {
    it('should return properly formatted JSON', async () => {
      const { stdout } = await execAsync(
        `DATABASE_PATH=${testDbPath} ./bin/systemprompt events status --format json`,
        { cwd: process.cwd() }
      );
      
      // Should parse without throwing
      expect(() => JSON.parse(stdout)).not.toThrow();
      
      // Should be properly formatted (not minified)
      expect(stdout).toContain('\n');
      expect(stdout).toContain('  '); // 2-space indentation
    });

    it('should include all required fields in JSON output', async () => {
      const { stdout } = await execAsync(
        `DATABASE_PATH=${testDbPath} ./bin/systemprompt events status --format json`,
        { cwd: process.cwd() }
      );
      
      const output = JSON.parse(stdout);
      
      // Required top-level fields
      const requiredFields = ['module', 'statistics', 'subscriptions', 'recent_events', 'timestamp'];
      requiredFields.forEach(field => {
        expect(output).toHaveProperty(field);
      });
      
      // Required statistics fields
      const requiredStatsFields = ['total_events', 'active_subscriptions', 'recent_events_count'];
      requiredStatsFields.forEach(field => {
        expect(output.statistics).toHaveProperty(field);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      try {
        await execAsync(
          `DATABASE_PATH=/nonexistent/path.db ./bin/systemprompt events status`,
          { cwd: process.cwd() }
        );
        expect.fail('Should have thrown database error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stderr).toContain('Failed to get events status');
      }
    });

    it('should return proper exit codes', async () => {
      // Success case
      const { stdout } = await execAsync(
        `DATABASE_PATH=${testDbPath} ./bin/systemprompt events status --format json`,
        { cwd: process.cwd() }
      );
      
      expect(JSON.parse(stdout)).toBeDefined();
      
      // Failure case tested in previous test
    });
  });
});