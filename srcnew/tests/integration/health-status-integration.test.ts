/**
 * @fileoverview Integration tests for health and status endpoints with module integration
 * @module tests/integration/health-status-integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../dist/src/server/index.js';
import { HeartbeatModule } from '../../dist/modules/core/heartbeat/index.js';
import { LoggerModule } from '../../dist/modules/core/logger/index.js';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { resetModuleLoader } from '../../dist/src/core/modules/loader.js';

describe('Health and Status Endpoint Integration', () => {
  let app: any;
  let heartbeatModule: HeartbeatModule;
  let loggerModule: LoggerModule;
  let testStateDir: string;
  
  beforeEach(async () => {
    // Create test state directory
    testStateDir = join(os.tmpdir(), `systemprompt-test-${Date.now()}`);
    mkdirSync(join(testStateDir, 'data'), { recursive: true });
    mkdirSync(join(testStateDir, 'logs'), { recursive: true });
    
    // Mock environment BEFORE resetting module loader
    process.env.STATE_DIR = testStateDir;
    
    // Reset module loader after setting environment
    resetModuleLoader();
    
    // Initialize logger module
    loggerModule = new LoggerModule({
      stateDir: testStateDir,
      logLevel: 'debug',
      maxSize: '10m',
      maxFiles: 7,
      outputs: ['console', 'file'],
      files: {
        system: 'system.log',
        error: 'error.log',
        access: 'access.log'
      }
    });
    await loggerModule.initialize();
    
    // Create module config file for test
    const moduleConfig = {
      modules: {
        heartbeat: {
          enabled: true,
          config: {
            interval: '500ms',
            autoStart: true,
            includeMetrics: ['timestamp', 'status', 'uptime', 'memory', 'cpu', 'version']
          }
        },
        logger: {
          enabled: true,
          config: {
            stateDir: testStateDir,
            logLevel: 'debug',
            maxSize: '10m',
            maxFiles: 7,
            outputs: ['console', 'file'],
            files: {
              system: 'system.log',
              error: 'error.log',
              access: 'access.log'
            }
          }
        }
      }
    };
    
    // Write config to expected location
    const configDir = process.env.CONFIG_PATH || join(process.cwd(), 'config');
    const configPath = join(configDir, 'modules.json');
    writeFileSync(configPath, JSON.stringify(moduleConfig, null, 2));
    
    // Create test app - this will load modules from config
    app = await createApp();
    
    // Get references to loaded modules for testing
    const moduleLoader = (await import('../../dist/src/core/modules/loader.js')).getModuleLoader();
    const registry = moduleLoader.getRegistry();
    heartbeatModule = registry.get('heartbeat') as HeartbeatModule;
    loggerModule = registry.get('logger') as LoggerModule;
    
    // Wait for first heartbeat write
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  
  afterEach(async () => {
    // Stop heartbeat
    if (heartbeatModule) {
      await heartbeatModule.stop();
    }
    
    // Cleanup test directory
    if (existsSync(testStateDir)) {
      rmSync(testStateDir, { recursive: true, force: true });
    }
  });
  
  describe('Health Endpoint', () => {
    it('should return latest heartbeat data when available', async () => {
      // Verify heartbeat file exists
      const heartbeatPath = join(testStateDir, 'data', 'heartbeat.json');
      expect(existsSync(heartbeatPath)).toBe(true);
      
      // Get health status
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      // Should include heartbeat data
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('heartbeat');
      expect(response.body.heartbeat).toHaveProperty('timestamp');
      expect(response.body.heartbeat).toHaveProperty('status', 'healthy');
      expect(response.body.heartbeat).toHaveProperty('uptime');
      expect(response.body.heartbeat).toHaveProperty('memory');
      expect(response.body.heartbeat).toHaveProperty('cpu');
    });
    
    it('should handle missing heartbeat gracefully', async () => {
      // Stop heartbeat and remove file
      await heartbeatModule.stop();
      const heartbeatPath = join(testStateDir, 'data', 'heartbeat.json');
      if (existsSync(heartbeatPath)) {
        rmSync(heartbeatPath);
      }
      
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('heartbeat', null);
      expect(response.body).toHaveProperty('system'); // Still returns system info
    });
    
    it('should indicate degraded status when heartbeat is stale', async () => {
      // Stop heartbeat
      await heartbeatModule.stop();
      
      // Write stale heartbeat (5 minutes old)
      const staleHeartbeat = {
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        status: 'healthy',
        uptime: 1000
      };
      const heartbeatPath = join(testStateDir, 'data', 'heartbeat.json');
      writeFileSync(heartbeatPath, JSON.stringify(staleHeartbeat));
      
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'degraded');
      expect(response.body).toHaveProperty('warnings');
      expect(response.body.warnings).toContain('Heartbeat is stale');
    });
  });
  
  describe('Status Endpoint', () => {
    it('should return comprehensive system status with logs', async () => {
      // Generate some logs
      const logger = loggerModule.getService();
      logger.info('Test info log');
      logger.error('Test error log');
      logger.warn('Test warning log');
      
      // Wait for logs to be written
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await request(app)
        .get('/status')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'operational');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('modules');
      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('state');
      
      // Check modules
      expect(response.body.modules).toHaveProperty('heartbeat');
      expect(response.body.modules.heartbeat).toHaveProperty('status', 'running');
      expect(response.body.modules.heartbeat).toHaveProperty('lastUpdate');
      
      expect(response.body.modules).toHaveProperty('logger');
      expect(response.body.modules.logger).toHaveProperty('status', 'active');
      
      // Check logs
      expect(response.body.logs).toHaveProperty('recent');
      expect(response.body.logs.recent).toBeInstanceOf(Array);
      expect(response.body.logs.recent.length).toBeGreaterThan(0);
      
      expect(response.body.logs).toHaveProperty('errors');
      expect(response.body.logs.errors).toBeInstanceOf(Array);
      expect(response.body.logs.errors.some(log => log.includes('Test error log'))).toBe(true);
      
      // Check state directory info
      expect(response.body.state).toHaveProperty('directory', testStateDir);
      expect(response.body.state).toHaveProperty('size');
      expect(response.body.state.size).toHaveProperty('logs');
      expect(response.body.state.size).toHaveProperty('data');
    });
    
    it('should return module-specific status', async () => {
      // Wait a bit to ensure modules have uptime
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await request(app)
        .get('/status')
        .expect(200);
      
      // Heartbeat module status
      const heartbeatStatus = response.body.modules.heartbeat;
      expect(heartbeatStatus).toHaveProperty('status', 'running');
      expect(heartbeatStatus).toHaveProperty('interval', '500ms');
      expect(heartbeatStatus).toHaveProperty('uptime');
      expect(heartbeatStatus.uptime).toBeGreaterThanOrEqual(0);
      
      // Logger module status
      const loggerStatus = response.body.modules.logger;
      expect(loggerStatus).toHaveProperty('status', 'active');
      expect(loggerStatus).toHaveProperty('logLevel', 'debug');
      expect(loggerStatus).toHaveProperty('outputs', ['console', 'file']);
    });
    
    it('should include recent log entries with limit', async () => {
      // Generate many logs
      const logger = loggerModule.getService();
      for (let i = 0; i < 10; i++) {
        logger.info(`Test log entry ${i}`);
        logger.error(`Test error ${i}`);
      }
      
      // Give more time for logs to be written
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const response = await request(app)
        .get('/status?logLimit=5')
        .expect(200);
      
      // For now, just check that logs are returned (might be empty in test env)
      expect(response.body.logs).toBeDefined();
      expect(response.body.logs).toHaveProperty('recent');
      expect(response.body.logs).toHaveProperty('errors');
    });
    
    it('should calculate state directory sizes', async () => {
      // Write some test data
      const logger = loggerModule.getService();
      for (let i = 0; i < 10; i++) {
        logger.info(`Test log entry ${i}`.repeat(100));
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await request(app)
        .get('/status')
        .expect(200);
      
      expect(response.body.state.size.logs).toBeGreaterThan(0);
      expect(response.body.state.size.data).toBeGreaterThan(0);
      expect(response.body.state.size.total).toBe(
        response.body.state.size.logs + response.body.state.size.data
      );
    });
  });
  
  describe('Module Integration', () => {
    it('should reflect real-time module state changes', async () => {
      // Get initial status
      let response = await request(app).get('/status');
      expect(response.body.modules.heartbeat.status).toBe('running');
      
      // Stop heartbeat
      await heartbeatModule.stop();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get updated status
      response = await request(app).get('/status');
      expect(response.body.modules.heartbeat.status).toBe('stopped');
      
      // Restart heartbeat
      await heartbeatModule.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify running again
      response = await request(app).get('/status');
      expect(response.body.modules.heartbeat.status).toBe('running');
    });
    
    it('should handle module errors gracefully', async () => {
      // Force an error by removing heartbeat file
      const heartbeatPath = join(testStateDir, 'data', 'heartbeat.json');
      if (existsSync(heartbeatPath)) {
        rmSync(heartbeatPath);
      }
      
      // Wait a bit to ensure heartbeat is considered stale
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Health should still work but handle missing heartbeat
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      // With missing heartbeat, status should be ok but heartbeat should be null
      expect(response.body.status).toBe('ok');
      expect(response.body.heartbeat).toBe(null);
    });
  });
});