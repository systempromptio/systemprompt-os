import { describe, it, expect } from 'vitest';
import { execInContainer, TEST_CONFIG } from './bootstrap.js';

/**
 * Tools CLI Domain E2E Tests
 * 
 * Tests the critical functionality of the CLI tools domain including:
 * - CLI command execution
 * - Configuration management
 * - Key generation
 * - Service control (start/stop/status)
 */
describe('[00] Tools CLI Domain', () => {
  describe('CLI Basic Commands', () => {
    it('should show help information', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt --help');
      expect(stdout).toContain('SystemPrompt CLI');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('start');
      expect(stdout).toContain('stop');
      expect(stdout).toContain('status');
      expect(stdout).toContain('config');
      expect(stdout).toContain('test');
    });

    it('should show version information', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt --version');
      expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Semantic version pattern
    });
  });

  describe('Configuration Management', () => {
    it('should get configuration values', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt config get PORT');
      expect(stdout).toContain('3000');
    });

    it('should list all configuration values', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt config list');
      expect(stdout).toContain('PORT');
      expect(stdout).toContain('NODE_ENV');
      expect(stdout).toContain('test');
    });
  });

  describe('Key Generation', () => {
    it('should generate a new JWT key', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt generatekey');
      expect(stdout).toContain('Generated JWT key:');
      expect(stdout).toMatch(/[A-Za-z0-9+/=]{32,}/); // Base64 pattern
    });

    it('should generate keys of specified length', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt generatekey --length 64');
      expect(stdout).toContain('Generated JWT key:');
      const keyMatch = stdout.match(/Generated JWT key:\s+([A-Za-z0-9+/=]+)/);
      expect(keyMatch).toBeTruthy();
      expect(keyMatch![1].length).toBeGreaterThanOrEqual(64);
    });
  });

  describe('Service Status', () => {
    it('should show service status', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt status');
      expect(stdout).toContain('SystemPrompt Status');
      expect(stdout).toContain('Server: Running');
      expect(stdout).toContain('MCP Server: Available');
    });

    it('should show detailed status with --verbose flag', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt status --verbose');
      expect(stdout).toContain('SystemPrompt Status');
      expect(stdout).toContain('Server: Running');
      expect(stdout).toContain('Uptime:');
      expect(stdout).toContain('Memory Usage:');
      expect(stdout).toContain('CPU Usage:');
    });
  });

  describe('Test Command', () => {
    it('should show test command options', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt test --help');
      expect(stdout).toContain('Run tests');
      expect(stdout).toContain('--unit');
      expect(stdout).toContain('--e2e');
      expect(stdout).toContain('--all');
      expect(stdout).toContain('--watch');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      try {
        await execInContainer('/app/bin/systemprompt invalid-command');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Unknown command');
      }
    });

    it('should handle missing required arguments', async () => {
      try {
        await execInContainer('/app/bin/systemprompt config get');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Missing required argument');
      }
    });
  });
});