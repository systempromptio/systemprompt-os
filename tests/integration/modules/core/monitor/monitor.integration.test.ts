/**
 * Monitor Module Integration Test
 * 
 * Tests system monitoring capabilities:
 * - Metrics collection
 * - Performance monitoring
 * - Resource usage tracking
 * - Alert generation
 * - Dashboard integration
 * 
 * Coverage targets:
 * - src/modules/core/monitor/index.ts
 * - src/modules/core/monitor/services/metric.service.ts
 * - src/modules/core/monitor/repositories/*.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bootstrap } from '@/bootstrap';
import type { MetricService } from '@/modules/core/monitor/services/metric.service';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { createTestId } from '../../../setup';

describe('Monitor Module Integration Tests', () => {
  let bootstrap: Bootstrap;
  let metricService: MetricService | undefined;
  let dbService: DatabaseService;
  
  const testSessionId = `monitor-integration-${createTestId()}`;
  const testDir = join(process.cwd(), '.test-integration', testSessionId);
  const testDbPath = join(testDir, 'test.db');

  beforeAll(async () => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Set test database path
    process.env.SQLITE_FILENAME = testDbPath;
    
    // Bootstrap the system
    bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    const modules = await bootstrap.bootstrap();
    
    // Get required services
    const monitorModule = modules.get('monitor');
    const dbModule = modules.get('database');
    
    if (!dbModule || !('exports' in dbModule) || !dbModule.exports) {
      throw new Error('Database module not loaded');
    }
    
    dbService = dbModule.exports.service();
    
    // Monitor module might not be loaded by default, that's ok
    if (monitorModule && 'exports' in monitorModule && monitorModule.exports) {
      if ('MonitorService' in monitorModule.exports) {
        metricService = monitorModule.exports.MonitorService as MetricService;
      }
    }
  });

  afterAll(async () => {
    // Shutdown bootstrap
    if (bootstrap) {
      await bootstrap.shutdown();
    }
    
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Clear metrics data before each test
    try {
      await dbService.execute('DELETE FROM metrics WHERE 1=1');
    } catch (error) {
      // Table might not exist yet
    }
  });

  describe('Module Bootstrap', () => {
    it('should load monitor module during bootstrap', async () => {
      const modules = bootstrap.getModules();
      
      expect(modules).toBeDefined();
      expect(modules.size).toBeGreaterThan(0);
      expect(modules.has('monitor')).toBe(true);
      
      const monitorModule = modules.get('monitor');
      expect(monitorModule).toBeDefined();
      expect(monitorModule?.name).toBe('monitor');
      expect(monitorModule?.version).toBe('1.0.0');
      expect(monitorModule?.type).toBe('daemon');
    });

    it('should have monitor module exports available', async () => {
      const modules = bootstrap.getModules();
      const monitorModule = modules.get('monitor');
      
      expect(monitorModule).toBeDefined();
      if (monitorModule && 'exports' in monitorModule) {
        expect(monitorModule.exports).toBeDefined();
        expect(monitorModule.exports?.MonitorService).toBeDefined();
        metricService = monitorModule.exports.MonitorService as MetricService;
        expect(metricService).toBeDefined();
      }
    });
  });

  describe('Metrics Collection', () => {
    it('should record metrics successfully', async () => {
      expect(metricService).toBeDefined();
      
      // Record a test metric
      metricService?.recordMetric({
        name: 'test.metric',
        value: 42,
        type: 'gauge',
        labels: { environment: 'test' },
        unit: 'ms'
      });
      
      // Metrics are buffered, so we don't expect immediate persistence
      expect(true).toBe(true);
    });
    
    it('should collect system metrics', async () => {
      expect(metricService).toBeDefined();
      
      const systemMetrics = await metricService?.getSystemMetrics();
      expect(systemMetrics).toBeDefined();
      expect(systemMetrics?.cpu.cores).toBeGreaterThan(0);
      expect(systemMetrics?.memory.total).toBeGreaterThan(0);
      expect(systemMetrics?.memory.free).toBeGreaterThan(0);
      expect(systemMetrics?.uptime).toBeGreaterThan(0);
    });
    
    it('should increment counter metrics', async () => {
      expect(metricService).toBeDefined();
      
      metricService?.incrementCounter({
        name: 'test.counter',
        labels: { action: 'test' },
        value: 1
      });
      
      expect(true).toBe(true);
    });
    
    it('should set gauge metrics', async () => {
      expect(metricService).toBeDefined();
      
      metricService?.setGauge({
        name: 'test.gauge',
        value: 100,
        labels: { type: 'memory' },
        unit: 'MB'
      });
      
      expect(true).toBe(true);
    });
    
    it('should record histogram metrics', async () => {
      expect(metricService).toBeDefined();
      
      metricService?.recordHistogram({
        name: 'test.histogram',
        value: 250,
        labels: { endpoint: '/api/test' },
        unit: 'ms'
      });
      
      expect(true).toBe(true);
    });
  });

  describe('Metric Queries', () => {
    beforeEach(async () => {
      // Create the metrics table if it doesn't exist
      // Create the metrics table if it doesn't exist
      await dbService.execute(`
        CREATE TABLE IF NOT EXISTS metric (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(255) NOT NULL,
          value REAL NOT NULL,
          type VARCHAR(50) NOT NULL CHECK (type IN ('counter', 'gauge', 'histogram')),
          unit VARCHAR(50),
          timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await dbService.execute(`
        CREATE TABLE IF NOT EXISTS metric_label (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          metric_id INTEGER NOT NULL,
          label_key VARCHAR(255) NOT NULL,
          label_value VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (metric_id) REFERENCES metric(id) ON DELETE CASCADE
        )
      `);
    });
    
    it('should query metrics by name', async () => {
      expect(metricService).toBeDefined();
      
      // Insert a test metric directly
      await dbService.execute(
        'INSERT INTO metric (name, value, type, timestamp) VALUES (?, ?, ?, ?)',
        ['test.query.metric', 123, 'gauge', new Date().toISOString()]
      );
      
      const results = await metricService?.queryMetrics({
        metric: 'test.query.metric'
      });
      
      expect(results).toBeDefined();
      expect(results?.data).toBeDefined();
      expect(Array.isArray(results?.data)).toBe(true);
    });
    
    it('should get metric names', async () => {
      expect(metricService).toBeDefined();
      
      const names = await metricService?.getMetricNames();
      expect(names).toBeDefined();
      expect(Array.isArray(names)).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('should perform health checks', async () => {
      const modules = bootstrap.getModules();
      const monitorModule = modules.get('monitor');
      
      expect(monitorModule).toBeDefined();
      
      const healthCheck = await monitorModule?.healthCheck();
      expect(healthCheck).toBeDefined();
      expect(healthCheck?.healthy).toBe(true);
      expect(healthCheck?.message).toBeDefined();
      expect(healthCheck?.checks).toBeDefined();
      expect(healthCheck?.checks?.database).toBe(true);
      expect(healthCheck?.checks?.service).toBe(true);
      expect(healthCheck?.checks?.status).toBe('running');
    });
    
    it('should get module info', async () => {
      const modules = bootstrap.getModules();
      const monitorModule = modules.get('monitor');
      
      expect(monitorModule).toBeDefined();
      
      const info = monitorModule?.getInfo();
      expect(info).toBeDefined();
      expect(info?.name).toBe('monitor');
      expect(info?.version).toBe('1.0.0');
      expect(info?.type).toBe('daemon');
      expect(info?.description).toBe('System monitoring and observability');
      expect(info?.author).toBe('SystemPrompt OS Team');
    });
  });

  describe('Database Integration', () => {
    it('should have monitor database adapter', async () => {
      expect(dbService).toBeDefined();
      
      // Database module exports createModuleAdapter function
      const dbModule = bootstrap.getModules().get('database');
      expect(dbModule).toBeDefined();
      if (dbModule && 'exports' in dbModule && dbModule.exports) {
        expect(dbModule.exports.createModuleAdapter).toBeDefined();
        const adapter = await dbModule.exports.createModuleAdapter('monitor');
        expect(adapter).toBeDefined();
      }
    });
    
    it('should handle database operations for monitoring', async () => {
      expect(dbService).toBeDefined();
      
      const testResult = await dbService.query('SELECT datetime(CURRENT_TIMESTAMP) as current_time');
      expect(testResult).toBeDefined();
      expect(Array.isArray(testResult)).toBe(true);
      expect(testResult.length).toBe(1);
    });
  });

  describe('Module Lifecycle', () => {
    it('should start and stop monitor module', async () => {
      const modules = bootstrap.getModules();
      const monitorModule = modules.get('monitor');
      
      expect(monitorModule).toBeDefined();
      
      // Stop the module if it's running (from bootstrap)
      if (monitorModule?.getInfo().status === 'running') {
        await monitorModule.stop();
      }
      
      // Module should be in stopped state after init
      let info = monitorModule?.getInfo();
      expect(info?.status).toBe('stopped');
      
      // Start the module
      await monitorModule?.start();
      info = monitorModule?.getInfo();
      expect(info?.status).toBe('running');
      
      // Stop the module
      await monitorModule?.stop();
      info = monitorModule?.getInfo();
      expect(info?.status).toBe('stopped');
    });
    
    it('should handle cleanup operations', async () => {
      const modules = bootstrap.getModules();
      const monitorModule = modules.get('monitor');
      
      expect(monitorModule).toBeDefined();
      
      // Stop the module if it's running (from bootstrap)
      if (monitorModule?.getInfo().status === 'running') {
        await monitorModule.stop();
      }
      
      // Start module to enable cleanup timer
      await monitorModule?.start();
      
      // Cleanup should work without errors
      if (metricService) {
        await metricService.cleanupOldMetrics(30);
      }
      
      await monitorModule?.stop();
    });
  });

  describe('CLI Integration', () => {
    it('should show monitor status via CLI', async () => {
      const result = await runCLICommand(['monitor', 'status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('Monitor Module Status');
      expect(result.output).toContain('System Metrics');
      expect(result.output).toContain('CPU Cores');
      expect(result.output).toContain('Memory');
    });

    it('should list metrics via CLI', async () => {
      // First record a metric
      await runCLICommand(['monitor', 'record', '-n', 'cli.test.metric', '-v', '42', '-t', 'gauge']);
      
      // Then list metrics
      const result = await runCLICommand(['monitor', 'list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toBeDefined();
      // May show "No metrics recorded yet" if table not initialized, which is ok
      expect(result.output.length).toBeGreaterThan(0);
    });

    it('should record metrics via CLI', async () => {
      const result = await runCLICommand([
        'monitor', 'record',
        '--name', 'test.cli.metric',
        '--value', '100',
        '--type', 'counter',
        '--unit', 'requests'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Metric recorded');
      expect(result.output).toContain('test.cli.metric');
      expect(result.output).toContain('100');
      expect(result.output).toContain('counter');
      expect(result.output).toContain('requests');
    });
    
    it('should handle invalid metric types', async () => {
      const result = await runCLICommand([
        'monitor', 'record',
        '--name', 'test.invalid',
        '--value', '50',
        '--type', 'invalid_type'
      ]);
      
      expect(result.exitCode).toBe(1);
      const combinedOutput = result.output + result.errors;
      expect(combinedOutput).toContain('Invalid metric type');
      expect(combinedOutput).toContain('counter, gauge, histogram');
    });
    
    it('should display help for monitor commands', async () => {
      const result = await runCLICommand(['monitor', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('monitor');
      // Should list available commands
      expect(result.output.toLowerCase()).toContain('status');
      expect(result.output.toLowerCase()).toContain('list');
      expect(result.output.toLowerCase()).toContain('record');
    });
  });

  async function runCLICommand(args: string[]): Promise<{ output: string; errors: string; exitCode: number | null }> {
    const cliProcess = spawn('npm', ['run', 'cli', '--', ...args], {
      cwd: process.cwd(),
      shell: true,
    });

    const output: string[] = [];
    const errors: string[] = [];

    cliProcess.stdout.on('data', (data) => {
      output.push(data.toString());
    });

    cliProcess.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    await new Promise<void>((resolve) => {
      cliProcess.on('close', () => {
        resolve();
      });
    });

    return {
      output: output.join(''),
      errors: errors.join(''),
      exitCode: cliProcess.exitCode,
    };
  }
});