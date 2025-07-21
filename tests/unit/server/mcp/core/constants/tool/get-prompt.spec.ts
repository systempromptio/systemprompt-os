/**
 * @fileoverview Unit tests for get-prompt tool definition
 * @module tests/unit/server/mcp/core/constants/tool/get-prompt
 */

import { describe, it, expect } from 'vitest';
import getPrompt from '../../../../../../../src/server/mcp/core/constants/tool/get-prompt';

describe('get-prompt tool definition', () => {
  it('has correct name and description', () => {
    expect(getPrompt.name).toBe('getprompt');
    expect(getPrompt.description).toBe('Get prompt template');
  });
  
  it('has correct input schema', () => {
    expect(getPrompt.inputSchema).toBeDefined();
    expect(getPrompt.inputSchema.type).toBe('object');
  });
  
  it('defines templatename property', () => {
    expect(getPrompt.inputSchema.properties).toHaveProperty('templatename');
    expect(getPrompt.inputSchema.properties.templatename).toEqual({
      type: 'string'
    });
  });
  
  it('has templatename as required property', () => {
    expect(getPrompt.inputSchema.required).toBeDefined();
    expect(getPrompt.inputSchema.required).toEqual(['templatename']);
  });
  
  it('has exactly one property', () => {
    expect(Object.keys(getPrompt.inputSchema.properties)).toHaveLength(1);
  });
  
  it('exports the tool definition as default', () => {
    expect(getPrompt).toBe(getPrompt);
  });
});