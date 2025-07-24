/**
 * @fileoverview Unit tests for React Components Prompts
 * @module tests/unit/server/mcp/core/handlers/prompts/react-components
 */

import { describe, it, expect } from 'vitest';
import { CREATEREACT_COMPONENT_PROMPT, REACTCOMPONENT_PROMPTS } from '../../../../../../../src/server/mcp/core/handlers/prompts/react-components.js';

describe('React Components Prompts', () => {
  describe('CREATEREACT_COMPONENT_PROMPT', () => {
    it('should have correct structure', () => {
      expect(CREATEREACT_COMPONENT_PROMPT).toHaveProperty('name', 'createreact_component');
      expect(CREATEREACT_COMPONENT_PROMPT).toHaveProperty('description', 'Create a new React component with specified functionality');
      expect(CREATEREACT_COMPONENT_PROMPT).toHaveProperty('arguments');
      expect(CREATEREACT_COMPONENT_PROMPT).toHaveProperty('messages');
    });

    it('should have correct arguments', () => {
      expect(CREATEREACT_COMPONENT_PROMPT.arguments).toHaveLength(5);
      
      const nameArg = CREATEREACT_COMPONENT_PROMPT.arguments[0];
      expect(nameArg).toEqual({
        name: 'componentname',
        description: 'Name of the component to create',
        required: true
      });

      const descriptionArg = CREATEREACT_COMPONENT_PROMPT.arguments[1];
      expect(descriptionArg).toEqual({
        name: 'description',
        description: 'Description of what the component should do',
        required: true
      });

      const typeArg = CREATEREACT_COMPONENT_PROMPT.arguments[2];
      expect(typeArg).toEqual({
        name: 'componenttype',
        description: 'Type of component (functional, class, hooks-based)',
        required: false
      });

      const styleArg = CREATEREACT_COMPONENT_PROMPT.arguments[3];
      expect(styleArg).toEqual({
        name: 'stylingapproach',
        description: 'CSS approach (css-modules, styled-components, tailwind, etc)',
        required: false
      });

      const testsArg = CREATEREACT_COMPONENT_PROMPT.arguments[4];
      expect(testsArg).toEqual({
        name: 'includetests',
        description: 'Whether to create tests alongside the component',
        required: false
      });
    });

    it('should have messages array with user role', () => {
      expect(CREATEREACT_COMPONENT_PROMPT.messages).toHaveLength(1);
      expect(CREATEREACT_COMPONENT_PROMPT.messages[0]).toHaveProperty('role', 'user');
      expect(CREATEREACT_COMPONENT_PROMPT.messages[0]).toHaveProperty('content');
    });

    it('should have text content with template variables', () => {
      const content = CREATEREACT_COMPONENT_PROMPT.messages[0].content;
      expect(content).toHaveProperty('type', 'text');
      expect(content.text).toContain('{{componentname}}');
      expect(content.text).toContain('{{description}}');
      expect(content.text).toContain('{{componenttype}}');
      expect(content.text).toContain('{{stylingapproach}}');
      expect(content.text).toContain('{{includetests}}');
    });

    it('should include comprehensive React development guidelines', () => {
      const text = CREATEREACT_COMPONENT_PROMPT.messages[0].content.text;
      expect(text).toContain('Component Architecture');
      expect(text).toContain('Core Implementation');
      expect(text).toContain('State Management');
      expect(text).toContain('Event Handling');
      expect(text).toContain('Styling Implementation');
      expect(text).toContain('Performance Optimization');
      expect(text).toContain('Accessibility');
      expect(text).toContain('Code Quality Standards');
      expect(text).toContain('Output Requirements');
    });

    it('should mention React best practices', () => {
      const text = CREATEREACT_COMPONENT_PROMPT.messages[0].content.text;
      expect(text).toContain('TypeScript interfaces');
      expect(text).toContain('React.memo');
      expect(text).toContain('useMemo');
      expect(text).toContain('useCallback');
      expect(text).toContain('ARIA');
      expect(text).toContain('semantic HTML');
      expect(text).toContain('keyboard navigation');
    });
  });

  describe('REACTCOMPONENT_PROMPTS', () => {
    it('should export array containing CREATEREACT_COMPONENT_PROMPT', () => {
      expect(REACTCOMPONENT_PROMPTS).toBeInstanceOf(Array);
      expect(REACTCOMPONENT_PROMPTS).toHaveLength(1);
      expect(REACTCOMPONENT_PROMPTS[0]).toBe(CREATEREACT_COMPONENT_PROMPT);
    });
  });
});