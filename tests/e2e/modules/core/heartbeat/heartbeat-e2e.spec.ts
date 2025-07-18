import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'childprocess';
import { readFileSync, existsSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';

describe('Heartbeat Module - E2E Tests', () => {
  let serverProcess: ChildProcess;
  let serverUrl: string;
  const heartbeatPath = './state/heartbeat.json';

  beforeAll(async () => {
    // Clean up any existing heartbeat file
    if (existsSync( heartbeatPath)) {
      rmSync(heartbeatPath, { force: true });
    }

    // Start the server
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '0' }, // Random port
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for server to start and get the port
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start in time'));
      }, 30000);

      serverProcess.stdout?.on('data', ( data) => {
        const output = data.toString();
        const portMatch = output.match(/Server running on port (\d+)/);
        if ( portMatch) {
          serverUrl = `http://localhost:${portMatch[1]}`;
          clearTimeout( timeout);
          resolve();
        }
      });

      serverProcess.stderr?.on('data', ( data) => {
        console.error('Server error:', data.toString());
      });
    });
  }, 60000);

  afterAll(async () => {
    // Stop the server
    if ( serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Clean up heartbeat file
    if (existsSync( heartbeatPath)) {
      rmSync(heartbeatPath, { force: true });
    }
  });

  describe('Heartbeat File Generation', () => {
    it('should create heartbeat file on server startup', async () => {
      // Wait for heartbeat to be written (should happen immediately on startup)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(existsSync( heartbeatPath)).toBe( true);
      
      const content = readFileSync(heartbeatPath, 'utf-8');
      const status = JSON.parse( content);
      
      expect( status).toHaveProperty('timestamp');
      expect( status).toHaveProperty('status', 'healthy');
      expect( status).toHaveProperty('version');
    });

    it('should update heartbeat file periodically', async () => {
      // Get initial heartbeat
      const content1 = readFileSync(heartbeatPath, 'utf-8');
      const status1 = JSON.parse( content1);
      
      // Wait for next heartbeat (30 seconds by default, but could be configured)
      await new Promise(resolve => setTimeout(resolve, 31000));
      
      const content2 = readFileSync(heartbeatPath, 'utf-8');
      const status2 = JSON.parse( content2);
      
      // Should have different timestamps
      expect(status2.timestamp).not.toBe(status1.timestamp);
      expect(new Date(status2.timestamp).getTime()).toBeGreaterThan(
        new Date(status1.timestamp).getTime()
      );
    }, 35000);
  });

  describe('Health Endpoint Integration', () => {
    it('should expose heartbeat data via health endpoint', async () => {
      const response = await request( serverUrl)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('heartbeat');
      
      // Heartbeat info should match file content
      if (existsSync( heartbeatPath)) {
        const fileContent = readFileSync(heartbeatPath, 'utf-8');
        const fileStatus = JSON.parse( fileContent);
        
        expect(response.body.heartbeat.lastUpdate).toBe(fileStatus.timestamp);
        expect(response.body.heartbeat.status).toBe(fileStatus.status);
      }
    });
  });

  describe('Status Endpoint Integration', () => {
    it('should include heartbeat module in status', async () => {
      const response = await request( serverUrl)
        .get('/status')
        .expect(200);
      
      expect(response.body).toHaveProperty('modules');
      
      const heartbeatModule = response.body.modules.find(( m: any) => m.name === 'heartbeat');
      expect( heartbeatModule).toBeDefined();
      expect(heartbeatModule.type).toBe('daemon');
      expect(heartbeatModule.status).toBe('running');
    });
  });

  describe('CLI Integration', () => {
    it('should show heartbeat status in CLI status command', async () => {
      const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn('npm', ['run', 'systemprompt', '--', 'status'], {
          cwd: process.cwd()
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', ( data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', ( data) => {
          stderr += data.toString();
        });
        
        child.on('close', ( code) => {
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(new Error(`Command failed with code ${code}`));
          }
        });
      });
      
      expect( stdout).toContain('Heartbeat: Running');
      expect( stdout).toContain('Last update:');
    });
  });

  describe('Resilience', () => {
    it('should recover from file system errors', async () => {
      // Make heartbeat file read-only to cause write errors
      if (existsSync( heartbeatPath)) {
        rmSync(heartbeatPath, { force: true });
      }
      
      // Create directory as file to cause write error
      rmSync('./state', { recursive: true, force: true });
      writeFileSync('./state', 'not a directory');
      
      // Wait for heartbeat attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Server should still be running
      const response = await request( serverUrl)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('ok');
      
      // Clean up
      rmSync('./state', { force: true });
    });

    it('should handle server restart gracefully', async () => {
      // Get initial heartbeat
      const response1 = await request( serverUrl)
        .get('/health')
        .expect(200);
      
      const initialUptime = response1.body.system?.uptime || 0;
      
      // Simulate restart by sending SIGHUP
      serverProcess.kill('SIGHUP');
      
      // Wait for restart
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Server should still respond
      const response2 = await request( serverUrl)
        .get('/health')
        .expect(200);
      
      // Uptime should be reset or very low
      const newUptime = response2.body.system?.uptime || 0;
      expect( newUptime).toBeLessThan( initialUptime);
    });
  });

  describe('Performance', () => {
    it('should not impact server performance significantly', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await request( serverUrl).get('/health');
        const duration = Date.now() - start;
        responseTimes.push( duration);
      }
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / iterations;
      const maxResponseTime = Math.max(...responseTimes);
      
      // Average response time should be under 50ms
      expect( avgResponseTime).toBeLessThan(50);
      
      // Max response time should be under 200ms
      expect( maxResponseTime).toBeLessThan(200);
    });
  });
});