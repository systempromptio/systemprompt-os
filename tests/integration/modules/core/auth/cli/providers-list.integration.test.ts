/**
 * Integration tests for auth providers list CLI command.
 * @file Tests auth providers list command functionality.
 */

import { runCLICommand } from '@/tests/utils/cli-runner';
import { describe, it, expect } from '@jest/globals';

describe('auth providers:list CLI command', () => {
  describe('Execution', () => {
    it('should execute successfully with default format', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'providers:list'
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('OAuth Providers');
    });
    
    it('should return valid JSON with --format json', async () => {
      const { stdout, stderr, exitCode } = await runCLICommand(
        'auth', 
        'providers:list',
        ['--format', 'json']
      );
      
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      
      expect(() => JSON.parse(stdout)).not.toThrow();
      const data = JSON.parse(stdout);
      
      expect(data).toHaveProperty('providers');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('timestamp');
      expect(Array.isArray(data.providers)).toBe(true);
      expect(typeof data.total).toBe('number');
    });
  });
  
  describe('Validation', () => {
    it('should handle invalid format option', async () => {
      const { stderr, exitCode } = await runCLICommand(
        'auth', 
        'providers:list',
        ['--format', 'invalid']
      );
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid arguments');
    });
  });
  
  describe('Output Structure', () => {
    it('should have consistent JSON structure', async () => {
      const { stdout } = await runCLICommand(
        'auth', 
        'providers:list',
        ['--format', 'json']
      );
      
      const data = JSON.parse(stdout);
      
      expect(typeof data.total).toBe('number');
      expect(new Date(data.timestamp)).toBeInstanceOf(Date);
      
      // If providers exist, check their structure
      if (data.providers.length > 0) {
        const provider = data.providers[0];
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('type');
        expect(provider).toHaveProperty('enabled');
        expect(typeof provider.id).toBe('string');
        expect(typeof provider.name).toBe('string');
        expect(typeof provider.type).toBe('string');
        expect(typeof provider.enabled).toBe('boolean');
      }
    });
  });
});