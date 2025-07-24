/**
 * @fileoverview Unit tests for task status constants
 * @module tests/unit/server/mcp/core/constants/task-status
 */

import { describe, it, expect } from 'vitest';
import { 
  TaskStatus, 
  TaskStatusType, 
  TERMINALSTATUSES, 
  ACTIVESTATUSES 
} from '../../../../../../src/server/mcp/core/constants/task-status.js';

describe('task-status constants', () => {
  describe('TaskStatus', () => {
    it('defines all expected status values', () => {
      expect(TaskStatus.PENDING).toBe('pending');
      expect(TaskStatus.INPROGRESS).toBe('inprogress');
      expect(TaskStatus.WAITING).toBe('waiting');
      expect(TaskStatus.COMPLETED).toBe('completed');
      expect(TaskStatus.FAILED).toBe('failed');
      expect(TaskStatus.CANCELLED).toBe('cancelled');
    });
    
    it('has correct number of statuses', () => {
      expect(Object.keys(TaskStatus)).toHaveLength(6);
    });
    
    it('status values are unique', () => {
      const values = Object.values(TaskStatus);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });
  
  describe('TERMINALSTATUSES', () => {
    it('contains correct terminal statuses', () => {
      expect(TERMINALSTATUSES).toEqual([
        'completed',
        'failed',
        'cancelled'
      ]);
    });
    
    it('all terminal statuses exist in TaskStatus', () => {
      TERMINALSTATUSES.forEach(status => {
        expect(Object.values(TaskStatus)).toContain(status);
      });
    });
  });
  
  describe('ACTIVESTATUSES', () => {
    it('contains correct active statuses', () => {
      expect(ACTIVESTATUSES).toEqual([
        'pending',
        'inprogress',
        'waiting'
      ]);
    });
    
    it('all active statuses exist in TaskStatus', () => {
      ACTIVESTATUSES.forEach(status => {
        expect(Object.values(TaskStatus)).toContain(status);
      });
    });
  });
  
  describe('status categories', () => {
    it('terminal and active statuses are mutually exclusive', () => {
      const terminalSet = new Set(TERMINALSTATUSES);
      const activeSet = new Set(ACTIVESTATUSES);
      
      TERMINALSTATUSES.forEach(status => {
        expect(activeSet.has(status)).toBe(false);
      });
      
      ACTIVESTATUSES.forEach(status => {
        expect(terminalSet.has(status)).toBe(false);
      });
    });
    
    it('all statuses are categorized', () => {
      const allCategorized = [...TERMINALSTATUSES, ...ACTIVESTATUSES];
      const allStatuses = Object.values(TaskStatus);
      
      expect(allCategorized.sort()).toEqual(allStatuses.sort());
    });
  });
  
  describe('TaskStatusType', () => {
    it('type can be used for type checking', () => {
      const validStatus: TaskStatusType = TaskStatus.PENDING;
      expect(validStatus).toBe('pending');
      
      // Test that all TaskStatus values are valid TaskStatusType
      Object.values(TaskStatus).forEach(status => {
        const typedStatus: TaskStatusType = status;
        expect(typedStatus).toBe(status);
      });
    });
  });
});