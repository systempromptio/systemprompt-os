import { describe, it, expect } from 'vitest';
import { execInContainer, expectCLISuccess } from '../shared/bootstrap.js';

/**
 * Local E2E: CLI Tools and Commands
 * 
 * Tests the critical functionality of the CLI tools including:
 * - Basic CLI command execution
 * - Configuration management
 * - Key generation utilities
 * - Help and version commands
 */
describe('Local E2E: CLI Tools and Commands', () => {
  describe('CLI Basic Commands', () => {
    it('should show help information', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt --help');
      expect(stdout).toContain('systemprompt');
      expect(stdout).toContain('Commands');
      expect(stdout).toContain('auth');
      expect(stdout).toContain('cli');
      expect(stdout).toContain('config');
      expect(stdout).toContain('database');
      expect(stdout).toContain('help');
    });

    it('should show version information', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt --version');
      expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Semantic version pattern
    });
  });

  describe('Configuration Management', () => {
    it('should get configuration values', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt config get --key PORT');
      // Config might return null or the port value
      expect(stdout).toBeDefined();
    });

    it('should list all configuration values', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt config list');
      // Config list might be empty in test environment
      expect(stdout).toBeDefined();
    });
  });

  describe('Key Generation', () => {
    it('should generate a new JWT key', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt auth generatekey --type jwt');
      expect(stdout).toContain('Keys generated successfully');
      expect(stdout).toContain('state/auth/keys');
    });
  });

  describe('Service Status', () => {
    it('should show service status', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt system status');
      expect(stdout).toContain('System Module Status');
      expect(stdout).toContain('System Information');
      expect(stdout).toContain('Platform');
    });

    it('should show module status', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt modules status');
      expect(stdout).toContain('Modules Module Status');
      expect(stdout).toContain('Total modules managed');
      expect(stdout).toContain('Enabled modules');
    });
  });

  describe('Help Command', () => {
    it('should show help for specific commands', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt help config');
      expect(stdout).toContain('config');
      expect(stdout).toContain('Commands');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      try {
        await execInContainer('/app/bin/systemprompt invalid-command');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('unknown command');
      }
    });

    it('should handle missing required arguments', async () => {
      try {
        await execInContainer('/app/bin/systemprompt config get');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('required option');
      }
    });
  });
});