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
    fixable: 'code',
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
              loc: comment.loc,
              fix(fixer) {
                // Get the entire line containing the comment
                const lines = sourceCode.lines;
                const commentStartLine = comment.loc.start.line - 1;
                const commentEndLine = comment.loc.end.line - 1;
                
                // Check if the comment is on its own line
                const startLineText = lines[commentStartLine];
                const beforeComment = startLineText.substring(0, comment.loc.start.column);
                const afterComment = startLineText.substring(comment.loc.end.column);
                
                if (beforeComment.trim() === '' && afterComment.trim() === '') {
                  // Comment is on its own line(s), remove the entire line(s)
                  const startOfLine = sourceCode.getIndexFromLoc({ line: comment.loc.start.line, column: 0 });
                  const endOfLine = sourceCode.getIndexFromLoc({ line: comment.loc.end.line + 1, column: 0 });
                  return fixer.removeRange([startOfLine, endOfLine]);
                } else {
                  // Comment is inline, just remove the comment and surrounding spaces
                  const start = comment.range[0];
                  const end = comment.range[1];
                  
                  // Also remove trailing spaces after the comment
                  let removeEnd = end;
                  while (removeEnd < sourceCode.text.length && /\s/.test(sourceCode.text[removeEnd])) {
                    if (sourceCode.text[removeEnd] === '\n') break;
                    removeEnd++;
                  }
                  
                  // Also remove leading spaces before the comment (but not newlines)
                  let removeStart = start;
                  if (comment.type === 'Line') {
                    removeStart -= 2; // Include the //
                  } else if (comment.type === 'Block') {
                    removeStart -= 2; // Include the /*
                    removeEnd += 2; // Include the */
                  }
                  
                  // Remove leading spaces
                  while (removeStart > 0 && sourceCode.text[removeStart - 1] === ' ') {
                    removeStart--;
                  }
                  
                  return fixer.removeRange([removeStart, removeEnd]);
                }
              }
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