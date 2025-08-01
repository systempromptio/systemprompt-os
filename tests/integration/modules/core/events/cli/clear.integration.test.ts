/**
 * Integration tests for events clear CLI command
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { execSync } from 'child_process';

describe('events clear CLI command', () => {
  const CLI_CMD = './bin/systemprompt events clear';

  beforeEach(() => {
    // Ensure we have some test events before clearing
    try {
      execSync('./bin/systemprompt events emit --eventName "test.clear.setup" --data \'{"setup": true}\' --format json', {
        encoding: 'utf8',
        timeout: 10000
      });
    } catch (error) {
      // Ignore errors
    }
  });

  describe('safety and confirmation', () => {
    it('should require confirmation flag', () => {
      expect(() => {
        execSync(`${CLI_CMD} --type events --format json`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should display safety warning without confirm flag', () => {
      const result = execSync(`${CLI_CMD} --type events`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result).toContain('This operation will permanently delete data');
      expect(result).toContain('Use --confirm flag to proceed');
    });
  });

  describe('JSON output with confirmation', () => {
    it('should return valid JSON with --format json and --confirm', () => {
      const result = execSync(`${CLI_CMD} --type events --confirm --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
      const data = JSON.parse(result);
      expect(data.success).toBe(true);
    });

    it('should include operation details in JSON response', () => {
      const result = execSync(`${CLI_CMD} --type events --confirm --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('cleared');
      expect(response).toHaveProperty('before');
      expect(response).toHaveProperty('after');
      expect(response).toHaveProperty('timestamp');
      expect(response.cleared).toHaveProperty('events');
      expect(response.cleared).toHaveProperty('subscriptions');
      expect(response.cleared).toHaveProperty('listeners');
    });
  });

  describe('text output with confirmation', () => {
    it('should display clear operation results', () => {
      const result = execSync(`${CLI_CMD} --type events --confirm`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result).toContain('Clear operation completed');
      expect(result).toContain('Operation');
      expect(result).toContain('Events Before');
      expect(result).toContain('Events After');
    });
  });

  describe('clear types', () => {
    it('should support clearing events only', () => {
      const result = execSync(`${CLI_CMD} --type events --confirm --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.cleared.events).toBe(true);
      expect(response.cleared.subscriptions).toBe(false);
    });

    it('should support clearing subscriptions only', () => {
      const result = execSync(`${CLI_CMD} --type subscriptions --confirm --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.cleared.events).toBe(false);
      expect(response.cleared.subscriptions).toBe(true);
      expect(response.cleared.listeners).toBe(true);
    });

    it('should support clearing all', () => {
      const result = execSync(`${CLI_CMD} --type all --confirm --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.cleared.events).toBe(true);
      expect(response.cleared.subscriptions).toBe(true);
      expect(response.cleared.listeners).toBe(true);
    });
  });

  describe('validation', () => {
    it('should validate type parameter', () => {
      expect(() => {
        execSync(`${CLI_CMD} --type invalid --confirm --format json`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should default to events type', () => {
      const result = execSync(`${CLI_CMD} --confirm --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.cleared.events).toBe(true);
      expect(response.cleared.subscriptions).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle invalid format gracefully', () => {
      expect(() => {
        execSync(`${CLI_CMD} --confirm --format invalid`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('functionality verification', () => {
    it('should actually clear events from database', () => {
      // First, ensure we have events
      execSync('./bin/systemprompt events emit --eventName "test.clear.verify" --format json', {
        encoding: 'utf8',
        timeout: 10000
      });

      // Get count before clearing
      const beforeResult = execSync('./bin/systemprompt events status --format json', {
        encoding: 'utf8',
        timeout: 10000
      });
      const beforeStats = JSON.parse(beforeResult);
      const eventsBefore = beforeStats.statistics.total_events;

      // Clear events
      execSync(`${CLI_CMD} --type events --confirm --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      // Get count after clearing
      const afterResult = execSync('./bin/systemprompt events status --format json', {
        encoding: 'utf8',
        timeout: 10000
      });
      const afterStats = JSON.parse(afterResult);
      const eventsAfter = afterStats.statistics.total_events;

      // Should be cleared
      expect(eventsAfter).toBe(0);
      expect(eventsBefore).toBeGreaterThan(eventsAfter);
    });
  });
});