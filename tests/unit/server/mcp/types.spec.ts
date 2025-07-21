/**
 * @fileoverview Unit tests for MCP types
 * @module tests/unit/server/mcp
 */

import { describe, it, expect } from 'vitest';
import { MCPServerType } from '@/server/mcp/types.js';

describe('MCP Types', () => {
  describe('MCPServerType Enum', () => {
    it('should have correct server type values', () => {
      expect(MCPServerType.LOCAL).toBe('local');
      expect(MCPServerType.REMOTE).toBe('remote');
    });

    it('should have all expected enum keys', () => {
      const expectedKeys = ['LOCAL', 'REMOTE'];
      const actualKeys = Object.keys(MCPServerType).filter(k => isNaN(Number(k)));
      expect(actualKeys).toEqual(expectedKeys);
    });

    it('should have correct string values', () => {
      expect(MCPServerType.LOCAL).toBe('local');
      expect(MCPServerType.REMOTE).toBe('remote');
    });

    it('should be usable in type guards', () => {
      const serverType: string = 'local';
      expect(Object.values(MCPServerType)).toContain(serverType);
    });
  });
});