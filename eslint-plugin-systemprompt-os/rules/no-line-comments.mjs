/**
 * ESLint rule to disallow line comments (//)
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow line comments (//). Only JSDoc comments are allowed.',
      category: 'Stylistic Issues',
      recommended: true
    },
    messages: {
      noLineComments: 'Line comments (//) are not allowed. Only JSDoc comments (/** */) are allowed.'
    },
    schema: [{
      type: 'object',
      properties: {
        exceptions: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: []
        }
      },
      additionalProperties: false
    }]
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    const options = context.options[0] || {};
    const exceptions = options.exceptions || [];
    
    return {
      Program() {
        const comments = sourceCode.getAllComments();
        
        for (const comment of comments) {
          if (comment.type === 'Line') {
            // Check if comment starts with any exception pattern
            const commentText = comment.value.trim();
            const isException = exceptions.some(pattern => 
              commentText.startsWith(pattern)
            );
            
            if (!isException) {
              context.report({
                node: comment,
                messageId: 'noLineComments',
                loc: comment.loc
              });
            }
          }
        }
      }
    };
  }
};