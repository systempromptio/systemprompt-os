/**
 * @fileoverview Unit tests for tunnel CLI commands
 * @module tests/unit/modules/core/auth/cli/tunnel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tunnelStatus, startTunnel, setupDomain } from '../../../../../../src/modules/core/auth/cli/tunnel';
import { getAuthModule } from '../../../../../../src/modules/core/auth/singleton';

// Mock the singleton
vi.mock('../../../../../../src/modules/core/auth/singleton', () => ({
  getAuthModule: vi.fn()
}));

describe('tunnel CLI commands', () => {
  let mockAuthModule: any;
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalProcessExit: any;
  let consoleOutput: string[] = [];
  let consoleErrorOutput: string[] = [];
  
  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    consoleErrorOutput = [];
    
    // Mock console
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = vi.fn((...args) => consoleOutput.push(args.join(' ')));
    console.error = vi.fn((...args) => consoleErrorOutput.push(args.join(' ')));
    
    // Mock process.exit
    originalProcessExit = process.exit;
    process.exit = vi.fn(() => {
      throw new Error('Process exited');
    }) as any;
    
    // Mock auth module
    mockAuthModule = {
      getTunnelStatus: vi.fn(),
      getPublicUrl: vi.fn(),
      initialize: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    
    vi.mocked(getAuthModule).mockReturnValue(mockAuthModule);
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });
  
  describe('tunnelStatus', () => {
    it('displays inactive tunnel status', async () => {
      mockAuthModule.getTunnelStatus.mockReturnValue({
        active: false,
        type: 'none'
      });
      mockAuthModule.getPublicUrl.mockReturnValue('http://localhost:3000');
      
      await tunnelStatus();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('OAuth Tunnel Status');
      expect(output).toContain('Status: ❌ Inactive');
      expect(output).toContain('Type: none');
      expect(output).toContain('Base URL: http://localhost:3000');
      expect(output).toContain('OAuth Redirect URI: http://localhost:3000/oauth2/callback');
      expect(output).toContain('Tips');
    });
    
    it('displays active cloudflared tunnel status', async () => {
      mockAuthModule.getTunnelStatus.mockReturnValue({
        active: true,
        type: 'cloudflared',
        url: 'https://test.trycloudflare.com'
      });
      mockAuthModule.getPublicUrl.mockReturnValue('https://test.trycloudflare.com');
      
      await tunnelStatus();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Status: ✅ Active');
      expect(output).toContain('Type: cloudflared');
      expect(output).toContain('Public URL: https://test.trycloudflare.com');
      expect(output).toContain('Provider Configuration');
      expect(output).toContain('Google: https://test.trycloudflare.com/oauth2/callback/google');
      expect(output).toContain('GitHub: https://test.trycloudflare.com/oauth2/callback/github');
      expect(output).toContain('Note: For Google OAuth');
    });
    
    it('displays tunnel error if present', async () => {
      mockAuthModule.getTunnelStatus.mockReturnValue({
        active: false,
        type: 'none',
        error: 'Failed to start tunnel'
      });
      mockAuthModule.getPublicUrl.mockReturnValue('http://localhost:3000');
      
      await tunnelStatus();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Error: Failed to start tunnel');
    });
  });
  
  describe('startTunnel', () => {
    it('starts tunnel successfully', async () => {
      mockAuthModule.initialize.mockResolvedValue(undefined);
      mockAuthModule.start.mockResolvedValue(undefined);
      mockAuthModule.getTunnelStatus.mockReturnValue({
        active: true,
        url: 'https://test.trycloudflare.com'
      });
      
      await startTunnel();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Starting OAuth tunnel...');
      expect(output).toContain('Tunnel started successfully!');
      expect(output).toContain('Public URL: https://test.trycloudflare.com');
      expect(output).toContain('Next steps:');
      expect(output).toContain('Google: https://test.trycloudflare.com/oauth2/callback/google');
      expect(mockAuthModule.initialize).toHaveBeenCalledWith({ logger: console });
      expect(mockAuthModule.start).toHaveBeenCalled();
    });
    
    it('handles tunnel start errors', async () => {
      mockAuthModule.initialize.mockRejectedValue(new Error('Cloudflared not installed'));
      
      await expect(startTunnel()).rejects.toThrow('Process exited');
      
      const output = consoleOutput.join('\n');
      const errorOutput = consoleErrorOutput.join('\n');
      expect(output).toContain('Starting OAuth tunnel...');
      expect(errorOutput).toContain('Failed to start tunnel: Error: Cloudflared not installed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
    
    it('displays error when tunnel does not start', async () => {
      mockAuthModule.initialize.mockResolvedValue(undefined);
      mockAuthModule.start.mockResolvedValue(undefined);
      mockAuthModule.getTunnelStatus.mockReturnValue({
        active: false,
        error: 'Failed to bind port'
      });
      
      await startTunnel();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Tunnel did not start');
      expect(output).toContain('Error: Failed to bind port');
    });
  });
  
  describe('setupDomain', () => {
    it('displays setup instructions', async () => {
      await setupDomain();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Setting Up a Permanent Domain for OAuth');
      expect(output).toContain('Option 1: Use Cloudflare Tunnel (Recommended)');
      expect(output).toContain('cloudflared tunnel login');
      expect(output).toContain('cloudflared tunnel create systemprompt-oauth');
      expect(output).toContain('Create a config file');
      expect(output).toContain('OAUTH_DOMAIN=https://oauth.yourdomain.com');
      expect(output).toContain('Option 2: Use a Reverse Proxy');
      expect(output).toContain('nginx/caddy');
      expect(output).toContain('Let\'s Encrypt');
    });
  });
});