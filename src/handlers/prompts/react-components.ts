/**
 * @file React component prompts
 * @module handlers/prompts/react-components
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const CREATE_REACT_COMPONENT_PROMPT: Prompt = {
  name: 'create_react_component',
  description: 'Create a new React component with specified functionality',
  arguments: [
    {
      name: 'component_name',
      description: 'Name of the component to create',
      required: true,
    },
    {
      name: 'description',
      description: 'Description of what the component should do',
      required: true,
    },
    {
      name: 'component_type',
      description: 'Type of component (functional, class, hooks-based)',
      required: false,
    },
    {
      name: 'styling_approach',
      description: 'CSS approach (css-modules, styled-components, tailwind, etc)',
      required: false,
    },
    {
      name: 'include_tests',
      description: 'Whether to create tests alongside the component',
      required: false,
    }
  ],
  messages: [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `# React Component Creation Task

## Component Requirements
- **Name**: {{component_name}}
- **Purpose**: {{description}}
- **Type**: {{component_type}}
- **Styling**: {{styling_approach}}
- **Tests**: {{include_tests}}

## Instructions

Create a production-ready React component following these specifications:

### 1. Component Architecture
**File Structure**:
- Create the component file with proper naming (PascalCase)
- Organize imports logically (React first, then external, then internal)
- Place component in appropriate directory structure
- Create separate files for types, constants, and utilities if needed

**Type Safety**:
- Define comprehensive TypeScript interfaces for all props
- Use proper type annotations for state and refs
- Export prop types for reusability
- Add JSDoc comments for complex props

**Component Design**:
- Use functional components with hooks (unless class component specified)
- Implement proper component composition
- Follow single responsibility principle
- Make the component reusable and configurable

### 2. Core Implementation
**State Management**:
- Use appropriate React hooks (useState, useReducer, useContext)
- Keep state minimal and derived values computed
- Lift state only when necessary
- Implement controlled/uncontrolled patterns appropriately

**Props Design**:
- Provide sensible defaults using defaultProps or default parameters
- Use prop spreading judiciously
- Implement proper prop validation
- Design for flexibility and extensibility

**Event Handling**:
- Use proper event handler naming (onClick, onChange, etc.)
- Implement event delegation where appropriate
- Prevent default behaviors when needed
- Add proper error boundaries for error handling

### 3. Performance Optimization
- Use React.memo for expensive pure components
- Implement useMemo for expensive computations
- Use useCallback for stable function references
- Avoid inline function definitions in render
- Implement lazy loading if component is heavy
- Use React.Suspense for async components

### 4. Styling Implementation
**Based on chosen approach**:
- CSS Modules: Create .module.css with scoped styles
- Styled Components: Use emotion/styled-components
- Tailwind: Apply utility classes with proper organization
- Inline styles: Use sparingly, only for dynamic values

**Style Guidelines**:
- Implement responsive design
- Support theme customization
- Handle hover, focus, and active states
- Ensure proper CSS specificity
- Add transitions for smooth interactions

### 5. Accessibility (a11y)
- Add proper ARIA labels and roles
- Ensure keyboard navigation support
- Implement focus management
- Use semantic HTML elements
- Add screen reader friendly content
- Test with accessibility tools

### 6. Component Documentation
**Props Documentation**:
\`\`\`typescript
interface ComponentProps {
  /** Primary content to display */
  children: React.ReactNode;
  /** Click handler with event parameter */
  onClick?: (event: React.MouseEvent) => void;
  /** Component visual variant */
  variant?: 'primary' | 'secondary';
  /** Disabled state */
  disabled?: boolean;
}
\`\`\`

**Usage Examples**:
\`\`\`jsx
// Basic usage
<Component>Content</Component>

// With all props
<Component 
  variant="primary"
  disabled={false}
  onClick={handleClick}
>
  Complex Content
</Component>
\`\`\`

### 7. Testing Requirements (if requested)
- Unit tests for all component logic
- Integration tests for user interactions
- Snapshot tests for UI consistency
- Accessibility tests
- Test edge cases and error states

### 8. Code Quality Standards
- No console.logs or debugger statements
- Proper error handling
- Clean, readable code with meaningful names
- Consistent code formatting
- No unused imports or variables

### Output Requirements
1. Complete component implementation
2. TypeScript interfaces/types
3. Styling files (based on approach)
4. Test files (if requested)
5. Usage documentation with examples`,
      },
    },
  ],
};

export const REACT_COMPONENT_PROMPTS = [CREATE_REACT_COMPONENT_PROMPT];