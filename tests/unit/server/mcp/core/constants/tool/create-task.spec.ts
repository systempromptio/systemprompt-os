/**
 * @fileoverview Unit tests for create-task tool definition
 * @module tests/unit/server/mcp/core/constants/tool/create-task
 */

import { describe, it, expect } from 'vitest';
import createTask from '../../../../../../../src/server/mcp/core/constants/tool/create-task';

describe('create-task tool definition', () => {
  it('has correct name and description', () => {
    expect(createTask.name).toBe('createtask');
    expect(createTask.description).toBe('Create a new task');
  });
  
  it('has correct input schema', () => {
    expect(createTask.inputSchema).toBeDefined();
    expect(createTask.inputSchema.type).toBe('object');
  });
  
  it('defines title property', () => {
    expect(createTask.inputSchema.properties).toHaveProperty('title');
    expect(createTask.inputSchema.properties.title).toEqual({
      type: 'string'
    });
  });
  
  it('defines description property', () => {
    expect(createTask.inputSchema.properties).toHaveProperty('description');
    expect(createTask.inputSchema.properties.description).toEqual({
      type: 'string'
    });
  });
  
  it('defines tool property', () => {
    expect(createTask.inputSchema.properties).toHaveProperty('tool');
    expect(createTask.inputSchema.properties.tool).toEqual({
      type: 'string'
    });
  });
  
  it('defines instructions property', () => {
    expect(createTask.inputSchema.properties).toHaveProperty('instructions');
    expect(createTask.inputSchema.properties.instructions).toEqual({
      type: 'string'
    });
  });
  
  it('has title as required property', () => {
    expect(createTask.inputSchema.required).toBeDefined();
    expect(createTask.inputSchema.required).toEqual(['title']);
  });
  
  it('has exactly four properties', () => {
    expect(Object.keys(createTask.inputSchema.properties)).toHaveLength(4);
  });
  
  it('exports the tool definition as default', () => {
    expect(createTask).toBe(createTask);
  });
});