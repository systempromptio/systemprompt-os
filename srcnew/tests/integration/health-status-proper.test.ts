/**
 * Properly isolated integration test for health and status endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Health and Status Endpoints - Proper Integration', () => {
  let app: any;
  let testStateDir: string;
  let testConfigDir: string;
  const originalEnv = { ...process.env };
  
  beforeEach(async () => {
    // Create isolated test directories
    const testId = Date.now();
    testStateDir = join(os.tmpdir(), `systemprompt-test-state-${testId}`);
    testConfigDir = join(os.tmpdir(), `systemprompt-test-config-${testId}`);
    
    mkdirSync(join(testStateDir, 'data'), { recursive: true });
    mkdirSync(join(testStateDir, 'logs'), { recursive: true });
    mkdirSync(testConfigDir, { recursive: true });
    
    // Set environment BEFORE importing anything
    process.env.STATE_DIR = testStateDir;
    process.env.CONFIG_PATH = testConfigDir;
    process.env.NODE_ENV = 'test';
    
    // Create test module config
    const moduleConfig = {
      modules: {
        heartbeat: {
          enabled: true,
          config: {
            interval: '500ms',
            outputPath: join(testStateDir, 'data', 'heartbeat.json'),
            autoStart: true,
            includeMetrics: ['timestamp', 'status', 'uptime', 'memory', 'cpu', 'version']
          }
        },
        logger: {
          enabled: true,
          config: {
            stateDir: testStateDir,
            logLevel: 'debug',
            outputs: ['console', 'file']
          }
        }
      }
    };
    
    writeFileSync(
      join(testConfigDir, 'modules.json'),
      JSON.stringify(moduleConfig, null, 2)
    );
    
    // Now import and create app - config will use test directories
    const { resetModuleLoader } = await import('../../dist/src/core/modules/loader.js');
    resetModuleLoader(); // Clear any previous state
    
    const { createApp } = await import('../../dist/src/server/index.js');
    app = await createApp();
    
    // Wait for modules to initialize
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  
  afterEach(async () => {
    // Reset module loader
    const { resetModuleLoader } = await import('../../dist/src/core/modules/loader.js');
    resetModuleLoader();
    
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
    
    // Cleanup test directories
    if (existsSync(testStateDir)) {
      rmSync(testStateDir, { recursive: true, force: true });
    }
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });
  
  it('should return health with heartbeat from test directory', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('heartbeat');
    expect(response.body.heartbeat).toHaveProperty('timestamp');
    expect(response.body.heartbeat).toHaveProperty('status', 'healthy');
    
    // Verify heartbeat was written to test directory
    const heartbeatPath = join(testStateDir, 'data', 'heartbeat.json');
    expect(existsSync(heartbeatPath)).toBe(true);
  });
  
  it('should handle missing heartbeat gracefully', async () => {
    // Stop the heartbeat module
    const { getModuleLoader } = await import('../../dist/src/core/modules/loader.js');
    const loader = getModuleLoader();
    const registry = loader.getRegistry();
    const heartbeat = registry.get('heartbeat');
    
    if (heartbeat && 'stop' in heartbeat) {
      await (heartbeat as any).stop();
    }
    
    // Remove heartbeat file
    const heartbeatPath = join(testStateDir, 'data', 'heartbeat.json');
    if (existsSync(heartbeatPath)) {
      rmSync(heartbeatPath);
    }
    
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('heartbeat', null);
  });
  
  it('should detect stale heartbeat', async () => {
    // Write stale heartbeat
    const staleHeartbeat = {
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'healthy',
      uptime: 100
    };
    
    writeFileSync(
      join(testStateDir, 'data', 'heartbeat.json'),
      JSON.stringify(staleHeartbeat, null, 2)
    );
    
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'degraded');
    expect(response.body).toHaveProperty('warnings');
    expect(response.body.warnings).toContain('Heartbeat is stale');
  });
  
  it('should return status with module information', async () => {
    const response = await request(app)
      .get('/status')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'operational');
    expect(response.body).toHaveProperty('modules');
    expect(response.body.modules).toHaveProperty('heartbeat');
    expect(response.body.modules).toHaveProperty('logger');
    
    // Verify state directory is the test directory
    expect(response.body.state).toHaveProperty('directory', testStateDir);
  });
  
  it('should read logs from test directory', async () => {
    // Get logger and write some logs
    const { getModuleLoader } = await import('../../dist/src/core/modules/loader.js');
    const loader = getModuleLoader();
    const registry = loader.getRegistry();
    const loggerModule = registry.get('logger');
    
    if (loggerModule && 'getService' in loggerModule) {
      const logger = (loggerModule as any).getService();
      logger.info('Test log entry');
      logger.error('Test error entry');
    }
    
    // Give logs time to write
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const response = await request(app)
      .get('/status')
      .expect(200);
    
    expect(response.body.logs.recent.length).toBeGreaterThan(0);
    expect(response.body.logs.errors.length).toBeGreaterThan(0);
  });
});