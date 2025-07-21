/**
 * @fileoverview Unit tests for tunnel service
 * @module tests/unit/modules/core/auth/services/tunnel-service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TunnelService } from '../../../../../../src/modules/core/auth/services/tunnel-service';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn().mockReturnValue({ status: 0 })
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn()
}));

// Mock tunnel status
vi.mock('../../../../../../src/modules/core/auth/tunnel-status.js', () => ({
  tunnelStatus: {
    setBaseUrl: vi.fn()
  }
}));

describe('TunnelService', () => {
  let tunnelService: TunnelService;
  let mockProcess: any;
  let mockConfig: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set environment to enable tunnel
    process.env.ENABLE_OAUTH_TUNNEL = 'true';
    process.env.NODE_ENV = 'development';
    process.env.OAUTH_TUNNEL_REQUIRED = 'true'; // Ensure hasOAuthProviders returns true
    
    // Mock spawnSync to return success for cloudflared check
    vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);
    
    // Create mock process
    mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = vi.fn();
    mockProcess.pid = 12345;
    
    vi.mocked(spawn).mockReturnValue(mockProcess);
    
    // Create mock config
    mockConfig = {
      port: 3000,
      enableInDevelopment: true
    };
    
    tunnelService = new TunnelService(mockConfig);
  });
  
  afterEach(() => {
    // Clean up any running tunnels
    tunnelService.stop();
    // Clean up environment
    delete process.env.ENABLE_OAUTH_TUNNEL;
    delete process.env.NODE_ENV;
    delete process.env.OAUTH_TUNNEL_REQUIRED;
  });
  
  describe('start', () => {
    it('starts tunnel successfully with URL from stdout', async () => {
      const startPromise = tunnelService.start();
      
      // Simulate cloudflared output (cloudflared outputs to stderr)
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('INF |  https://test-tunnel.trycloudflare.com\n'));
      }, 10);
      
      const url = await startPromise;
      
      expect(spawn).toHaveBeenCalled();
      const spawnCall = vi.mocked(spawn).mock.calls[0];
      expect(spawnCall[0]).toBe('cloudflared');
      expect(spawnCall[1]).toContain('tunnel');
      expect(spawnCall[1]).toContain('--url');
      expect(spawnCall[1]).toContain('http://localhost:3000');
      
      expect(url).toBe('https://test-tunnel.trycloudflare.com');
    });
    
    it('returns existing URL if tunnel already running', async () => {
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      const url = await startPromise;
      expect(url).toBe('https://test.trycloudflare.com');
      
      // Should already have the URL stored
      const status = tunnelService.getStatus();
      expect(status.url).toBe('https://test.trycloudflare.com');
      expect(status.active).toBe(true);
    });
    
    it('handles tunnel startup errors', async () => {
      const startPromise = tunnelService.start();
      
      // Simulate error
      setTimeout(() => {
        mockProcess.emit('error', new Error('Failed to start'));
      }, 10);
      
      await expect(startPromise).rejects.toThrow('Failed to start');
    });
    
    it('times out if no URL received', async () => {
      vi.useFakeTimers();
      const startPromise = tunnelService.start();
      
      // Fast forward 30 seconds to trigger timeout
      vi.advanceTimersByTime(30000);
      
      await expect(startPromise).rejects.toThrow('Timeout waiting for tunnel URL');
      vi.useRealTimers();
    });
  });
  
  describe('stop', () => {
    it('stops running tunnel', async () => {
      // Start tunnel first
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      await startPromise;
      
      await tunnelService.stop();
      
      expect(mockProcess.kill).toHaveBeenCalled();
      const status = tunnelService.getStatus();
      expect(status.active).toBe(false);
    });
    
    it('does nothing if tunnel not running', async () => {
      await expect(tunnelService.stop()).resolves.not.toThrow();
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });
  });
  
  describe('getStatus', () => {
    it('returns active status when tunnel is running', async () => {
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      await startPromise;
      
      const status = tunnelService.getStatus();
      expect(status.active).toBe(true);
      expect(status.url).toBe('https://test.trycloudflare.com');
      expect(status.type).toBe('cloudflared');
    });
    
    it('returns inactive status when tunnel is not running', () => {
      const status = tunnelService.getStatus();
      expect(status.active).toBe(false);
      expect(status.type).toBe('none');
    });
  });
  
  describe('URL extraction', () => {
    it('extracts URLs from various cloudflared output formats', async () => {
      const testCases = [
        'INF |  https://test1.trycloudflare.com',
        'https://test2.trycloudflare.com',
        'Tunnel URL: https://test3.trycloudflare.com',
        'INFO[0001] https://test4.trycloudflare.com'
      ];
      
      for (const output of testCases) {
        tunnelService = new TunnelService(mockConfig);
        vi.mocked(spawn).mockReturnValue(mockProcess);
        
        const startPromise = tunnelService.start();
        mockProcess.stderr.emit('data', Buffer.from(output + '\n'));
        
        const url = await startPromise;
        expect(url).toMatch(/^https:\/\/test\d\.trycloudflare\.com$/);
      }
    });
  });
});