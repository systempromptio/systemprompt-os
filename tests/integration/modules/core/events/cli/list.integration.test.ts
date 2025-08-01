/**
 * Integration tests for events list CLI command
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runCLICommand } from '../../../../../utils/cli-runner';

describe('events list CLI command', () => {
  beforeAll(async () => {
    // Ensure we have some test events
    try {
      await runCLICommand('events', 'emit', [
        '--eventName', 'test.integration.event',
        '--data', '{"test": true}',
        '--format', 'json'
      ]);
    } catch (error) {
      // Ignore errors - event might already exist
    }
  });

  afterAll(async () => {
    // Clean up test events
    try {
      await runCLICommand('events', 'clear');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('JSON output', () => {
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand('events', 'list', [
        '--format', 'json',
        '--limit', '5'
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Extract JSON from stdout (ignore module initialization logs)
      const jsonMatch = stdout.match(/^\[[\s\S]*\]$/m);
      expect(jsonMatch).toBeTruthy();
      const jsonOutput = jsonMatch![0];
      expect(() => JSON.parse(jsonOutput)).not.toThrow();
      const data = JSON.parse(jsonOutput);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should include required event fields in JSON output', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand('events', 'list', [
        '--format', 'json',
        '--limit', '3'
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Extract JSON from stdout (ignore module initialization logs)
      const jsonMatch = stdout.match(/^\[[\s\S]*\]$/m);
      expect(jsonMatch).toBeTruthy();
      const events = JSON.parse(jsonMatch![0]);
      if (events.length > 0) {
        const event = events[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('event_name');
        expect(event).toHaveProperty('emitted_at');
        expect(event).toHaveProperty('module_source');
      }
    });

    it('should support limit parameter', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand('events', 'list', [
        '--format', 'json',
        '--limit', '2'
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Extract JSON from stdout (ignore module initialization logs)
      const jsonMatch = stdout.match(/^\[[\s\S]*\]$/m);
      expect(jsonMatch).toBeTruthy();
      const events = JSON.parse(jsonMatch![0]);
      expect(events.length).toBeLessThanOrEqual(2);
    });

    it('should support eventName filter', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand('events', 'list', [
        '--format', 'json',
        '--eventName', 'test.integration.event'
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Extract JSON from stdout (ignore module initialization logs)
      const jsonMatch = stdout.match(/^\[[\s\S]*\]$/m);
      expect(jsonMatch).toBeTruthy();
      const events = JSON.parse(jsonMatch![0]);
      if (events.length > 0) {
        events.forEach(event => {
          expect(event.event_name).toContain('test.integration.event');
        });
      }
    });
  });

  describe('text output', () => {
    it('should display events in table format', async () => {
      // Emit a test event first to ensure we have data
      await runCLICommand('events', 'emit', [
        '--eventName', 'test.table.display',
        '--data', '{"test": "table"}',
        '--format', 'json'
      ]);

      const { stdout, stderr, exitCode } = await runCLICommand('events', 'list', [
        '--limit', '5'
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Check for either "Events" section header or table headers
      expect(stdout).toMatch(/Events|ID|Event Name|Source|Emitted At/);
    });

    it('should handle empty results gracefully', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand('events', 'list', [
        '--eventName', 'nonexistent.event.name.that.should.not.exist'
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('No events found');
    });
  });

  describe('validation', () => {
    it('should validate limit parameter', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand('events', 'list', [
        '--limit', '0'
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Number must be greater than 0');
    });

    it('should validate limit maximum', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand('events', 'list', [
        '--limit', '1001'
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Number must be less than or equal to 1000');
    });
  });

  describe('error handling', () => {
    it('should handle invalid format gracefully', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand('events', 'list', [
        '--format', 'invalid'
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid enum value');
    });
  });
});