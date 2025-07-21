import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatModule } from '../../../../../src/modules/core/heartbeat/index.js';
import { HeartbeatConfig, HeartbeatStatus } from '../../../../../src/modules/core/heartbeat/types.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

vi.mock('fs');

describe('Heartbeat Module', () => {
  let heartbeat: HeartbeatModule;
  const mockConfig: HeartbeatConfig = {
    interval: '1s',
    outputPath: './state/heartbeat.json',
    autoStart: false,
    includeMetrics: ['timestamp', 'status', 'uptime', 'memory', 'cpu', 'version']
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (heartbeat?.isRunning()) {
      heartbeat.stop();
    }
    vi.useRealTimers();
  });

  describe('Module behavior', () => {
    it.each([
      ['1s', 1000],
      ['30s', 30000],
      ['5m', 300000],
      ['invalid', 'error']
    ])('parses interval %s correctly', (interval, expected) => {
      if (expected === 'error') {
        expect(() => new HeartbeatModule({ ...mockConfig, interval })).toThrow('Invalid interval format');
      } else {
        heartbeat = new HeartbeatModule({ ...mockConfig, interval });
        expect(heartbeat.getIntervalMs()).toBe(expected);
      }
    });

    it('generates complete status with configurable metrics', () => {
      // Test with all metrics
      heartbeat = new HeartbeatModule(mockConfig);
      let status = heartbeat.generateStatus();
      
      expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(status.status).toBe('healthy');
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.memory).toMatchObject({
        used: expect.any(Number),
        total: expect.any(Number),
        percentage: expect.any(Number)
      });
      expect(status.cpu).toBeDefined();
      expect(status.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(status.cpu.loadAverage).toHaveLength(3);
      expect(status.version).toMatch(/^\d+\.\d+\.\d+/);

      // Test with partial metrics
      heartbeat = new HeartbeatModule({
        ...mockConfig,
        includeMetrics: ['timestamp', 'status']
      });
      status = heartbeat.generateStatus();
      
      expect(Object.keys(status)).toEqual(['timestamp', 'status']);
      
      // Test uptime calculation
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      heartbeat = new HeartbeatModule(mockConfig);
      vi.setSystemTime(startTime + 60000);
      status = heartbeat.generateStatus();
      expect(status.uptime).toBe(60);
    });

    it('handles file operations correctly', () => {
      const mockMkdir = vi.mocked(mkdirSync);
      const mockWrite = vi.mocked(writeFileSync);
      
      heartbeat = new HeartbeatModule(mockConfig);
      heartbeat.writeStatus();
      
      // Should create directory
      expect(mockMkdir).toHaveBeenCalledWith(dirname(mockConfig.outputPath), { recursive: true });
      
      // Should write formatted JSON
      expect(mockWrite).toHaveBeenCalledWith(
        mockConfig.outputPath,
        expect.stringMatching(/^\{[\s\S]*\}$/),
        'utf-8'
      );
      
      // Verify written data structure
      const writtenData = JSON.parse(mockWrite.mock.calls[0][1] as string);
      expect(writtenData).toHaveProperty('status', 'healthy');
      
      // Handle write errors gracefully
      mockWrite.mockImplementation(() => { throw new Error('Permission denied'); });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      expect(() => heartbeat.writeStatus()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [Heartbeat] Failed to write status:'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Daemon lifecycle', () => {
    it('manages start/stop lifecycle correctly', async () => {
      const mockWrite = vi.mocked(writeFileSync);
      heartbeat = new HeartbeatModule(mockConfig);
      
      // Initial state
      expect(heartbeat.isRunning()).toBe(false);
      
      // Start
      await heartbeat.start();
      expect(heartbeat.isRunning()).toBe(true);
      expect(mockWrite).toHaveBeenCalledTimes(1); // Initial write
      
      // Advance timer - should write again
      vi.advanceTimersByTime(1000);
      expect(mockWrite).toHaveBeenCalledTimes(2);
      
      vi.advanceTimersByTime(1000);
      expect(mockWrite).toHaveBeenCalledTimes(3);
      
      // Double start should not create new interval
      const firstInterval = heartbeat['intervalId'];
      await heartbeat.start();
      expect(heartbeat['intervalId']).toBe(firstInterval);
      
      // Stop
      await heartbeat.stop();
      expect(heartbeat.isRunning()).toBe(false);
      
      // Shutdown
      await heartbeat.shutdown();
      expect(heartbeat.isRunning()).toBe(false);
    });

    it('handles autoStart configuration', async () => {
      vi.mocked(writeFileSync).mockImplementation(() => {});
      heartbeat = new HeartbeatModule({ ...mockConfig, autoStart: true });
      
      await heartbeat.initialize();
      
      expect(heartbeat.isRunning()).toBe(true);
      expect(writeFileSync).toHaveBeenCalled();
    });
  });
});