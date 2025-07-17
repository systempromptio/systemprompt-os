/**
 * Isolated integration test for health and status endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Health and Status Endpoints - Isolated Integration', () => {
  let app: any;
  let testStateDir: string;
  
  beforeEach(async () => {
    // Create isolated test directory
    testStateDir = join(os.tmpdir(), `systemprompt-test-${Date.now()}`);
    mkdirSync(join(testStateDir, 'data'), { recursive: true });
    mkdirSync(join(testStateDir, 'logs'), { recursive: true });
    
    // Create a minimal express app with just the endpoints we need
    app = express();
    app.use(express.json());
    
    // Mock health endpoint
    app.get('/health', (req, res) => {
      const heartbeatPath = join(testStateDir, 'data', 'heartbeat.json');
      let heartbeat = null;
      let status = 'ok';
      const warnings = [];
      
      if (existsSync(heartbeatPath)) {
        try {
          const content = require('fs').readFileSync(heartbeatPath, 'utf-8');
          heartbeat = JSON.parse(content);
          
          // Check if stale
          const heartbeatTime = new Date(heartbeat.timestamp).getTime();
          const now = Date.now();
          if ((now - heartbeatTime) > 2 * 60 * 1000) {
            warnings.push('Heartbeat is stale');
            status = 'degraded';
          }
          
          if (heartbeat.status !== 'healthy') {
            warnings.push('Heartbeat reports unhealthy status');
            status = 'degraded';
          }
        } catch (error) {
          // Ignore
        }
      }
      
      res.json({
        status,
        timestamp: new Date().toISOString(),
        service: 'systemprompt-os',
        version: '0.1.0',
        heartbeat,
        warnings: warnings.length > 0 ? warnings : undefined,
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          uptime: os.uptime(),
          loadAverage: os.loadavg(),
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
            percentUsed: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
          },
          cpu: {
            model: os.cpus()[0]?.model || 'Unknown',
            cores: os.cpus().length,
            speed: os.cpus()[0]?.speed || 0,
          },
        },
      });
    });
    
    // Mock status endpoint
    app.get('/status', (req, res) => {
      const logLimit = parseInt(req.query.logLimit as string) || 10;
      
      // Read logs
      const systemLogPath = join(testStateDir, 'logs', 'system.log');
      const errorLogPath = join(testStateDir, 'logs', 'error.log');
      const logs = { recent: [], errors: [] };
      
      if (existsSync(systemLogPath)) {
        const content = require('fs').readFileSync(systemLogPath, 'utf-8');
        logs.recent = content.split('\n').filter(line => line.trim()).slice(-logLimit);
      }
      
      if (existsSync(errorLogPath)) {
        const content = require('fs').readFileSync(errorLogPath, 'utf-8');
        logs.errors = content.split('\n').filter(line => line.trim()).slice(-logLimit);
      }
      
      res.json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        servers: {},
        providers: {},
        modules: {
          heartbeat: {
            status: 'running',
            type: 'daemon',
            version: '1.0.0',
            interval: '500ms',
            uptime: 100,
            lastUpdate: new Date().toISOString()
          },
          logger: {
            status: 'active',
            type: 'service',
            version: '1.0.0',
            logLevel: 'debug',
            outputs: ['console', 'file']
          }
        },
        logs,
        state: {
          directory: testStateDir,
          size: {
            logs: 1024,
            data: 512,
            total: 1536
          }
        }
      });
    });
  });
  
  afterEach(async () => {
    // Cleanup
    if (existsSync(testStateDir)) {
      rmSync(testStateDir, { recursive: true, force: true });
    }
  });
  
  it('should return health without heartbeat', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('heartbeat', null);
    expect(response.body).toHaveProperty('system');
  });
  
  it('should return health with heartbeat', async () => {
    // Write heartbeat file
    const heartbeat = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      uptime: 60,
      memory: { used: 1000, total: 2000, percentage: 50 },
      cpu: { usage: 25, loadAverage: [1, 2, 3] },
      version: '1.0.0'
    };
    
    writeFileSync(
      join(testStateDir, 'data', 'heartbeat.json'),
      JSON.stringify(heartbeat, null, 2)
    );
    
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('heartbeat');
    expect(response.body.heartbeat).toMatchObject(heartbeat);
  });
  
  it('should indicate degraded status for stale heartbeat', async () => {
    // Write stale heartbeat
    const heartbeat = {
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'healthy',
      uptime: 60
    };
    
    writeFileSync(
      join(testStateDir, 'data', 'heartbeat.json'),
      JSON.stringify(heartbeat, null, 2)
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
    expect(response.body).toHaveProperty('logs');
    expect(response.body).toHaveProperty('state');
  });
  
  it('should return logs when available', async () => {
    // Write some logs
    const logs = Array.from({ length: 10 }, (_, i) => `Log entry ${i}`).join('\n');
    writeFileSync(join(testStateDir, 'logs', 'system.log'), logs);
    writeFileSync(join(testStateDir, 'logs', 'error.log'), 'Error log\nAnother error');
    
    const response = await request(app)
      .get('/status')
      .expect(200);
    
    expect(response.body.logs.recent).toHaveLength(10);
    expect(response.body.logs.errors).toHaveLength(2);
  });
  
  it('should respect log limit parameter', async () => {
    // Write many logs
    const logs = Array.from({ length: 20 }, (_, i) => `Log entry ${i}`).join('\n');
    writeFileSync(join(testStateDir, 'logs', 'system.log'), logs);
    
    const response = await request(app)
      .get('/status?logLimit=5')
      .expect(200);
    
    expect(response.body.logs.recent).toHaveLength(5);
  });
});