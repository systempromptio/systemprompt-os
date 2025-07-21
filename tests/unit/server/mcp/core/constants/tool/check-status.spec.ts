/**
 * @fileoverview Unit tests for check-status tool definition
 * @module tests/unit/server/mcp/core/constants/tool/check-status
 */

import { describe, it, expect } from 'vitest';
import checkStatus from '../../../../../../../src/server/mcp/core/constants/tool/check-status';

describe('check-status tool definition', () => {
  it('has correct name and description', () => {
    expect(checkStatus.name).toBe('checkstatus');
    expect(checkStatus.description).toBe('Check system status');
  });
  
  it('has correct input schema', () => {
    expect(checkStatus.inputSchema).toBeDefined();
    expect(checkStatus.inputSchema.type).toBe('object');
  });
  
  it('defines testsessions property', () => {
    expect(checkStatus.inputSchema.properties).toHaveProperty('testsessions');
    expect(checkStatus.inputSchema.properties.testsessions).toEqual({
      type: 'boolean'
    });
  });
  
  it('defines verbose property', () => {
    expect(checkStatus.inputSchema.properties).toHaveProperty('verbose');
    expect(checkStatus.inputSchema.properties.verbose).toEqual({
      type: 'boolean'
    });
  });
  
  it('has exactly two properties', () => {
    expect(Object.keys(checkStatus.inputSchema.properties)).toHaveLength(2);
  });
  
  it('exports the tool definition as default', () => {
    expect(checkStatus).toBe(checkStatus);
  });
});