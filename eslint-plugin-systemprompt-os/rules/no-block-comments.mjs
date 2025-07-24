/**
 * ESLint rule to prohibit block comments that aren't JSDoc
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow block comments (/* */) that are not JSDoc comments. Only JSDoc comments (/** */) are allowed.',
      category: 'Stylistic Issues',
      recommended: true
    },
    messages: {
      noBlockComments: 'Block comments (/* */) are not allowed. Use JSDoc comments (/** */) instead.'
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    
    return {
      Program() {
        const comments = sourceCode.getAllComments();
        
        for (const comment of comments) {
          // Skip JSDoc comments (those starting with /**)
          if (comment.type === 'Block' && !comment.value.startsWith('*')) {
            context.report({
              node: comment,
              loc: comment.loc,
              messageId: 'noBlockComments'
            });
          }
        }
      }
    };
  }
};