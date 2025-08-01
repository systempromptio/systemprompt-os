/**
 * Integration tests for events get CLI command
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { execSync } from 'child_process';

describe('events get CLI command', () => {
  const CLI_CMD = './bin/systemprompt events get';
  let testEventId: string;

  beforeAll(async () => {
    // Get an existing event ID for testing
    try {
      const listResult = execSync('./bin/systemprompt events list --format json --limit 1', {
        encoding: 'utf8',
        timeout: 10000
      });
      const events = JSON.parse(listResult);
      if (events.length > 0) {
        testEventId = events[0].id.toString();
      }
    } catch (error) {
      // If no events exist, create one
      execSync('./bin/systemprompt events emit --eventName "test.get.event" --data \'{"test": "data"}\' --format json', {
        encoding: 'utf8',
        timeout: 10000
      });
      
      const listResult = execSync('./bin/systemprompt events list --format json --limit 1', {
        encoding: 'utf8',
        timeout: 10000
      });
      const events = JSON.parse(listResult);
      testEventId = events[0].id.toString();
    }
  });

  describe('JSON output', () => {
    it('should return valid JSON with --format json', () => {
      if (!testEventId) {
        console.warn('No test event ID available, skipping test');
        return;
      }

      const result = execSync(`${CLI_CMD} --id ${testEventId} --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
      const data = JSON.parse(result);
      expect(typeof data).toBe('object');
    });

    it('should include all event fields in JSON output', () => {
      if (!testEventId) {
        console.warn('No test event ID available, skipping test');
        return;
      }

      const result = execSync(`${CLI_CMD} --id ${testEventId} --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const event = JSON.parse(result);
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('event_name');
      expect(event).toHaveProperty('emitted_at');
      expect(event).toHaveProperty('module_source');
      expect(event).toHaveProperty('created_at');
      expect(event).toHaveProperty('updated_at');
    });

    it('should return error for nonexistent event', () => {
      const result = execSync(`${CLI_CMD} --id 99999999 --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Event not found');
    });
  });

  describe('text output', () => {
    it('should display event details in readable format', () => {
      if (!testEventId) {
        console.warn('No test event ID available, skipping test');
        return;
      }

      const result = execSync(`${CLI_CMD} --id ${testEventId}`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result).toContain('Event Details');
      expect(result).toContain('ID');
      expect(result).toContain('Event Name');
      expect(result).toContain('Module Source');
      expect(result).toContain('Emitted At');
    });

    it('should show error message for nonexistent event', () => {
      const result = execSync(`${CLI_CMD} --id 99999999`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result).toContain('Event with ID \'99999999\' not found');
    });
  });

  describe('validation', () => {
    it('should require id parameter', () => {
      expect(() => {
        execSync(`${CLI_CMD} --format json`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should validate id is not empty', () => {
      expect(() => {
        execSync(`${CLI_CMD} --id "" --format json`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid format gracefully', () => {
      expect(() => {
        execSync(`${CLI_CMD} --id ${testEventId || '1'} --format invalid`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });
  });
});