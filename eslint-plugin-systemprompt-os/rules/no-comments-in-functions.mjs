/**
 * ESLint rule to prohibit any comments inside function bodies
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow any comments inside function bodies',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      noCommentsInFunction: 'Comments are not allowed inside function bodies. Place them in JSDoc above the function instead or delete them.'
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    
    // Stack to track current function scope
    const functionStack = [];
    
    function enterFunction(node) {
      functionStack.push({
        node,
        start: node.body.range[0],
        end: node.body.range[1]
      });
    }
    
    function exitFunction() {
      functionStack.pop();
    }
    
    function checkComments() {
      if (functionStack.length === 0) return;
      
      const comments = sourceCode.getAllComments();
      const currentFunction = functionStack[functionStack.length - 1];
      
      for (const comment of comments) {
        // Check if comment is inside current function body
        if (comment.range[0] > currentFunction.start && 
            comment.range[1] < currentFunction.end) {
          
          // Check if this comment is inside a nested function
          // by checking all functions in the stack
          let isInNestedFunction = false;
          for (let i = functionStack.length - 2; i >= 0; i--) {
            const parentFunction = functionStack[i];
            if (comment.range[0] > parentFunction.start && 
                comment.range[1] < parentFunction.end) {
              isInNestedFunction = true;
              break;
            }
          }
          
          // Only report if it's in the current function, not a parent
          if (!isInNestedFunction) {
            context.report({
              node: comment,
              messageId: 'noCommentsInFunction',
              loc: comment.loc
            });
          }
        }
      }
    }
    
    return {
      // Function declarations
      FunctionDeclaration: enterFunction,
      'FunctionDeclaration:exit': exitFunction,
      
      // Function expressions
      FunctionExpression: enterFunction,
      'FunctionExpression:exit': exitFunction,
      
      // Arrow functions
      ArrowFunctionExpression(node) {
        // Only track arrow functions with block bodies
        if (node.body.type === 'BlockStatement') {
          enterFunction(node);
        }
      },
      'ArrowFunctionExpression:exit'(node) {
        if (node.body.type === 'BlockStatement') {
          exitFunction();
        }
      },
      
      // Method definitions
      MethodDefinition(node) {
        if (node.value && node.value.body) {
          enterFunction(node.value);
        }
      },
      'MethodDefinition:exit'(node) {
        if (node.value && node.value.body) {
          exitFunction();
        }
      },
      
      // Check comments when entering any node
      '*'(node) {
        // Check comments whenever we're inside a function
        if (functionStack.length > 0) {
          checkComments();
        }
      },
      
      // Also check when exiting program to catch any remaining
      'Program:exit': checkComments
    };
  }
};