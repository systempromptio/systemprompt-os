/**
 * @fileoverview Unit tests for clean-state tool definition
 * @module tests/unit/server/mcp/core/constants/tool/clean-state
 */

import { describe, it, expect } from 'vitest';
import cleanState from '../../../../../../../src/server/mcp/core/constants/tool/clean-state';

describe('clean-state tool definition', () => {
  it('has correct name and description', () => {
    expect(cleanState.name).toBe('cleanstate');
    expect(cleanState.description).toBe('Clean up old state');
  });
  
  it('has correct input schema', () => {
    expect(cleanState.inputSchema).toBeDefined();
    expect(cleanState.inputSchema.type).toBe('object');
  });
  
  it('defines keeprecent property', () => {
    expect(cleanState.inputSchema.properties).toHaveProperty('keeprecent');
    expect(cleanState.inputSchema.properties.keeprecent).toEqual({
      type: 'boolean'
    });
  });
  
  it('defines dryrun property', () => {
    expect(cleanState.inputSchema.properties).toHaveProperty('dryrun');
    expect(cleanState.inputSchema.properties.dryrun).toEqual({
      type: 'boolean'
    });
  });
  
  it('has exactly two properties', () => {
    expect(Object.keys(cleanState.inputSchema.properties)).toHaveLength(2);
  });
  
  it('exports the tool definition as default', () => {
    expect(cleanState).toBe(cleanState);
  });
});