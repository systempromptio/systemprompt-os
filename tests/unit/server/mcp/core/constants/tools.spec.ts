/**
 * @fileoverview Unit tests for tools constants
 * @module tests/unit/server/mcp/core/constants/tools
 */

import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../../../../../src/server/mcp/core/constants/tools';

describe('tools constants', () => {
  describe('TOOLS array', () => {
    it('is defined as an empty array', () => {
      expect(TOOLS).toBeDefined();
      expect(Array.isArray(TOOLS)).toBe(true);
      expect(TOOLS).toHaveLength(0);
    });
    
    it('is of correct type', () => {
      // Even though empty, verify it's the right type of array
      expect(TOOLS).toEqual([]);
    });
  });
});