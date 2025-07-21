/**
 * @fileoverview Unit tests for end-task tool definition
 * @module tests/unit/server/mcp/core/constants/tool/end-task
 */

import { describe, it, expect } from 'vitest';
import endTask from '../../../../../../../src/server/mcp/core/constants/tool/end-task';

describe('end-task tool definition', () => {
  it('has correct name and description', () => {
    expect(endTask.name).toBe('endtask');
    expect(endTask.description).toBe('End a task');
  });
  
  it('has correct input schema', () => {
    expect(endTask.inputSchema).toBeDefined();
    expect(endTask.inputSchema.type).toBe('object');
  });
  
  it('defines taskid property', () => {
    expect(endTask.inputSchema.properties).toHaveProperty('taskid');
    expect(endTask.inputSchema.properties.taskid).toEqual({
      type: 'string'
    });
  });
  
  it('defines status property', () => {
    expect(endTask.inputSchema.properties).toHaveProperty('status');
    expect(endTask.inputSchema.properties.status).toEqual({
      type: 'string'
    });
  });
  
  it('has taskid as required property', () => {
    expect(endTask.inputSchema.required).toBeDefined();
    expect(endTask.inputSchema.required).toEqual(['taskid']);
  });
  
  it('has exactly two properties', () => {
    expect(Object.keys(endTask.inputSchema.properties)).toHaveLength(2);
  });
  
  it('exports the tool definition as default', () => {
    expect(endTask).toBe(endTask);
  });
});