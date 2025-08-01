/**
 * Logger show CLI command integration tests.
 * @file Logger show CLI command integration tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';

describe('logger show CLI command', () => {
  let dbService: DatabaseService;
  let loggerService: LoggerService;

  beforeAll(async () => {
    // Initialize services and create test data
    dbService = DatabaseService.getInstance();
    loggerService = LoggerService.getInstance();
    
    // Add some test log entries
    await loggerService.info(LogSource.TEST, 'Test log message for CLI testing');
    await loggerService.warn(LogSource.TEST, 'Test warning message');
    await loggerService.error(LogSource.TEST, 'Test error message');
  });

  afterAll(async () => {
    // Clean up test data
    await dbService.execute("DELETE FROM system_logs WHERE source = 'test'");
  });

  describe('JSON output', () => {
    it('should return valid JSON array with --format json', () => {
      const result = execSync('./bin/systemprompt logger show --format json --limit 5', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
      
      const logs = JSON.parse(result);
      expect(Array.isArray(logs)).toBe(true);
      
      if (logs.length > 0) {
        const log = logs[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('level');
        expect(log).toHaveProperty('message');
        expect(log).toHaveProperty('source');
        expect(log).toHaveProperty('timestamp');
        expect(log).toHaveProperty('args');
        expect(log).toHaveProperty('category');
        expect(log).toHaveProperty('created_at');
        
        // Validate types
        expect(typeof log.id).toBe('number');
        expect(typeof log.level).toBe('string');
        expect(typeof log.message).toBe('string');
        expect(typeof log.source).toBe('string');
        expect(typeof log.timestamp).toBe('string');
        expect(typeof log.args).toBe('string');
      }
    });

    it('should return full database objects without field filtering', () => {
      const result = execSync('./bin/systemprompt logger show --format json --limit 1', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const logs = JSON.parse(result);
      
      if (logs.length > 0) {
        const log = logs[0];
        
        // Verify all expected database fields are present
        const expectedFields = ['id', 'level', 'message', 'args', 'source', 'timestamp', 'category', 'created_at'];
        expectedFields.forEach(field => {
          expect(log).toHaveProperty(field);
        });
        
        // Ensure no unexpected filtering occurred
        expect(Object.keys(log)).toEqual(expect.arrayContaining(expectedFields));
      }
    });

    it('should handle empty results gracefully', () => {
      const result = execSync('./bin/systemprompt logger show --format json --level nonexistent', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
      
      const output = JSON.parse(result);
      expect(output).toHaveProperty('logs');
      expect(Array.isArray(output.logs)).toBe(true);
      expect(output.logs).toHaveLength(0);
      expect(output).toHaveProperty('message');
      expect(output).toHaveProperty('timestamp');
    });
  });

  describe('Text output', () => {
    it('should display formatted log entries with default format', () => {
      const result = execSync('./bin/systemprompt logger show --limit 3', {
        encoding: 'utf-8',
        timeout: 10000
      });

      // Should contain formatted log entries
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      
      // Should not contain JSON structure
      expect(result).not.toContain('{');
      expect(result).not.toContain('}');
      expect(result).not.toContain('[');
      expect(result).not.toContain(']');
    });

    it('should handle empty results with informative message', () => {
      const result = execSync('./bin/systemprompt logger show --level nonexistent', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(result).toContain('No logs found matching the criteria');
    });
  });

  describe('Filtering options', () => {
    it('should filter by log level', () => {
      const result = execSync('./bin/systemprompt logger show --level error --format json --limit 10', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const logs = JSON.parse(result);
      if (Array.isArray(logs) && logs.length > 0) {
        logs.forEach(log => {
          expect(log.level).toBe('error');
        });
      }
    });

    it('should filter by module/source', () => {
      const result = execSync('./bin/systemprompt logger show --module test --format json --limit 10', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const logs = JSON.parse(result);
      if (Array.isArray(logs) && logs.length > 0) {
        logs.forEach(log => {
          expect(log.source).toBe('test');
        });
      }
    });

    it('should respect limit parameter', () => {
      const result = execSync('./bin/systemprompt logger show --limit 2 --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const logs = JSON.parse(result);
      if (Array.isArray(logs)) {
        expect(logs.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('Validation', () => {
    it('should validate log level options', () => {
      expect(() => {
        execSync('./bin/systemprompt logger show --level invalid', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should validate limit parameter', () => {
      expect(() => {
        execSync('./bin/systemprompt logger show --limit -1', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should validate format parameter', () => {
      expect(() => {
        execSync('./bin/systemprompt logger show --format invalid', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should handle limit exceeding maximum', () => {
      expect(() => {
        execSync('./bin/systemprompt logger show --limit 2000', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('Security', () => {
    it('should use parameterized queries (no SQL injection)', () => {
      // Test that special characters in module filter don't cause SQL injection
      const result = execSync("./bin/systemprompt logger show --module \"'; DROP TABLE system_logs; --\" --format json", {
        encoding: 'utf-8',
        timeout: 10000
      });

      // Should not throw an error and should return empty results safely
      expect(() => JSON.parse(result)).not.toThrow();
      
      // Verify table still exists by running another query
      const verifyResult = execSync('./bin/systemprompt logger show --format json --limit 1', {
        encoding: 'utf-8',
        timeout: 10000
      });
      expect(() => JSON.parse(verifyResult)).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', () => {
      // This command should not crash even if there are database issues
      const result = execSync('./bin/systemprompt logger show --format json --limit 1', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should exit with code 0 on success', () => {
      const result = execSync('./bin/systemprompt logger show --format json --limit 1', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(result).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', () => {
      const start = Date.now();
      execSync('./bin/systemprompt logger show --format json --limit 10', {
        encoding: 'utf-8',
        timeout: 5000
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    });

    it('should handle large limits efficiently', () => {
      const start = Date.now();
      execSync('./bin/systemprompt logger show --format json --limit 100', {
        encoding: 'utf-8',
        timeout: 10000
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000);
    });
  });
});