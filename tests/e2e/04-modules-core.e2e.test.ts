import { describe, it, expect } from 'vitest';
import { execInContainer, getTestBaseUrl } from './bootstrap.js';

/**
 * Modules Core Domain E2E Tests
 * 
 * Tests the critical functionality of core modules including:
 * - Module loader and registry
 * - Heartbeat module
 * - Logger module
 * - System module
 * - Module lifecycle management
 */
describe('[04] Modules Core Domain', () => {
  const baseUrl = getTestBaseUrl();
  describe('Module Loader', () => {
    it('should load core modules successfully', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.modules).toBeDefined();
      expect(status.modules.loaded).toBeDefined();
      expect(Array.isArray(status.modules.loaded)).toBe(true);
    });

    it('should register heartbeat module', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.modules.loaded).toContain('core/heartbeat');
    });

    it('should register logger module', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.modules.loaded).toContain('core/logger');
    });

    it('should register system module', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.modules.loaded).toContain('core/system');
    });
  });

  describe('Heartbeat Module', () => {
    it('should have active heartbeat', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt heartbeat:status');
      expect(stdout).toContain('Heartbeat Status');
      expect(stdout).toContain('Active: true');
    });

    it('should show heartbeat interval', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt heartbeat:status');
      expect(stdout).toContain('Interval:');
      expect(stdout).toMatch(/Interval:\s+\d+s/);
    });

    it('should show last heartbeat time', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt heartbeat:status');
      expect(stdout).toContain('Last beat:');
    });

    it('should reset heartbeat successfully', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt heartbeat:reset');
      expect(stdout).toContain('Heartbeat reset successfully');
    });

    it('should emit heartbeat events', async () => {
      // Wait for a heartbeat cycle
      await new Promise(resolve => setTimeout(resolve, 2000));
      const { stdout } = await execInContainer('tail -n 50 /app/logs/app.log | grep -i heartbeat');
      expect(stdout).toContain('heartbeat');
    });
  });

  describe('Logger Module', () => {
    it('should initialize logger with correct configuration', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.logging).toBeDefined();
      expect(status.logging.level).toBe('debug'); // Based on TEST_CONFIG
    });

    it('should create log files', async () => {
      const { stdout } = await execInContainer('ls -la /app/logs/');
      expect(stdout).toContain('app.log');
    });

    it('should log to appropriate levels', async () => {
      const { stdout: debugLog } = await execInContainer('grep -i "debug" /app/logs/app.log | head -1');
      const { stdout: infoLog } = await execInContainer('grep -i "info" /app/logs/app.log | head -1');
      const { stdout: warnLog } = await execInContainer('grep -i "warn" /app/logs/app.log | head -1');
      
      expect(debugLog).toBeTruthy();
      expect(infoLog).toBeTruthy();
      // Warn logs might not exist if everything is running smoothly
    });

    it('should format logs correctly', async () => {
      const { stdout } = await execInContainer('tail -n 1 /app/logs/app.log');
      // Check for timestamp pattern
      expect(stdout).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Check for log level
      expect(stdout).toMatch(/\[(DEBUG|INFO|WARN|ERROR)\]/);
    });
  });

  describe('System Module', () => {
    it('should provide system information', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.system).toBeDefined();
      expect(status.system.platform).toBeDefined();
      expect(status.system.arch).toBeDefined();
      expect(status.system.nodeVersion).toBeDefined();
    });

    it('should track memory usage', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.system.memory).toBeDefined();
      expect(status.system.memory.total).toBeGreaterThan(0);
      expect(status.system.memory.free).toBeGreaterThan(0);
      expect(status.system.memory.used).toBeGreaterThan(0);
    });

    it('should track CPU usage', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.system.cpu).toBeDefined();
      expect(status.system.cpu.count).toBeGreaterThan(0);
      expect(status.system.cpu.usage).toBeDefined();
    });

    it('should provide uptime information', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.server.uptime).toBeDefined();
      expect(status.server.uptime).toBeGreaterThan(0);
    });
  });

  describe('Module Registry', () => {
    it('should maintain module registry', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      expect(status.modules.registry).toBeDefined();
      expect(Object.keys(status.modules.registry).length).toBeGreaterThan(0);
    });

    it('should track module versions', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      const heartbeatModule = status.modules.registry['core/heartbeat'];
      expect(heartbeatModule).toBeDefined();
      expect(heartbeatModule.version).toBeDefined();
      expect(heartbeatModule.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should track module status', async () => {
      const { stdout } = await execInContainer('curl -s ${baseUrl}/api/status');
      const status = JSON.parse(stdout);
      Object.values(status.modules.registry).forEach((module: any) => {
        expect(module.status).toBe('active');
      });
    });
  });

  describe('Module CLI Commands', () => {
    it('should list available module commands', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt --help');
      expect(stdout).toContain('heartbeat:status');
      expect(stdout).toContain('heartbeat:reset');
    });

    it('should execute module commands with proper output', async () => {
      const { stdout } = await execInContainer('/app/bin/systemprompt heartbeat:status --json');
      const heartbeatStatus = JSON.parse(stdout);
      expect(heartbeatStatus).toHaveProperty('active');
      expect(heartbeatStatus).toHaveProperty('interval');
      expect(heartbeatStatus).toHaveProperty('lastBeat');
    });
  });

  describe('Module Error Handling', () => {
    it('should handle invalid module commands gracefully', async () => {
      try {
        await execInContainer('/app/bin/systemprompt invalid:command');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Unknown command');
      }
    });

    it('should continue running if a module fails', async () => {
      // Server should still be healthy even if a module has issues
      const { stdout } = await execInContainer('curl -s ${baseUrl}/health');
      const health = JSON.parse(stdout);
      expect(health.status).toBe('ok');
    });
  });
});