/**
 * @fileoverview Unit testing prompts for comprehensive test coverage
 * @module handlers/prompts/unit-testing
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Prompt for creating unit tests
 */
export const CREATE_UNIT_TESTS_PROMPT: Prompt = {
  name: 'create_unit_tests',
  description: 'Create and run unit tests until achieving 100% pass rate',
  arguments: [
    {
      name: 'file_path',
      description: 'Path to the file or module to test',
      required: true,
    },
    {
      name: 'test_framework',
      description: 'Testing framework to use (e.g., jest, mocha, pytest, junit)',
      required: false,
    },
    {
      name: 'coverage_target',
      description: 'Target code coverage percentage (default: 80)',
      required: false,
    }
  ],
  messages: [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `# Unit Test Creation Task

## Test Requirements
- **File to Test**: {{file_path}}
- **Test Framework**: {{test_framework}}
- **Coverage Target**: {{coverage_target}}%

## Instructions

Create comprehensive unit tests following these guidelines:

### 1. Code Analysis Phase
**Function/Method Analysis**:
- Identify all exported functions, methods, and classes
- Map function signatures and return types
- Document side effects and state changes
- Identify pure vs impure functions
- Note async/promise-based operations
- List external dependencies

**Dependency Mapping**:
- External modules/packages
- Database connections
- API calls
- File system operations
- Environment variables
- Global state access

**Code Path Analysis**:
- All conditional branches (if/else, switch)
- Loop conditions and iterations
- Error handling paths
- Early returns
- Default parameter values
- Optional chaining paths

### 2. Test Planning
**Test Categories**:
1. **Happy Path Tests**: Normal operation with valid inputs
2. **Edge Cases**: Boundary values, empty inputs, maximum values
3. **Error Cases**: Invalid inputs, null/undefined, type mismatches
4. **Integration Points**: Mock external dependencies
5. **Async Operations**: Promise resolution/rejection
6. **State Management**: State initialization and mutations

**Test Structure Template**:
\`\`\`javascript
describe('ModuleName', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset state, create mocks
  });
  
  afterEach(() => {
    // Cleanup, restore mocks
  });
  
  describe('functionName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = setupTestData();
      
      // Act
      const result = functionName(input);
      
      // Assert
      expect(result).toBe(expectedValue);
    });
    
    it('should handle edge case', () => {
      // Test boundary conditions
    });
    
    it('should throw error for invalid input', () => {
      // Test error scenarios
    });
  });
});
\`\`\`

### 3. Mock Strategy
**Mock Creation Guidelines**:
- Mock external services (APIs, databases)
- Stub file system operations
- Mock time-dependent functions
- Create test doubles for complex objects
- Use spy functions for behavior verification

**Mock Patterns**:
\`\`\`javascript
// API mocking
jest.mock('axios');
axios.get.mockResolvedValue({ data: testData });

// Function spying
const spy = jest.spyOn(object, 'method');

// Timer mocking
jest.useFakeTimers();
\`\`\`

### 4. Test Implementation Requirements
1. **Isolation**: Each test must be independent
2. **Repeatability**: Tests must produce consistent results
3. **Clarity**: Clear test names describing what is being tested
4. **Speed**: Mock heavy operations for fast execution
5. **Coverage**: Achieve specified coverage target

### 5. Edge Cases to Cover
- Null/undefined inputs
- Empty arrays/objects
- Zero/negative numbers
- Maximum safe integers
- Empty strings
- Special characters
- Concurrent operations
- Memory limits
- Timeout scenarios

### 6. Async Testing Patterns
\`\`\`javascript
// Promise testing
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

// Callback testing
it('should handle callbacks', (done) => {
  callbackFunction((error, result) => {
    expect(error).toBeNull();
    expect(result).toBe(expected);
    done();
  });
});
\`\`\`

### 7. Test Execution & Iteration
1. Write initial test suite
2. Run tests and identify failures
3. Fix failing tests
4. Add missing test cases
5. Check coverage report
6. Add tests for uncovered lines
7. Repeat until 100% pass rate and coverage target

### Output Requirements
- Complete test file(s) with all test cases
- Test execution results showing 100% pass rate
- Coverage report meeting target percentage
- Documentation of any assumptions or limitations
- List of mocked dependencies`,
      },
    },
  ],
};

/**
 * Collection of unit testing prompts
 */
export const UNIT_TESTING_PROMPTS = [CREATE_UNIT_TESTS_PROMPT];