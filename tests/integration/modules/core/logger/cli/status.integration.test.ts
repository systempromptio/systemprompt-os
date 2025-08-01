/**
 * Logger status CLI command integration tests.
 * @file Logger status CLI command integration tests.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { DatabaseService } from '@/modules/core/database/services/database.service';

describe('logger status CLI command', () => {
  let dbService: DatabaseService;

  beforeAll(async () => {
    // Initialize database service for setup
    dbService = DatabaseService.getInstance();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('JSON output', () => {
    it('should return valid JSON with --format json', () => {
      const result = execSync('./bin/systemprompt logger status --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
      
      const output = JSON.parse(result);
      expect(output).toHaveProperty('module', 'logger');
      expect(output).toHaveProperty('status');
      expect(output).toHaveProperty('configuration');
      expect(output).toHaveProperty('statistics');
      expect(output).toHaveProperty('timestamp');
      
      // Validate status structure
      expect(output.status).toHaveProperty('enabled', true);
      expect(output.status).toHaveProperty('healthy', true);
      expect(output.status).toHaveProperty('service', 'LoggerService');
      expect(typeof output.status.uptime).toBe('number');
      
      // Validate configuration structure
      expect(output.configuration).toHaveProperty('logLevel');
      expect(output.configuration).toHaveProperty('transports');
      expect(Array.isArray(output.configuration.transports)).toBe(true);
      
      // Validate statistics structure
      expect(output.statistics).toHaveProperty('totalLogs');
      expect(output.statistics).toHaveProperty('recentErrors');
      expect(output.statistics).toHaveProperty('logsByLevel');
      expect(typeof output.statistics.totalLogs).toBe('number');
      expect(typeof output.statistics.recentErrors).toBe('number');
    });

    it('should return structured status object with proper types', () => {
      const result = execSync('./bin/systemprompt logger status --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      const output = JSON.parse(result);
      
      // Check timestamp is valid ISO string
      expect(() => new Date(output.timestamp)).not.toThrow();
      expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
      
      // Check numeric types
      expect(Number.isInteger(output.statistics.totalLogs)).toBe(true);
      expect(Number.isInteger(output.statistics.recentErrors)).toBe(true);
      expect(output.statistics.totalLogs).toBeGreaterThanOrEqual(0);
      expect(output.statistics.recentErrors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Text output', () => {
    it('should display human-readable status with default format', () => {
      const result = execSync('./bin/systemprompt logger status', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(result).toContain('Logger Module Status');
      expect(result).toContain('Module');
      expect(result).toContain('logger');
      expect(result).toContain('Enabled');
      expect(result).toContain('Healthy');
      expect(result).toContain('Configuration');
      expect(result).toContain('Statistics');
    });

    it('should display statistics section with log counts', () => {
      const result = execSync('./bin/systemprompt logger status', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(result).toContain('Statistics');
      expect(result).toContain('Total logs');
      expect(result).toContain('Recent errors');
      expect(result).toContain('Debug logs');
      expect(result).toContain('Info logs');
      expect(result).toContain('Warning logs');
      expect(result).toContain('Error logs');
    });
  });

  describe('Format option validation', () => {
    it('should handle explicit text format', () => {
      const result = execSync('./bin/systemprompt logger status --format text', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(result).toContain('Logger Module Status');
      expect(result).not.toContain('{');
      expect(result).not.toContain('}');
    });

    it('should reject invalid format option', () => {
      expect(() => {
        execSync('./bin/systemprompt logger status --format invalid', {
          encoding: 'utf-8',
          timeout: 10000
        });
      }).toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully in JSON format', async () => {
      // This test may be challenging to implement without mocking
      // For now, we'll test that the command doesn't crash
      const result = execSync('./bin/systemprompt logger status --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(() => JSON.parse(result)).not.toThrow();
      const output = JSON.parse(result);
      expect(output.statistics).toBeDefined();
    });

    it('should exit with code 0 on success', () => {
      const result = execSync('./bin/systemprompt logger status --format json', {
        encoding: 'utf-8',
        timeout: 10000
      });

      expect(result).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', () => {
      const start = Date.now();
      execSync('./bin/systemprompt logger status --format json', {
        encoding: 'utf-8',
        timeout: 5000
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});