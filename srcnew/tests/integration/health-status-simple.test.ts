/**
 * Simplified integration test for health and status endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/index.js';
import { resetModuleLoader } from '../../src/core/modules/loader.js';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Health and Status Endpoints - Simple Integration', () => {
  let app: any;
  let testStateDir: string;
  const originalStateDir = process.env.STATE_DIR;
  
  beforeEach(async () => {
    // Create isolated test directory
    testStateDir = join(os.tmpdir(), `systemprompt-test-${Date.now()}`);
    mkdirSync(join(testStateDir, 'data'), { recursive: true });
    mkdirSync(join(testStateDir, 'logs'), { recursive: true });
    
    // Set test environment
    process.env.STATE_DIR = testStateDir;
    
    // Reset and create app
    resetModuleLoader();
    app = await createApp();
  });
  
  afterEach(async () => {
    // Restore environment
    if (originalStateDir) {
      process.env.STATE_DIR = originalStateDir;
    } else {
      delete process.env.STATE_DIR;
    }
    
    // Cleanup
    if (existsSync(testStateDir)) {
      rmSync(testStateDir, { recursive: true, force: true });
    }
    
    resetModuleLoader();
  });
  
  it('should respond to health endpoint', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('service', 'systemprompt-os');
    expect(response.body).toHaveProperty('system');
  });
  
  it('should respond to status endpoint with module info', async () => {
    const response = await request(app)
      .get('/status')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'operational');
    expect(response.body).toHaveProperty('modules');
    expect(response.body).toHaveProperty('logs');
    expect(response.body).toHaveProperty('state');
    
    // Should have heartbeat module loaded by default
    if (response.body.modules && response.body.modules.heartbeat) {
      expect(response.body.modules.heartbeat).toHaveProperty('status');
      expect(response.body.modules.heartbeat).toHaveProperty('type', 'daemon');
    }
  });
  
  it('should include state directory info in status', async () => {
    const response = await request(app)
      .get('/status')
      .expect(200);
    
    expect(response.body.state).toHaveProperty('directory', testStateDir);
    expect(response.body.state).toHaveProperty('size');
    expect(response.body.state.size).toHaveProperty('logs');
    expect(response.body.state.size).toHaveProperty('data');
    expect(response.body.state.size).toHaveProperty('total');
  });
});