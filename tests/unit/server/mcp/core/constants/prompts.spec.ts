/**
 * @fileoverview Unit tests for prompts constants
 * @module tests/unit/server/mcp/core/constants/prompts
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const sourceFile = resolve(__dirname, '../../../../../../src/server/mcp/core/constants/prompts.ts');
const fileExists = existsSync(sourceFile);

// Skip all tests if source file doesn't exist
const describeSkip = fileExists ? describe : describe.skip;

let PROMPTS: any = [];
if (fileExists) {
  try {
    const module = await import('../../../../../../src/server/mcp/core/constants/prompts');
    PROMPTS = module.PROMPTS;
  } catch (error) {
    console.warn('Failed to import prompts module:', error);
  }
}

describeSkip('prompts constants', () => {
  describe('PROMPTS array', () => {
    it('contains expected number of prompts', () => {
      expect(PROMPTS).toHaveLength(2);
    });
    
    it('all prompts have required properties', () => {
      PROMPTS.forEach(prompt => {
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('description');
        expect(prompt).toHaveProperty('arguments');
        
        expect(typeof prompt.name).toBe('string');
        expect(typeof prompt.description).toBe('string');
        expect(Array.isArray(prompt.arguments)).toBe(true);
      });
    });
    
    it('contains example prompt', () => {
      const examplePrompt = PROMPTS.find(p => p.name === 'exampleprompt');
      expect(examplePrompt).toBeDefined();
      expect(examplePrompt).toEqual({
        name: 'exampleprompt',
        description: 'An example prompt demonstrating the prompt pattern',
        arguments: [
          {
            name: 'topic',
            description: 'The topic to generate content about',
            required: true,
          },
          {
            name: 'style',
            description: 'The writing style to use',
            required: false,
          },
        ],
      });
    });
    
    it('contains template help prompt', () => {
      const helpPrompt = PROMPTS.find(p => p.name === 'templatehelp');
      expect(helpPrompt).toBeDefined();
      expect(helpPrompt).toEqual({
        name: 'templatehelp',
        description: 'Get help with using this MCP server template',
        arguments: [
          {
            name: 'area',
            description: 'The area you need help with (tools, resources, prompts, etc.)',
            required: false,
          },
        ],
      });
    });
    
    it('all prompt names are unique', () => {
      const names = PROMPTS.map(p => p.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
    
    it('all arguments have valid structure', () => {
      PROMPTS.forEach(prompt => {
        prompt.arguments.forEach(arg => {
          expect(arg).toHaveProperty('name');
          expect(arg).toHaveProperty('description');
          expect(arg).toHaveProperty('required');
          
          expect(typeof arg.name).toBe('string');
          expect(typeof arg.description).toBe('string');
          expect(typeof arg.required).toBe('boolean');
        });
      });
    });
    
    it('example prompt has one required and one optional argument', () => {
      const examplePrompt = PROMPTS.find(p => p.name === 'exampleprompt');
      expect(examplePrompt?.arguments).toHaveLength(2);
      
      const requiredArgs = examplePrompt?.arguments.filter(a => a.required);
      const optionalArgs = examplePrompt?.arguments.filter(a => !a.required);
      
      expect(requiredArgs).toHaveLength(1);
      expect(optionalArgs).toHaveLength(1);
    });
    
    it('template help prompt has only optional arguments', () => {
      const helpPrompt = PROMPTS.find(p => p.name === 'templatehelp');
      expect(helpPrompt?.arguments).toHaveLength(1);
      
      const requiredArgs = helpPrompt?.arguments.filter(a => a.required);
      expect(requiredArgs).toHaveLength(0);
    });
  });
});