/**
 * E2E test for heartbeat module with logger integration
 * Tests that heartbeat properly logs its activities and can clear logs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { HeartbeatModule } from '../../modules/core/heartbeat/index.js';
import { LoggerModule } from '../../modules/core/logger/index.js';
import { ModuleRegistry } from '../../modules/registry.js';

const TEST_STATE_DIR = join(process.cwd(), '.test-state');
const TEST_LOG_DIR = join(TEST_STATE_DIR, 'logs');
const TEST_DATA_DIR = join(TEST_STATE_DIR, 'data');

describe('Heartbeat with Logger E2E', () => {
  let logger: LoggerModule;
  let heartbeat: HeartbeatModule;
  let registry: ModuleRegistry;
  
  beforeEach(async () => {
    // Clean up any existing test directories
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
    
    // Create test directories
    mkdirSync(TEST_LOG_DIR, { recursive: true });
    mkdirSync(TEST_DATA_DIR, { recursive: true });
    
    // Initialize registry
    registry = new ModuleRegistry();
    
    // Initialize logger module
    const loggerConfig = {
      name: 'logger',
      type: 'service' as const,
      version: '1.0.0',
      description: 'Test logger',
      stateDir: TEST_STATE_DIR,
      logLevel: 'debug' as const,
      maxSize: '10m',
      maxFiles: 7,
      outputs: ['file'] as const, // Only file output for testing
      files: {
        system: 'system.log',
        error: 'error.log',
        access: 'access.log'
      }
    };
    
    logger = new LoggerModule(loggerConfig);
    await logger.initialize();
    registry.register(logger);
    
    // Initialize heartbeat module with logger
    const heartbeatConfig = {
      interval: '1s', // Fast interval for testing
      outputPath: join(TEST_DATA_DIR, 'heartbeat.json'),
      autoStart: false,
      includeMetrics: ['timestamp', 'status', 'uptime']
    };
    
    heartbeat = new HeartbeatModule(heartbeatConfig);
    heartbeat.setLogger(logger.getService());
    await heartbeat.initialize();
    registry.register(heartbeat);
  });
  
  afterEach(async () => {
    // Shutdown modules
    await registry.shutdownAll();
    
    // Clean up test directories
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
  });
  
  it('should log heartbeat lifecycle events', async () => {
    // Start heartbeat
    await heartbeat.start();
    
    // Wait for a few heartbeats
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Stop heartbeat
    await heartbeat.stop();
    
    // Get logs
    const logService = logger.getService();
    const logs = await logService.getLogs('system.log');
    
    // Verify expected log entries
    expect(logs.some(log => log.includes('[INFO] [Heartbeat] Starting daemon'))).toBe(true);
    expect(logs.some(log => log.includes('[DEBUG] [Heartbeat] Status written to'))).toBe(true);
    expect(logs.some(log => log.includes('[INFO] [Heartbeat] Stopping daemon'))).toBe(true);
    
    // Should have multiple status write logs (at least 2)
    const statusWriteLogs = logs.filter(log => log.includes('Status written to'));
    expect(statusWriteLogs.length).toBeGreaterThanOrEqual(2);
  });
  
  it('should log errors when heartbeat fails', async () => {
    // Create heartbeat with invalid output path
    const badHeartbeat = new HeartbeatModule({
      interval: '1s',
      outputPath: '/invalid/path/that/cannot/exist/heartbeat.json',
      autoStart: false
    });
    badHeartbeat.setLogger(logger.getService());
    
    // Register it to satisfy module requirements
    await badHeartbeat.initialize();
    
    // Try to write status
    badHeartbeat.writeStatus();
    
    // Wait a moment for async log writes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get error logs
    const logService = logger.getService();
    const errorLogs = await logService.getLogs('error.log');
    const systemLogs = await logService.getLogs('system.log');
    
    // Should have error log
    expect(errorLogs.some(log => log.includes('[ERROR] [Heartbeat] Failed to write status:'))).toBe(true);
    expect(systemLogs.some(log => log.includes('[ERROR] [Heartbeat] Failed to write status:'))).toBe(true);
  });
  
  it('should clear logs on demand', async () => {
    // Start heartbeat and generate some logs
    await heartbeat.start();
    await new Promise(resolve => setTimeout(resolve, 1500));
    await heartbeat.stop();
    
    const logService = logger.getService();
    
    // Verify logs exist
    let logs = await logService.getLogs('system.log');
    expect(logs.length).toBeGreaterThan(0);
    
    // Clear logs
    await logService.clearLogs('system.log');
    
    // Verify logs are cleared
    logs = await logService.getLogs('system.log');
    expect(logs.length).toBe(0);
    
    // Start again and verify new logs are created
    await heartbeat.start();
    await new Promise(resolve => setTimeout(resolve, 500));
    await heartbeat.stop();
    
    logs = await logService.getLogs('system.log');
    expect(logs.length).toBeGreaterThan(0);
  });
  
  it('should handle concurrent logging from multiple operations', async () => {
    // Start heartbeat
    await heartbeat.start();
    
    // Simulate concurrent operations
    const logService = logger.getService();
    const operations = [];
    
    for (let i = 0; i < 10; i++) {
      operations.push(
        logService.addLog('info', `Concurrent operation ${i}`)
      );
    }
    
    await Promise.all(operations);
    
    // Stop heartbeat
    await heartbeat.stop();
    
    // Get logs and verify all operations were logged
    const logs = await logService.getLogs('system.log');
    
    for (let i = 0; i < 10; i++) {
      expect(logs.some(log => log.includes(`Concurrent operation ${i}`))).toBe(true);
    }
  });
  
  it('should maintain separate log files', async () => {
    const logService = logger.getService();
    
    // Log to different levels
    logService.info('This is an info message');
    logService.error('This is an error message');
    logService.debug('This is a debug message');
    
    // Get logs from different files
    const systemLogs = await logService.getLogs('system.log');
    const errorLogs = await logService.getLogs('error.log');
    
    // System log should have all messages
    expect(systemLogs.some(log => log.includes('This is an info message'))).toBe(true);
    expect(systemLogs.some(log => log.includes('This is an error message'))).toBe(true);
    expect(systemLogs.some(log => log.includes('This is a debug message'))).toBe(true);
    
    // Error log should only have error messages
    expect(errorLogs.some(log => log.includes('This is an error message'))).toBe(true);
    expect(errorLogs.some(log => log.includes('This is an info message'))).toBe(false);
    expect(errorLogs.some(log => log.includes('This is a debug message'))).toBe(false);
  });
});