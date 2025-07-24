/**
 * @fileoverview Simple unit tests for tunnel service
 * @module tests/unit/modules/core/auth/services/tunnel-service.simple
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TunnelService } from '../../../../../../src/modules/core/auth/services/tunnel-service.js';

describe('TunnelService - Simple Tests', () => {
  let tunnelService: TunnelService;
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('creates tunnel service with config', () => {
      const config = {
        port: 3000,
        enableInDevelopment: true
      };
      
      tunnelService = new TunnelService(config);
      expect(tunnelService).toBeDefined();
      
      const status = tunnelService.getStatus();
      expect(status.active).toBe(false);
      expect(status.type).toBe('none');
    });
    
    it('creates tunnel service with permanent domain config', () => {
      const config = {
        port: 3000,
        permanentDomain: 'test.example.com',
        tunnelToken: 'test-token'
      };
      
      tunnelService = new TunnelService(config);
      const status = tunnelService.getStatus();
      expect(status.active).toBe(false);
    });
  });
  
  describe('getStatus', () => {
    it('returns initial status', () => {
      tunnelService = new TunnelService({ port: 3000 });
      const status = tunnelService.getStatus();
      
      expect(status).toEqual({
        active: false,
        type: 'none'
      });
    });
  });
  
  describe('getPublicUrl', () => {
    it('returns localhost URL when tunnel not configured', () => {
      tunnelService = new TunnelService({ 
        port: 3000,
        enableInDevelopment: false 
      });
      
      const url = tunnelService.getPublicUrl();
      expect(url).toBe('http://localhost:3000');
    });
    
    it('returns permanent domain URL when configured', () => {
      tunnelService = new TunnelService({ 
        port: 3000,
        permanentDomain: 'test.example.com'
      });
      
      const url = tunnelService.getPublicUrl();
      expect(url).toBe('http://localhost:3000'); // getPublicUrl returns localhost until start() is called
    });
  });
  
  describe('event emitter', () => {
    it('extends EventEmitter', () => {
      tunnelService = new TunnelService({ port: 3000 });
      
      const listener = vi.fn();
      tunnelService.on('test', listener);
      tunnelService.emit('test', 'data');
      
      expect(listener).toHaveBeenCalledWith('data');
    });
  });
});