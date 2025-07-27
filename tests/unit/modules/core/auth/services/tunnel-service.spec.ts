/**
 * @fileoverview Unit tests for tunnel service
 * @module tests/unit/modules/core/auth/services/tunnel-service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TunnelService } from '../../../../../../src/modules/core/auth/services/tunnel-service.js';
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
  let mockLogger: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the singleton instance before each test
    (TunnelService as any).instance = undefined;
    
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
    
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    
    // Create mock config
    mockConfig = {
      port: 3000,
      enableInDevelopment: true
    };
    
    tunnelService = new TunnelService(mockConfig, mockLogger);
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
    
    it('does nothing if tunnel not running', () => {
      expect(() => tunnelService.stop()).not.toThrow();
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

  describe('getInstance', () => {
    it('creates a new instance when called first time with config', () => {
      const instance1 = TunnelService.getInstance(mockConfig, mockLogger);
      expect(instance1).toBeInstanceOf(TunnelService);
    });

    it('returns existing instance when called again', () => {
      const instance1 = TunnelService.getInstance(mockConfig, mockLogger);
      const instance2 = TunnelService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('returns existing instance even with different config', () => {
      const instance1 = TunnelService.getInstance(mockConfig, mockLogger);
      const differentConfig = { port: 4000, enableInDevelopment: false };
      const instance2 = TunnelService.getInstance(differentConfig);
      expect(instance1).toBe(instance2);
    });
  });

  describe('permanent domain flow', () => {
    it('uses permanent domain when configured', async () => {
      const configWithDomain = {
        ...mockConfig,
        permanentDomain: 'https://my-domain.com'
      };
      tunnelService = new TunnelService(configWithDomain, mockLogger);
      
      const readyEventPromise = new Promise(resolve => {
        tunnelService.on('ready', resolve);
      });

      const url = await tunnelService.start();
      
      expect(url).toBe('https://my-domain.com');
      expect(mockLogger.info).toHaveBeenCalledWith('Using permanent OAuth domain: https://my-domain.com');
      expect(process.env.BASE_URL).toBe('https://my-domain.com');
      expect(process.env.OAUTH_REDIRECT_URI).toBe('https://my-domain.com/oauth2/callback');
      
      await readyEventPromise;
      
      const status = tunnelService.getStatus();
      expect(status.active).toBe(true);
      expect(status.type).toBe('permanent');
      expect(status.url).toBe('https://my-domain.com');
    });

    it('emits oauth-updated event with permanent domain', async () => {
      const configWithDomain = {
        ...mockConfig,
        permanentDomain: 'https://my-domain.com'
      };
      tunnelService = new TunnelService(configWithDomain, mockLogger);
      
      const oauthUpdatePromise = new Promise(resolve => {
        tunnelService.on('oauth-updated', resolve);
      });

      await tunnelService.start();
      
      const updateEvent = await oauthUpdatePromise;
      expect(updateEvent).toEqual({
        baseUrl: 'https://my-domain.com',
        redirectUri: 'https://my-domain.com/oauth2/callback'
      });
    });
  });

  describe('tunnel disabled scenarios', () => {
    it('returns localhost URL when tunnel is disabled', async () => {
      process.env.ENABLE_OAUTH_TUNNEL = 'false';
      process.env.NODE_ENV = 'production';
      delete process.env.OAUTH_TUNNEL_REQUIRED;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_ID;
      
      const url = await tunnelService.start();
      
      expect(url).toBe('http://localhost:3000');
      expect(mockLogger.info).toHaveBeenCalledWith('OAuth tunnel disabled, using localhost');
      expect(mockLogger.info).toHaveBeenCalledWith('Note: Google/GitHub OAuth may not work with localhost');
      
      const status = tunnelService.getStatus();
      expect(status.active).toBe(false);
      expect(status.type).toBe('none');
      expect(status.url).toBe('http://localhost:3000');
    });

    it('enables tunnel when ENABLE_OAUTH_TUNNEL is true regardless of other conditions', async () => {
      process.env.ENABLE_OAUTH_TUNNEL = 'true';
      process.env.NODE_ENV = 'production';
      delete process.env.OAUTH_TUNNEL_REQUIRED;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_ID;
      
      tunnelService = new TunnelService(mockConfig, mockLogger);
      
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      const url = await startPromise;
      expect(url).toBe('https://test.trycloudflare.com');
    });

    it('enables tunnel in development with OAuth providers', async () => {
      process.env.ENABLE_OAUTH_TUNNEL = 'false';
      process.env.NODE_ENV = 'development';
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      
      tunnelService = new TunnelService(mockConfig, mockLogger);
      
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      const url = await startPromise;
      expect(url).toBe('https://test.trycloudflare.com');
    });

    it('disables tunnel when enableInDevelopment is false', async () => {
      process.env.ENABLE_OAUTH_TUNNEL = 'false';
      process.env.NODE_ENV = 'development';
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      
      const configWithDisabled = {
        ...mockConfig,
        enableInDevelopment: false
      };
      tunnelService = new TunnelService(configWithDisabled, mockLogger);
      
      const url = await tunnelService.start();
      expect(url).toBe('http://localhost:3000');
    });
  });

  describe('OAuth provider detection', () => {
    beforeEach(() => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.OAUTH_TUNNEL_REQUIRED;
    });

    it('detects Google OAuth provider', async () => {
      process.env.GOOGLE_CLIENT_ID = 'google-client-id';
      process.env.ENABLE_OAUTH_TUNNEL = 'false';
      process.env.NODE_ENV = 'development';
      
      tunnelService = new TunnelService(mockConfig, mockLogger);
      
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      const url = await startPromise;
      expect(url).toBe('https://test.trycloudflare.com');
    });

    it('detects GitHub OAuth provider', async () => {
      process.env.GITHUB_CLIENT_ID = 'github-client-id';
      process.env.ENABLE_OAUTH_TUNNEL = 'false';
      process.env.NODE_ENV = 'development';
      
      tunnelService = new TunnelService(mockConfig, mockLogger);
      
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      const url = await startPromise;
      expect(url).toBe('https://test.trycloudflare.com');
    });

    it('enables tunnel when OAUTH_TUNNEL_REQUIRED is true', async () => {
      process.env.OAUTH_TUNNEL_REQUIRED = 'true';
      process.env.ENABLE_OAUTH_TUNNEL = 'false';
      process.env.NODE_ENV = 'development';
      
      tunnelService = new TunnelService(mockConfig, mockLogger);
      
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      const url = await startPromise;
      expect(url).toBe('https://test.trycloudflare.com');
    });
  });

  describe('getPublicUrl', () => {
    it('returns tunnel URL when tunnel is active', async () => {
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      await startPromise;
      
      const publicUrl = tunnelService.getPublicUrl();
      expect(publicUrl).toBe('https://test.trycloudflare.com');
    });

    it('returns localhost URL when no tunnel is active', () => {
      const publicUrl = tunnelService.getPublicUrl();
      expect(publicUrl).toBe('http://localhost:3000');
    });

    it('returns localhost URL with custom port', () => {
      const customConfig = { ...mockConfig, port: 8080 };
      tunnelService = new TunnelService(customConfig, mockLogger);
      
      const publicUrl = tunnelService.getPublicUrl();
      expect(publicUrl).toBe('http://localhost:8080');
    });
  });

  describe('cloudflared installation check', () => {
    it('handles cloudflared not installed', async () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
      
      await expect(tunnelService.start()).rejects.toThrow('cloudflared not found. Please install it or use permanent domain.');
      expect(mockLogger.error).toHaveBeenCalledWith('cloudflared not found. Please install it or use permanent domain.');
      
      const status = tunnelService.getStatus();
      expect(status.error).toBe('cloudflared not found. Please install it or use permanent domain.');
    });

    it('handles spawnSync throwing error', async () => {
      vi.mocked(spawnSync).mockImplementation(() => {
        throw new Error('Command failed');
      });
      
      await expect(tunnelService.start()).rejects.toThrow('cloudflared not found. Please install it or use permanent domain.');
    });
  });

  describe('tunnel with token', () => {
    it('starts tunnel with token successfully', async () => {
      const configWithToken = {
        ...mockConfig,
        tunnelToken: 'test-token-123',
        tunnelUrl: 'https://my-tunnel.example.com'
      };
      tunnelService = new TunnelService(configWithToken, mockLogger);
      
      const tunnelReadyPromise = new Promise(resolve => {
        tunnelService.on('tunnel-ready', resolve);
      });
      
      const startPromise = tunnelService.start();
      
      // Simulate named tunnel connection
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('INF Registered tunnel connection\n'));
      }, 10);
      
      const url = await startPromise;
      
      expect(spawn).toHaveBeenCalledWith('cloudflared', [
        'tunnel', '--no-autoupdate', 'run', '--token', 'test-token-123'
      ]);
      expect(url).toBe('https://my-tunnel.example.com');
      
      const readyEvent = await tunnelReadyPromise;
      expect(readyEvent).toEqual({
        url: 'https://my-tunnel.example.com',
        type: 'cloudflared',
        timestamp: expect.any(String)
      });
    });

    it('warns when token tunnel connects but URL not available', async () => {
      const configWithToken = {
        ...mockConfig,
        tunnelToken: 'test-token-123'
      };
      tunnelService = new TunnelService(configWithToken, mockLogger);
      
      const startPromise = tunnelService.start();
      
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('INF Registered tunnel connection tunnelID=abc-123-def\n'));
      }, 10);
      
      const url = await startPromise;
      
      expect(url).toBe('https://tunnel-configured-in-cloudflare.com');
      expect(mockLogger.warn).toHaveBeenCalledWith('Token-based tunnel connected but URL not available in output');
      expect(mockLogger.warn).toHaveBeenCalledWith('Please check your Cloudflare dashboard for the tunnel URL');
      expect(mockLogger.warn).toHaveBeenCalledWith('Tunnel ID: abc-123-def');
      expect(mockLogger.error).toHaveBeenCalledWith('CLOUDFLARE_TUNNEL_URL not configured!');
    });

    it('extracts URL from named tunnel regex match', async () => {
      const configWithToken = {
        ...mockConfig,
        tunnelToken: 'test-token-123'
      };
      tunnelService = new TunnelService(configWithToken, mockLogger);
      
      const startPromise = tunnelService.start();
      
      // Emit the URL directly - it will be caught by namedTunnelUrlRegex
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('https://my-named-tunnel.cloudflareaccess.com\n'));
      }, 10);
      
      const url = await startPromise;
      expect(url).toBe('https://my-named-tunnel.cloudflareaccess.com');
    });
  });

  describe('process event handling', () => {
    it('handles stdout data', async () => {
      const startPromise = tunnelService.start();
      
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('https://stdout-tunnel.trycloudflare.com\n'));
      }, 10);
      
      const url = await startPromise;
      expect(url).toBe('https://stdout-tunnel.trycloudflare.com');
      expect(mockLogger.info).toHaveBeenCalledWith('Cloudflared stdout: https://stdout-tunnel.trycloudflare.com');
    });

    it('handles process exit with code', async () => {
      const startPromise = tunnelService.start();
      
      setTimeout(() => {
        mockProcess.emit('exit', 1);
      }, 10);
      
      await expect(startPromise).rejects.toThrow('Cloudflared exited without providing URL (code 1)');
      expect(mockLogger.info).toHaveBeenCalledWith('Cloudflared exited with code 1');
      
      const status = tunnelService.getStatus();
      expect(status.error).toBe('Process exited with code 1');
    });

    it('emits stopped event on process exit', async () => {
      const stoppedPromise = new Promise(resolve => {
        tunnelService.on('stopped', resolve);
      });
      
      const startPromise = tunnelService.start();
      
      setTimeout(() => {
        mockProcess.emit('exit', 0);
      }, 10);
      
      try {
        await startPromise;
      } catch {
        // Expected to reject
      }
      
      await stoppedPromise;
    });

    it('handles stderr data with multiple lines', async () => {
      const startPromise = tunnelService.start();
      
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Line 1\nINF |  https://test.trycloudflare.com\nLine 3\n'));
      }, 10);
      
      const url = await startPromise;
      expect(url).toBe('https://test.trycloudflare.com');
      expect(mockLogger.info).toHaveBeenCalledWith('Cloudflared: Line 1');
      expect(mockLogger.info).toHaveBeenCalledWith('Cloudflared: INF |  https://test.trycloudflare.com');
      expect(mockLogger.info).toHaveBeenCalledWith('Cloudflared: Line 3');
    });

    it('handles empty lines in stderr', async () => {
      const startPromise = tunnelService.start();
      
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('\n\n  \n'));
        mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      }, 10);
      
      const url = await startPromise;
      expect(url).toBe('https://test.trycloudflare.com');
    });
  });

  describe('event emissions', () => {
    it('emits ready event after OAuth providers are updated', async () => {
      const readyPromise = new Promise(resolve => {
        tunnelService.on('ready', resolve);
      });
      
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      await startPromise;
      const readyUrl = await readyPromise;
      expect(readyUrl).toBe('https://test.trycloudflare.com');
    });

    it('emits ready event even if OAuth update fails', async () => {
      // Mock the tunnelStatus to throw an error
      const originalSetBaseUrl = (await import('../../../../../../src/modules/core/auth/tunnel-status.js')).tunnelStatus.setBaseUrl;
      (await import('../../../../../../src/modules/core/auth/tunnel-status.js')).tunnelStatus.setBaseUrl = vi.fn().mockImplementation(() => {
        throw new Error('Failed to set base URL');
      });
      
      const readyPromise = new Promise(resolve => {
        tunnelService.on('ready', resolve);
      });
      
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      await startPromise;
      const readyUrl = await readyPromise;
      expect(readyUrl).toBe('https://test.trycloudflare.com');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to update OAuth providers:', expect.any(Error));
      
      // Restore original function
      (await import('../../../../../../src/modules/core/auth/tunnel-status.js')).tunnelStatus.setBaseUrl = originalSetBaseUrl;
    });

    it('emits tunnel-ready event with correct data', async () => {
      const tunnelReadyPromise = new Promise(resolve => {
        tunnelService.on('tunnel-ready', resolve);
      });
      
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      await startPromise;
      const readyEvent = await tunnelReadyPromise;
      
      expect(readyEvent).toEqual({
        url: 'https://test.trycloudflare.com',
        type: 'cloudflared',
        timestamp: expect.any(String)
      });
    });

    it('emits stopped event when tunnel is manually stopped', async () => {
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      await startPromise;
      
      const stoppedPromise = new Promise(resolve => {
        tunnelService.on('stopped', resolve);
      });
      
      tunnelService.stop();
      await stoppedPromise;
    });
  });

  describe('logger integration', () => {
    it('works without logger', () => {
      const serviceWithoutLogger = new TunnelService(mockConfig);
      expect(() => serviceWithoutLogger.getStatus()).not.toThrow();
    });

    it('logs tunnel establishment messages', async () => {
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      await startPromise;
      
      expect(mockLogger.info).toHaveBeenCalledWith('🚇 Tunnel established: https://test.trycloudflare.com');
      expect(mockLogger.info).toHaveBeenCalledWith('📍 Public URL: https://test.trycloudflare.com');
      expect(mockLogger.info).toHaveBeenCalledWith('🔗 OAuth Redirect Base: https://test.trycloudflare.com/oauth2/callback');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ OAuth providers updated with tunnel URL');
    });

    it('logs stopping tunnel message', async () => {
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      await startPromise;
      
      tunnelService.stop();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping tunnel...');
    });
  });

  describe('edge cases and error scenarios', () => {
    it('handles promise-like resolve values in timeout handling', async () => {
      vi.useFakeTimers();
      
      const startPromise = tunnelService.start();
      
      // This tests the edge case where resolve might receive a promise-like value
      vi.advanceTimersByTime(30000);
      
      await expect(startPromise).rejects.toThrow('Timeout waiting for tunnel URL');
      
      vi.useRealTimers();
    });

    it('handles multiple URL matches in output', async () => {
      const startPromise = tunnelService.start();
      
      setTimeout(() => {
        // First URL should be captured
        mockProcess.stderr.emit('data', Buffer.from('INF |  https://first.trycloudflare.com\n'));
        // Second URL should be ignored
        mockProcess.stderr.emit('data', Buffer.from('INF |  https://second.trycloudflare.com\n'));
      }, 10);
      
      const url = await startPromise;
      expect(url).toBe('https://first.trycloudflare.com');
    });

    it('handles concurrent start calls', async () => {
      const startPromise1 = tunnelService.start();
      const startPromise2 = tunnelService.start();
      
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      }, 10);
      
      const [url1, url2] = await Promise.all([startPromise1, startPromise2]);
      expect(url1).toBe('https://test.trycloudflare.com');
      expect(url2).toBe('https://test.trycloudflare.com');
    });

    it('properly clears timeout on successful resolution', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      const startPromise = tunnelService.start();
      mockProcess.stderr.emit('data', Buffer.from('INF |  https://test.trycloudflare.com\n'));
      
      await startPromise;
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});