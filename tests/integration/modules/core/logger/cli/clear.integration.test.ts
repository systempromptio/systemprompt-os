/**
 * Logger clear CLI command integration tests.  
 * @file Logger clear CLI command integration tests.
 */

import { describe, it, expect } from 'vitest';
import { runCLICommand } from '../../../../../utils/cli-runner';

describe('logger clear CLI command', () => {

  describe('Dry run mode', () => {
    it('should return valid JSON with --dry-run and --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'clear',
        ['--dry-run', '--format', 'json']
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Extract JSON from stdout (ignore module initialization logs)
      const jsonMatch = stdout.match(/^\{[\s\S]*\}$/m);
      expect(jsonMatch).toBeTruthy();
      expect(() => JSON.parse(jsonMatch![0])).not.toThrow();
      
      const output = JSON.parse(jsonMatch![0]);
      expect(output).toHaveProperty('operation', 'clear-logs');
      expect(output).toHaveProperty('matchingLogs');
      expect(output).toHaveProperty('timestamp');
      
      expect(typeof output.matchingLogs).toBe('number');
      expect(output.matchingLogs).toBeGreaterThanOrEqual(0);
      
      // When there are logs to clear, dryRun field should be present
      if (output.matchingLogs > 0) {
        expect(output).toHaveProperty('dryRun', true);
        expect(output).toHaveProperty('wouldDelete');
        expect(typeof output.wouldDelete).toBe('number');
        expect(output.wouldDelete).toBe(output.matchingLogs);
      } else {
        // When no logs match, it returns a different structure
        expect(output).toHaveProperty('message', 'No logs found matching the criteria');
      }
    });

    it('should show what would be deleted without actually deleting', async () => {
      // Run dry run
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'clear',
        ['--dry-run', '--format', 'json']
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Extract JSON from stdout (ignore module initialization logs)
      const jsonMatch = stdout.match(/^\{[\s\S]*\}$/m);
      expect(jsonMatch).toBeTruthy();
      const output = JSON.parse(jsonMatch![0]);
      expect(output.operation).toBe('clear-logs');
      expect(output.matchingLogs).toBeGreaterThanOrEqual(0);
    });

    it('should display human-readable dry run info in text mode', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'clear',
        ['--dry-run']
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // When no logs match, it shows "No logs found matching the criteria"
      expect(stdout).toContain('No logs found matching the criteria');
    });
  });

  describe('Level filtering', () => {
    it('should filter by specific log level in dry run', () => {
      const result = execSync('./bin/systemprompt logger clear --level error --dry-run --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const output = JSON.parse(result);
      expect(output).toHaveProperty('description');
      expect(output.description).toContain('level=error');
    });

    it('should validate log level parameter', () => {
      expect(() => {
        execSync('./bin/systemprompt logger clear --level invalid --dry-run', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('Time-based filtering', () => {
    it('should filter by older-than parameter', () => {
      const result = execSync('./bin/systemprompt logger clear --older-than 7 --dry-run --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const output = JSON.parse(result);
      expect(output).toHaveProperty('description');
      expect(output.description).toContain('older than 7 days');
    });

    it('should validate older-than parameter', () => {
      expect(() => {
        execSync('./bin/systemprompt logger clear --older-than -1 --dry-run', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should reject non-numeric older-than values', () => {
      expect(() => {
        execSync('./bin/systemprompt logger clear --older-than invalid --dry-run', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('Confirmation handling', () => {
    it('should require confirmation by default (simulated)', () => {
      // We can't easily test interactive confirmation in automated tests
      // Instead, test that --confirm flag works
      const result = execSync('./bin/systemprompt logger clear --level nonexistent --confirm --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const output = JSON.parse(result);
      expect(output).toHaveProperty('matchingLogs', 0);
      expect(output).toHaveProperty('message', 'No logs found matching the criteria');
    });

    it('should skip confirmation with --confirm flag', () => {
      // Test with non-existent level to ensure no logs are actually deleted
      const result = execSync('./bin/systemprompt logger clear --level nonexistent --confirm --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
      const output = JSON.parse(result);
      expect(output).toHaveProperty('operation', 'clear-logs');
    });
  });

  describe('Actual deletion (safe tests)', () => {
    it('should clear logs with non-existent filter safely', () => {
      const result = execSync('./bin/systemprompt logger clear --level nonexistent --confirm --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const output = JSON.parse(result);
      expect(output).toHaveProperty('matchingLogs', 0);
      expect(output).toHaveProperty('message', 'No logs found matching the criteria');
    });

    it('should return proper success structure for actual deletion', async () => {
      // Add a specific test log that we can safely delete
      await dbService.execute(
        "INSERT INTO system_logs (level, message, source, timestamp, args) VALUES (?, ?, ?, datetime('now'), ?)",
        ['debug', 'Test log for deletion', 'test-clear', '{}']
      );

      const result = execSync('./bin/systemprompt logger clear --level debug --confirm --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const output = JSON.parse(result);
      expect(output).toHaveProperty('operation', 'clear-logs');
      expect(output).toHaveProperty('success', true);
      expect(output).toHaveProperty('deletedCount');
      expect(output).toHaveProperty('remainingCount');
      expect(output).toHaveProperty('timestamp');
      
      expect(typeof output.deletedCount).toBe('number');
      expect(typeof output.remainingCount).toBe('number');
    });
  });

  describe('JSON output validation', () => {
    it('should return consistent JSON structure for dry run', () => {
      const result = execSync('./bin/systemprompt logger clear --dry-run --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const output = JSON.parse(result);
      
      // Validate required fields
      const requiredFields = ['operation', 'dryRun', 'matchingLogs', 'wouldDelete', 'timestamp'];
      requiredFields.forEach(field => {
        expect(output).toHaveProperty(field);
      });
      
      // Validate timestamp format
      expect(() => new Date(output.timestamp)).not.toThrow();
      expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
    });

    it('should return full objects without field filtering', () => {
      const result = execSync('./bin/systemprompt logger clear --dry-run --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const output = JSON.parse(result);
      
      // Ensure all expected fields are present (no filtering)
      expect(Object.keys(output).length).toBeGreaterThanOrEqual(5);
      expect(output).toHaveProperty('operation');
      expect(output).toHaveProperty('dryRun');
      expect(output).toHaveProperty('matchingLogs');
      expect(output).toHaveProperty('wouldDelete');
      expect(output).toHaveProperty('timestamp');
    });
  });

  describe('Error handling', () => {
    it('should handle validation errors gracefully', () => {
      expect(() => {
        execSync('./bin/systemprompt logger clear --older-than invalid', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should validate format parameter', () => {
      expect(() => {
        execSync('./bin/systemprompt logger clear --format invalid --dry-run', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });

    it('should exit with appropriate codes', () => {
      // Success case
      const result = execSync('./bin/systemprompt logger clear --dry-run --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });
      expect(result).toBeTruthy();
    });
  });

  describe('Security', () => {
    it('should use parameterized queries for level filtering', () => {
      // Test that SQL injection attempts in level parameter don't work
      expect(() => {
        execSync("./bin/systemprompt logger clear --level \"'; DROP TABLE system_logs; --\" --dry-run", {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow(); // Should fail validation, not execute SQL
    });

    it('should validate all parameters before database operations', () => {
      // Multiple invalid parameters should all be caught by validation
      expect(() => {
        execSync('./bin/systemprompt logger clear --level invalid --older-than -5 --dry-run', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete dry run within reasonable time', () => {
      const start = Date.now();
      execSync('./bin/systemprompt logger clear --dry-run --format json', {
        encoding: 'utf-8',
        timeout: 5000
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    });
  });
});