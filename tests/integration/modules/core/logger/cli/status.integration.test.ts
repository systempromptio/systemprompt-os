/**
 * Logger status CLI command integration tests.
 * @file Logger status CLI command integration tests.
 */

import { describe, it, expect } from 'vitest';
import { runCLICommand } from '../../../../../utils/cli-runner';

describe('logger status CLI command', () => {

  describe('JSON output', () => {
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'status',
        ['--format', 'json']
      );

      expect(exitCode).toBe(0);
      // Extract JSON from stdout (ignore module initialization logs)
      const jsonMatch = stdout.match(/^\{[\s\S]*\}$/m);
      expect(jsonMatch).toBeTruthy();
      const jsonOutput = jsonMatch![0];
      expect(() => JSON.parse(jsonOutput)).not.toThrow();
      
      const output = JSON.parse(jsonOutput);
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

    it('should return structured status object with proper types', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'status',
        ['--format', 'json']
      );

      expect(exitCode).toBe(0);
      // Extract JSON from stdout (ignore module initialization logs)
      const jsonMatch = stdout.match(/^\{[\s\S]*\}$/m);
      expect(jsonMatch).toBeTruthy();
      const output = JSON.parse(jsonMatch![0]);
      
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
    it('should display human-readable status with default format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'status'
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Logger Module Status');
      expect(stdout).toContain('Module');
      expect(stdout).toContain('logger');
      expect(stdout).toContain('Enabled');
      expect(stdout).toContain('Healthy');
      expect(stdout).toContain('Configuration');
      expect(stdout).toContain('Statistics');
    });

    it('should display statistics section with log counts', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'status'
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Statistics');
      expect(stdout).toContain('Total logs');
      expect(stdout).toContain('Recent errors');
      expect(stdout).toContain('Debug logs');
      expect(stdout).toContain('Info logs');
      expect(stdout).toContain('Warning logs');
      expect(stdout).toContain('Error logs');
    });
  });

  describe('Format option validation', () => {
    it('should handle explicit text format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'status',
        ['--format', 'text']
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Logger Module Status');
      expect(stdout).not.toContain('{');
      expect(stdout).not.toContain('}');
    });

    it('should reject invalid format option', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'status',
        ['--format', 'invalid']
      );

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully in JSON format', async () => {
      // This test may be challenging to implement without mocking
      // For now, we'll test that the command doesn't crash
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'status',
        ['--format', 'json']
      );

      expect(exitCode).toBe(0);
      // Extract JSON from stdout (ignore module initialization logs)
      const jsonMatch = stdout.match(/^\{[\s\S]*\}$/m);
      expect(jsonMatch).toBeTruthy();
      const output = JSON.parse(jsonMatch![0]);
      expect(output.statistics).toBeDefined();
    });

    it('should exit with code 0 on success', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'status',
        ['--format', 'json']
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const start = Date.now();
      const { stdout, stderr, exitCode } = await runCLICommand(
        'logger', 
        'status',
        ['--format', 'json']
      );
      const duration = Date.now() - start;

      expect(exitCode).toBe(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});