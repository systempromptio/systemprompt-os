/**
 * @file Bug fixing prompts
 * @module handlers/prompts/bug-fixing
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const FIX_BUG_PROMPT: Prompt = {
  name: 'fix_bug',
  description: 'Diagnose and fix a bug in the code',
  arguments: [
    {
      name: 'bug_description',
      description: 'Description of the bug or error',
      required: true,
    },
    {
      name: 'error_message',
      description: 'Error message or stack trace if available',
      required: false,
    },
    {
      name: 'affected_files',
      description: 'Files potentially related to the bug',
      required: false,
    },
    {
      name: 'reproduction_steps',
      description: 'Steps to reproduce the bug',
      required: false,
    }
  ],
  messages: [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `# Bug Fix Task

## Bug Description
{{bug_description}}

## Error Information
{{error_message}}

## Affected Files
{{affected_files}}

## Reproduction Steps
{{reproduction_steps}}

## Instructions

You are tasked with diagnosing and fixing this bug. Follow this systematic approach:

### 1. Error Analysis
- Parse and understand the error message and stack trace
- Identify the exact error type, location, and failure context
- Search for similar or related issues in the codebase
- Document your understanding of what's failing and why

### 2. Root Cause Investigation
- Trace the execution flow leading to the error
- Examine the state of variables at the point of failure
- Analyze data transformations and type conversions
- Identify edge cases or unexpected inputs
- Check for race conditions or timing issues

### 3. Debugging Implementation
- Add strategic console.log statements or debugging output
- Use appropriate debugging tools for the language/framework
- Isolate the problem to the smallest reproducible case
- Test your hypotheses systematically
- Document each finding

### 4. Fix Development
- Implement the minimal necessary changes to fix the bug
- Handle all identified edge cases properly
- Add defensive programming measures to prevent similar issues
- Ensure the fix doesn't introduce regression
- Add appropriate error handling and validation

### 5. Testing & Validation
- Verify the bug is fixed with the original reproduction steps
- Test edge cases and boundary conditions
- Ensure no existing functionality is broken
- Add unit tests to prevent regression
- Update documentation if needed

### Output Requirements
- Provide a clear explanation of the root cause
- Show the exact code changes needed
- Include any new tests or validation logic
- Document any assumptions or limitations
- Suggest preventive measures for similar bugs`,
      },
    },
  ],
};

export const BUG_FIXING_PROMPTS = [FIX_BUG_PROMPT];