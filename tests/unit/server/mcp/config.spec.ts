/**
 * @fileoverview Unit tests for MCP server configuration
 * @module tests/unit/server/mcp
 */

import { describe, it, expect, vi } from 'vitest';
import { serverConfig, serverCapabilities } from '@/server/mcp/config.js';
import { CONFIG } from '@/server/config.js';

vi.mock('@/server/config.js', () => ({
  CONFIG: {
    SERVERNAME: 'test-server',
    SERVERVERSION: '1.0.0'
  }
}));

describe('MCP Server Config', () => {
  describe('serverConfig', () => {
    it('should contain server name from CONFIG', () => {
      expect(serverConfig.name).toBe('test-server');
    });

    it('should contain server version from CONFIG', () => {
      expect(serverConfig.version).toBe('1.0.0');
    });

    it('should have correct structure', () => {
      expect(serverConfig).toHaveProperty('name');
      expect(serverConfig).toHaveProperty('version');
      expect(typeof serverConfig.name).toBe('string');
      expect(typeof serverConfig.version).toBe('string');
    });
  });

  describe('serverCapabilities', () => {
    it('should have capabilities property', () => {
      expect(serverCapabilities).toHaveProperty('capabilities');
    });

    it('should declare all required MCP capabilities', () => {
      const { capabilities } = serverCapabilities;
      
      expect(capabilities).toHaveProperty('tools');
      expect(capabilities).toHaveProperty('sampling');
      expect(capabilities).toHaveProperty('prompts');
      expect(capabilities).toHaveProperty('resources');
      expect(capabilities).toHaveProperty('logging');
    });

    it('should have empty capability objects', () => {
      const { capabilities } = serverCapabilities;
      
      expect(capabilities.tools).toEqual({});
      expect(capabilities.sampling).toEqual({});
      expect(capabilities.prompts).toEqual({});
      expect(capabilities.resources).toEqual({});
      expect(capabilities.logging).toEqual({});
    });

    it('should match MCP specification structure', () => {
      expect(serverCapabilities.capabilities).toBeDefined();
      expect(typeof serverCapabilities.capabilities).toBe('object');
    });
  });
});