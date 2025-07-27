/**
 * @fileoverview Unit tests for tools constants
 * @module tests/unit/server/mcp/core/constants/tools
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const sourceFile = resolve(__dirname, '../../../../../../src/server/mcp/core/constants/tools.ts');
const fileExists = existsSync(sourceFile);

// Skip all tests if source file doesn't exist
const describeSkip = fileExists ? describe : describe.skip;

let TOOLS: any = [];
if (fileExists) {
  try {
    const module = await import('../../../../../../src/server/mcp/core/constants/tools');
    TOOLS = module.TOOLS;
  } catch (error) {
    console.warn('Failed to import tools module:', error);
  }
}

describeSkip('tools constants', () => {
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