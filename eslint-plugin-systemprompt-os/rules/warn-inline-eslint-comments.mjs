/**
 * ESLint rule to warn about inline eslint-disable and eslint-enable comments
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Warn when using inline eslint-disable or eslint-enable comments',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      inlineEslintComment: 'Inline {{directive}} comments should be avoided. ' +
        'Consider: 1) Fixing the underlying issue instead of disabling the rule, ' +
        '2) If disabling is necessary, add a comment explaining why, ' +
        '3) For file-wide disables, use /* eslint-disable */ at the top of the file, ' +
        '4) For next-line disables, use // eslint-disable-next-line with explanation'
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();
    
    return {
      Program() {
        const comments = sourceCode.getAllComments();
        
        for (const comment of comments) {
          const trimmedText = comment.value.trim();
          
          // Check for eslint-disable or eslint-enable patterns
          const eslintPattern = /^eslint-(disable|enable)(?:-next-line|-line)?(?:\s|$)/;
          const match = trimmedText.match(eslintPattern);
          
          if (match) {
            // Check if it's an inline comment (on the same line as code)
            const line = sourceCode.lines[comment.loc.start.line - 1];
            const beforeComment = line.substring(0, comment.loc.start.column);
            const hasCodeBefore = beforeComment.trim().length > 0;
            
            if (hasCodeBefore) {
              context.report({
                loc: comment.loc,
                messageId: 'inlineEslintComment',
                data: {
                  directive: match[0].trim()
                }
              });
            }
          }
        }
      }
    };
  }
};