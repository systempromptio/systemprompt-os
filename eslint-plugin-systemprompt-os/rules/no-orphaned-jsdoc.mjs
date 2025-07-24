/**
 * ESLint rule to detect JSDoc comments that don't document any code
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow JSDoc comments that don\'t document any actual code',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      orphanedJSDoc: 'JSDoc comment does not document any code. Remove this orphaned comment.',
      emptyLineBetween: 'JSDoc comment is separated from the code it documents by empty lines.'
    },
    fixable: 'code',
    schema: []
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    
    return {
      Program(node) {
        const comments = sourceCode.getAllComments();
        
        comments.forEach(comment => {
          // Only check JSDoc comments (/** */)
          if (comment.type !== 'Block' || !comment.value.startsWith('*')) {
            return;
          }
          
          // Get the next token after the comment
          const nextToken = sourceCode.getTokenAfter(comment, { includeComments: true });
          
          // If there's no next token, it's at the end of file
          if (!nextToken) {
            context.report({
              loc: comment.loc,
              messageId: 'orphanedJSDoc',
              fix(fixer) {
                return fixer.remove(comment);
              }
            });
            return;
          }
          
          // Check if the next non-comment token is another JSDoc comment
          // This indicates the current JSDoc doesn't document anything
          if (nextToken.type === 'Block' && nextToken.value.startsWith('*')) {
            context.report({
              loc: comment.loc,
              messageId: 'orphanedJSDoc',
              fix(fixer) {
                // Remove the comment and any whitespace after it
                const start = comment.range[0];
                const end = nextToken.range[0];
                return fixer.removeRange([start, end]);
              }
            });
            return;
          }
          
          // Check if there are too many empty lines between JSDoc and code
          const commentEndLine = comment.loc.end.line;
          const nextCodeStartLine = nextToken.loc.start.line;
          
          // If there's more than one empty line, it's likely orphaned
          if (nextCodeStartLine - commentEndLine > 2) {
            context.report({
              loc: comment.loc,
              messageId: 'orphanedJSDoc',
              fix(fixer) {
                return fixer.remove(comment);
              }
            });
          }
        });
      }
    };
  }
};