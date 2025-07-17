import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeartbeatModule } from '../../index.js';
import { ModuleRegistry } from '../../../../registry.js';
import { readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('Heartbeat Module - Integration Tests', () => {
  let heartbeat: HeartbeatModule;
  let registry: ModuleRegistry;
  const testOutputPath = './test-state/heartbeat.json';
  
  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  afterEach(async () => {
    if (heartbeat && heartbeat.isRunning()) {
      await heartbeat.stop();
    }
    // Clean up test files
    if (existsSync(testOutputPath)) {
      rmSync(testOutputPath, { force: true });
    }
    if (existsSync('./test-state')) {
      rmSync('./test-state', { recursive: true, force: true });
    }
  });

  describe('Module Registry Integration', () => {
    it('should register with module registry', async () => {
      heartbeat = new HeartbeatModule({
        interval: '1s',
        outputPath: testOutputPath,
        autoStart: false,
        includeMetrics: ['timestamp', 'status']
      });

      await registry.register(heartbeat);
      
      const retrieved = registry.get('heartbeat');
      expect(retrieved).toBe(heartbeat);
      expect(retrieved.type).toBe('daemon');
    });

    it('should be retrievable by type', async () => {
      heartbeat = new HeartbeatModule({
        interval: '1s',
        outputPath: testOutputPath,
        autoStart: false,
        includeMetrics: ['timestamp', 'status']
      });

      await registry.register(heartbeat);
      
      const daemons = registry.getByType('daemon');
      expect(daemons).toContain(heartbeat);
    });
  });

  describe('File System Integration', () => {
    it('should write actual file to disk', async () => {
      heartbeat = new HeartbeatModule({
        interval: '1s',
        outputPath: testOutputPath,
        autoStart: false,
        includeMetrics: ['timestamp', 'status', 'uptime']
      });

      await heartbeat.start();
      
      // Wait a bit for file write
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(existsSync(testOutputPath)).toBe(true);
      
      const content = readFileSync(testOutputPath, 'utf-8');
      const status = JSON.parse(content);
      
      expect(status).toHaveProperty('timestamp');
      expect(status).toHaveProperty('status', 'healthy');
      expect(status).toHaveProperty('uptime');
    });

    it('should update file periodically', async () => {
      heartbeat = new HeartbeatModule({
        interval: '100ms', // Fast interval for testing
        outputPath: testOutputPath,
        autoStart: false,
        includeMetrics: ['timestamp', 'status']
      });

      await heartbeat.start();
      
      // Wait for initial write
      await new Promise(resolve => setTimeout(resolve, 50));
      const content1 = readFileSync(testOutputPath, 'utf-8');
      const status1 = JSON.parse(content1);
      
      // Wait for next write
      await new Promise(resolve => setTimeout(resolve, 150));
      const content2 = readFileSync(testOutputPath, 'utf-8');
      const status2 = JSON.parse(content2);
      
      // Timestamps should be different
      expect(status2.timestamp).not.toBe(status1.timestamp);
    });

    it('should create nested directories', async () => {
      const nestedPath = './test-state/nested/deep/heartbeat.json';
      
      heartbeat = new HeartbeatModule({
        interval: '1s',
        outputPath: nestedPath,
        autoStart: false,
        includeMetrics: ['timestamp', 'status']
      });

      await heartbeat.start();
      
      // Wait for file write
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(existsSync(nestedPath)).toBe(true);
      
      // Clean up
      rmSync('./test-state/nested', { recursive: true, force: true });
    });
  });

  describe('System Metrics Integration', () => {
    it('should include real system metrics', async () => {
      heartbeat = new HeartbeatModule({
        interval: '1s',
        outputPath: testOutputPath,
        autoStart: false,
        includeMetrics: ['timestamp', 'status', 'memory', 'cpu', 'uptime']
      });

      await heartbeat.start();
      
      // Wait for file write
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const content = readFileSync(testOutputPath, 'utf-8');
      const status = JSON.parse(content);
      
      // Check memory metrics
      expect(status.memory).toBeDefined();
      expect(status.memory.used).toBeGreaterThan(0);
      expect(status.memory.total).toBeGreaterThan(0);
      expect(status.memory.percentage).toBeGreaterThan(0);
      expect(status.memory.percentage).toBeLessThanOrEqual(100);
      
      // Check CPU metrics
      expect(status.cpu).toBeDefined();
      expect(status.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(status.cpu.loadAverage).toBeDefined();
      expect(Array.isArray(status.cpu.loadAverage)).toBe(true);
      
      // Check uptime
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Recovery', () => {
    it('should continue running after write error', async () => {
      const invalidPath = '/root/forbidden/heartbeat.json'; // Likely to fail
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      heartbeat = new HeartbeatModule({
        interval: '100ms',
        outputPath: invalidPath,
        autoStart: false,
        includeMetrics: ['timestamp', 'status']
      });

      await heartbeat.start();
      
      // Wait for multiple write attempts
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Should still be running despite errors
      expect(heartbeat.isRunning()).toBe(true);
      
      // Should have logged errors
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required config fields', () => {
      expect(() => {
        new HeartbeatModule({} as any);
      }).toThrow();
    });

    it('should use default values for optional fields', () => {
      heartbeat = new HeartbeatModule({
        interval: '30s',
        outputPath: testOutputPath
      });

      expect(heartbeat.config.autoStart).toBe(false);
      expect(heartbeat.config.includeMetrics).toEqual([
        'timestamp',
        'status',
        'uptime',
        'memory',
        'cpu',
        'version'
      ]);
    });
  });
});