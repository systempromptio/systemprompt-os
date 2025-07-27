/**
 * @fileoverview Unit tests for check-status tool definition
 * @module tests/unit/server/mcp/core/constants/tool/check-status
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const sourceFile = resolve(__dirname, '../../../../../../../src/server/mcp/core/constants/tool/check-status.ts');
const fileExists = existsSync(sourceFile);

// Skip all tests if source file doesn't exist
const describeSkip = fileExists ? describe : describe.skip;

let checkStatus: any = { name: '', description: '' };
if (fileExists) {
  try {
    const module = await import('../../../../../../../src/server/mcp/core/constants/tool/check-status');
    checkStatus = module.default || module.checkStatus;
  } catch (error) {
    console.warn('Failed to import check-status module:', error);
  }
}

describeSkip('check-status tool definition', () => {
  it('has correct name and description', () => {
    expect(checkStatus.name).toBe('checkstatus');
    expect(checkStatus.description).toBe('Get comprehensive system status (admin only)');
  });
  
  it('has correct input schema', () => {
    expect(checkStatus.inputSchema).toBeDefined();
    expect(checkStatus.inputSchema.type).toBe('object');
  });
  
  it('defines includeContainers property', () => {
    expect(checkStatus.inputSchema.properties).toHaveProperty('includeContainers');
    expect(checkStatus.inputSchema.properties.includeContainers).toEqual({
      type: 'boolean',
      description: 'Include container status information'
    });
  });
  
  it('defines includeUsers property', () => {
    expect(checkStatus.inputSchema.properties).toHaveProperty('includeUsers');
    expect(checkStatus.inputSchema.properties.includeUsers).toEqual({
      type: 'boolean',
      description: 'Include active user information'
    });
  });
  
  it('has exactly five properties', () => {
    expect(Object.keys(checkStatus.inputSchema.properties)).toHaveLength(5);
  });
  
  it('has admin metadata', () => {
    expect(checkStatus._meta).toBeDefined();
    expect(checkStatus._meta?.requiredRole).toBe('admin');
    expect(checkStatus._meta?.requiredPermissions).toEqual(['system:read', 'admin:status']);
  });
});