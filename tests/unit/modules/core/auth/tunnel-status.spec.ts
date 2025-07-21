/**
 * @fileoverview Unit tests for tunnel status singleton
 * @module tests/unit/modules/core/auth/tunnel-status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tunnelStatus } from '../../../../../src/modules/core/auth/tunnel-status';

describe('TunnelStatus', () => {
  let originalConsoleLog: any;
  let consoleOutput: string[] = [];
  
  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    
    // Mock console.log
    originalConsoleLog = console.log;
    console.log = vi.fn((...args) => consoleOutput.push(args.join(' ')));
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
  });
  
  describe('singleton pattern', () => {
    it('returns the same instance', () => {
      const instance1 = tunnelStatus;
      const instance2 = tunnelStatus;
      
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('setBaseUrl', () => {
    it('sets the base URL and logs the update', () => {
      const testUrl = 'https://test.example.com';
      
      tunnelStatus.setBaseUrl(testUrl);
      
      expect(tunnelStatus.getBaseUrl()).toBe(testUrl);
      expect(consoleOutput).toContain(`[TunnelStatus] Base URL updated to: ${testUrl}`);
    });
    
    it('updates existing URL', () => {
      consoleOutput = []; // Clear any previous logs
      tunnelStatus.setBaseUrl('https://old.example.com');
      tunnelStatus.setBaseUrl('https://new.example.com');
      
      expect(tunnelStatus.getBaseUrl()).toBe('https://new.example.com');
      expect(consoleOutput.filter(log => log.includes('[TunnelStatus]'))).toHaveLength(2);
    });
    
    it('can set URL to null', () => {
      consoleOutput = []; // Clear any previous logs
      tunnelStatus.setBaseUrl('https://test.example.com');
      tunnelStatus.setBaseUrl(null as any);
      
      expect(tunnelStatus.getBaseUrl()).toBe(null);
      const logs = consoleOutput.filter(log => log.includes('[TunnelStatus]'));
      expect(logs[logs.length - 1]).toContain('[TunnelStatus] Base URL updated to: null');
    });
  });
  
  describe('getBaseUrl', () => {
    it('returns null when not set', () => {
      expect(tunnelStatus.getBaseUrl()).toBe(null);
    });
    
    it('returns the set URL', () => {
      const testUrl = 'https://tunnel.trycloudflare.com';
      tunnelStatus.setBaseUrl(testUrl);
      
      expect(tunnelStatus.getBaseUrl()).toBe(testUrl);
    });
  });
  
  describe('getBaseUrlOrDefault', () => {
    it('returns default URL when base URL is not set', () => {
      // Ensure base URL is null
      tunnelStatus.setBaseUrl(null as any);
      const defaultUrl = 'http://localhost:3000';
      
      expect(tunnelStatus.getBaseUrlOrDefault(defaultUrl)).toBe(defaultUrl);
    });
    
    it('returns base URL when set', () => {
      const baseUrl = 'https://oauth.example.com';
      const defaultUrl = 'http://localhost:3000';
      
      tunnelStatus.setBaseUrl(baseUrl);
      
      expect(tunnelStatus.getBaseUrlOrDefault(defaultUrl)).toBe(baseUrl);
    });
    
    it('returns base URL even when default is provided', () => {
      tunnelStatus.setBaseUrl('https://tunnel.url');
      
      expect(tunnelStatus.getBaseUrlOrDefault('http://default.url')).toBe('https://tunnel.url');
    });
  });
  
  describe('state persistence', () => {
    it('maintains state across multiple operations', () => {
      const url1 = 'https://first.example.com';
      const url2 = 'https://second.example.com';
      
      tunnelStatus.setBaseUrl(url1);
      expect(tunnelStatus.getBaseUrl()).toBe(url1);
      
      tunnelStatus.setBaseUrl(url2);
      expect(tunnelStatus.getBaseUrl()).toBe(url2);
      expect(tunnelStatus.getBaseUrlOrDefault('http://default')).toBe(url2);
    });
  });
});