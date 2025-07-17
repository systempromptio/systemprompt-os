import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatModule } from '../../index.js';
import { HeartbeatConfig, HeartbeatStatus } from '../../types.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

vi.mock('fs');

describe('Heartbeat Module - Unit Tests', () => {
  let heartbeat: HeartbeatModule;
  const mockConfig: HeartbeatConfig = {
    interval: '1s', // 1 second for testing
    outputPath: './state/heartbeat.json',
    autoStart: false,
    includeMetrics: ['timestamp', 'status', 'uptime', 'memory', 'cpu', 'version']
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (heartbeat && heartbeat.isRunning()) {
      heartbeat.stop();
    }
    vi.useRealTimers();
  });

  describe('Module Initialization', () => {
    it('should initialize with provided config', () => {
      heartbeat = new HeartbeatModule(mockConfig);
      
      expect(heartbeat.name).toBe('heartbeat');
      expect(heartbeat.type).toBe('daemon');
      expect(heartbeat.config).toEqual(mockConfig);
    });

    it('should parse interval correctly', () => {
      heartbeat = new HeartbeatModule(mockConfig);
      expect(heartbeat.getIntervalMs()).toBe(1000);

      heartbeat = new HeartbeatModule({ ...mockConfig, interval: '30s' });
      expect(heartbeat.getIntervalMs()).toBe(30000);

      heartbeat = new HeartbeatModule({ ...mockConfig, interval: '5m' });
      expect(heartbeat.getIntervalMs()).toBe(300000);
    });

    it('should handle invalid interval format', () => {
      expect(() => {
        new HeartbeatModule({ ...mockConfig, interval: 'invalid' });
      }).toThrow('Invalid interval format');
    });
  });

  describe('Status Generation', () => {
    it('should generate status with all metrics', () => {
      heartbeat = new HeartbeatModule(mockConfig);
      const status = heartbeat.generateStatus();

      expect(status).toHaveProperty('timestamp');
      expect(status).toHaveProperty('status', 'healthy');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('memory');
      expect(status).toHaveProperty('cpu');
      expect(status).toHaveProperty('version');
      
      expect(status.memory).toHaveProperty('used');
      expect(status.memory).toHaveProperty('total');
      expect(status.memory).toHaveProperty('percentage');
    });

    it('should generate status with partial metrics', () => {
      heartbeat = new HeartbeatModule({
        ...mockConfig,
        includeMetrics: ['timestamp', 'status']
      });
      const status = heartbeat.generateStatus();

      expect(status).toHaveProperty('timestamp');
      expect(status).toHaveProperty('status');
      expect(status).not.toHaveProperty('uptime');
      expect(status).not.toHaveProperty('memory');
    });

    it('should calculate uptime correctly', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      
      heartbeat = new HeartbeatModule(mockConfig);
      
      // Advance time by 60 seconds
      vi.setSystemTime(startTime + 60000);
      
      const status = heartbeat.generateStatus();
      expect(status.uptime).toBe(60);
    });
  });

  describe('File Writing', () => {
    it('should create directory if it does not exist', () => {
      const mockMkdir = vi.mocked(mkdirSync);
      const mockWrite = vi.mocked(writeFileSync);
      
      heartbeat = new HeartbeatModule(mockConfig);
      heartbeat.writeStatus();

      expect(mockMkdir).toHaveBeenCalledWith(dirname(mockConfig.outputPath), { recursive: true });
      expect(mockWrite).toHaveBeenCalled();
    });

    it('should write formatted JSON to file', () => {
      const mockWrite = vi.mocked(writeFileSync);
      
      heartbeat = new HeartbeatModule(mockConfig);
      heartbeat.writeStatus();

      expect(mockWrite).toHaveBeenCalledWith(
        mockConfig.outputPath,
        expect.stringMatching(/^\{[\s\S]*\}$/),
        'utf-8'
      );

      const writtenData = JSON.parse(mockWrite.mock.calls[0][1] as string);
      expect(writtenData).toHaveProperty('status', 'healthy');
    });

    it('should handle write errors gracefully', () => {
      const mockWrite = vi.mocked(writeFileSync);
      mockWrite.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      heartbeat = new HeartbeatModule(mockConfig);
      
      expect(() => heartbeat.writeStatus()).not.toThrow();
      // Without a logger, heartbeat falls back to console.log
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [Heartbeat] Failed to write status:'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Daemon Lifecycle', () => {
    it('should start and stop correctly', async () => {
      heartbeat = new HeartbeatModule(mockConfig);
      
      expect(heartbeat.isRunning()).toBe(false);
      
      await heartbeat.start();
      expect(heartbeat.isRunning()).toBe(true);
      
      await heartbeat.stop();
      expect(heartbeat.isRunning()).toBe(false);
    });

    it('should write status immediately on start', async () => {
      const mockWrite = vi.mocked(writeFileSync);
      heartbeat = new HeartbeatModule(mockConfig);
      
      await heartbeat.start();
      
      expect(mockWrite).toHaveBeenCalledTimes(1);
    });

    it('should write status at intervals', async () => {
      const mockWrite = vi.mocked(writeFileSync);
      heartbeat = new HeartbeatModule(mockConfig);
      
      await heartbeat.start();
      expect(mockWrite).toHaveBeenCalledTimes(1);
      
      // Advance by 1 second
      vi.advanceTimersByTime(1000);
      expect(mockWrite).toHaveBeenCalledTimes(2);
      
      // Advance by another second
      vi.advanceTimersByTime(1000);
      expect(mockWrite).toHaveBeenCalledTimes(3);
    });

    it('should not start if already running', async () => {
      heartbeat = new HeartbeatModule(mockConfig);
      
      await heartbeat.start();
      const firstInterval = heartbeat['intervalId'];
      
      await heartbeat.start(); // Try to start again
      const secondInterval = heartbeat['intervalId'];
      
      expect(firstInterval).toBe(secondInterval);
    });

    it('should handle autoStart config', async () => {
      const mockWrite = vi.mocked(writeFileSync);
      heartbeat = new HeartbeatModule({ ...mockConfig, autoStart: true });
      
      await heartbeat.initialize();
      
      expect(heartbeat.isRunning()).toBe(true);
      expect(mockWrite).toHaveBeenCalled();
    });
  });

  describe('Module Interface Compliance', () => {
    it('should implement required module interface', () => {
      heartbeat = new HeartbeatModule(mockConfig);
      
      expect(heartbeat.name).toBe('heartbeat');
      expect(heartbeat.type).toBe('daemon');
      expect(heartbeat.version).toBe('1.0.0');
      expect(heartbeat.initialize).toBeDefined();
      expect(heartbeat.shutdown).toBeDefined();
    });

    it('should handle shutdown gracefully', async () => {
      heartbeat = new HeartbeatModule(mockConfig);
      
      await heartbeat.start();
      expect(heartbeat.isRunning()).toBe(true);
      
      await heartbeat.shutdown();
      expect(heartbeat.isRunning()).toBe(false);
    });
  });
});