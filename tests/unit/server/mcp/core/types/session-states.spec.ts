/**
 * @fileoverview Unit tests for session states
 * @module tests/unit/server/mcp/core/types
 */

import { describe, it, expect } from 'vitest';
import { SessionStates } from '@/server/mcp/core/types/session-states.js';
import type { SessionState } from '@/server/mcp/core/types/session-states.js';

describe('Session States', () => {
  it('should have correct state values', () => {
    expect(SessionStates.IDLE).toBe('idle');
    expect(SessionStates.ACTIVE).toBe('active');
    expect(SessionStates.WAITING).toBe('waiting');
    expect(SessionStates.COMPLETED).toBe('completed');
    expect(SessionStates.FAILED).toBe('failed');
  });

  it('should have all expected state keys', () => {
    const expectedKeys = ['IDLE', 'ACTIVE', 'WAITING', 'COMPLETED', 'FAILED'];
    const actualKeys = Object.keys(SessionStates);
    expect(actualKeys).toEqual(expectedKeys);
  });

  it('should be a const object', () => {
    // Test that the object has the expected const assertion behavior
    const testValue: typeof SessionStates.IDLE = 'idle';
    expect(testValue).toBe(SessionStates.IDLE);
    
    // Verify it's a plain object with string values
    expect(typeof SessionStates).toBe('object');
    expect(typeof SessionStates.IDLE).toBe('string');
  });

  it('should work with SessionState type', () => {
    const testState: SessionState = 'active';
    expect(Object.values(SessionStates)).toContain(testState);
  });

  it('should have unique values', () => {
    const values = Object.values(SessionStates);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});