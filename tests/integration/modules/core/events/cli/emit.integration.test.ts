/**
 * Integration tests for events emit CLI command
 */

import { describe, it, expect } from '@jest/globals';
import { execSync } from 'child_process';

describe('events emit CLI command', () => {
  const CLI_CMD = './bin/systemprompt events emit';

  describe('JSON output', () => {
    it('should return valid JSON with --format json', () => {
      const result = execSync(`${CLI_CMD} --eventName "test.emit.json" --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
      const data = JSON.parse(result);
      expect(data.success).toBe(true);
    });

    it('should include event details in JSON response', () => {
      const eventName = 'test.emit.details';
      const testData = '{"test": "data", "number": 42}';
      
      const result = execSync(`${CLI_CMD} --eventName "${eventName}" --data '${testData}' --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('event_name', eventName);
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('source', 'cli');
      expect(response).toHaveProperty('emitted_at');
      expect(response).toHaveProperty('listeners');
      expect(response.data).toEqual({ test: 'data', number: 42 });
    });

    it('should handle string data correctly', () => {
      const result = execSync(`${CLI_CMD} --eventName "test.emit.string" --data "simple string" --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.data).toEqual({ message: 'simple string' });
    });

    it('should handle empty data correctly', () => {
      const result = execSync(`${CLI_CMD} --eventName "test.emit.empty" --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.data).toEqual({});
    });

    it('should support custom source', () => {
      const result = execSync(`${CLI_CMD} --eventName "test.emit.source" --source "integration-test" --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.source).toBe('integration-test');
    });
  });

  describe('text output', () => {
    it('should display success message and details', () => {
      const result = execSync(`${CLI_CMD} --eventName "test.emit.text"`, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result).toContain('Event \'test.emit.text\' emitted successfully');
      expect(result).toContain('Event Name');
      expect(result).toContain('Source');
      expect(result).toContain('Listeners');
      expect(result).toContain('Data');
      expect(result).toContain('Emitted At');
    });
  });

  describe('validation', () => {
    it('should require eventName parameter', () => {
      expect(() => {
        execSync(`${CLI_CMD} --format json`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should validate eventName is not empty', () => {
      expect(() => {
        execSync(`${CLI_CMD} --eventName "" --format json`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('data parsing', () => {
    it('should handle valid JSON data', () => {
      const jsonData = '{"key": "value", "number": 123, "boolean": true}';
      const result = execSync(`${CLI_CMD} --eventName "test.emit.json.data" --data '${jsonData}' --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.data).toEqual({ 
        key: 'value', 
        number: 123, 
        boolean: true 
      });
    });

    it('should fallback to string wrapper for invalid JSON', () => {
      const invalidJson = '{invalid json}';
      const result = execSync(`${CLI_CMD} --eventName "test.emit.invalid.json" --data "${invalidJson}" --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const response = JSON.parse(result);
      expect(response.data).toEqual({ message: invalidJson });
    });
  });

  describe('error handling', () => {
    it('should handle invalid format gracefully', () => {
      expect(() => {
        execSync(`${CLI_CMD} --eventName "test.emit.invalid" --format invalid`, {
          encoding: 'utf8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('event persistence', () => {
    it('should persist emitted events to database', async () => {
      const eventName = 'test.emit.persistence';
      
      // Emit an event
      execSync(`${CLI_CMD} --eventName "${eventName}" --data '{"persisted": true}' --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      // Verify it appears in the list
      const listResult = execSync(`./bin/systemprompt events list --eventName "${eventName}" --format json`, {
        encoding: 'utf8',
        timeout: 10000
      });

      const events = JSON.parse(listResult);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event_name).toBe(eventName);
    });
  });
});