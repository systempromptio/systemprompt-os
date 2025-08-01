/**
 * Integration tests for events list CLI command
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';

describe('events list CLI command', () => {
  const CLI_CMD = './bin/systemprompt events list';

  beforeAll(async () => {
    // Ensure we have some test events
    try {
      execSync(`${CLI_CMD.replace('list', 'emit')} --eventName "test.integration.event" --data '{"test": true}' --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });
    } catch (error) {
      // Ignore errors - event might already exist
    }
  });

  describe('JSON output', () => {
    it('should return valid JSON with --format json', () => {
      const result = execSync(`${CLI_CMD} --format json --limit 5`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
      const data = JSON.parse(result);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should include required event fields in JSON output', () => {
      const result = execSync(`${CLI_CMD} --format json --limit 3`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const events = JSON.parse(result);
      if (events.length > 0) {
        const event = events[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('event_name');
        expect(event).toHaveProperty('emitted_at');
        expect(event).toHaveProperty('module_source');
      }
    });

    it('should support limit parameter', () => {
      const result = execSync(`${CLI_CMD} --format json --limit 2`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const events = JSON.parse(result);
      expect(events.length).toBeLessThanOrEqual(2);
    });

    it('should support eventName filter', () => {
      const result = execSync(`${CLI_CMD} --format json --eventName "test.integration.event"`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const events = JSON.parse(result);
      if (events.length > 0) {
        events.forEach(event => {
          expect(event.event_name).toBe('test.integration.event');
        });
      }
    });
  });

  describe('text output', () => {
    it('should display events in table format', () => {
      const result = execSync(`${CLI_CMD} --limit 3`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result).toContain('Events');
      expect(result).toContain('ID');
      expect(result).toContain('Event Name');
      expect(result).toContain('Source');
      expect(result).toContain('Emitted At');
    });

    it('should handle empty results gracefully', () => {
      const result = execSync(`${CLI_CMD} --eventName "nonexistent.event.name"`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result).toContain('No events found');
    });
  });

  describe('validation', () => {
    it('should validate limit parameter', () => {
      expect(() => {
        execSync(`${CLI_CMD} --limit -1`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should validate limit maximum', () => {
      expect(() => {
        execSync(`${CLI_CMD} --limit 2000`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid format gracefully', () => {
      expect(() => {
        execSync(`${CLI_CMD} --format invalid`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });
  });
});