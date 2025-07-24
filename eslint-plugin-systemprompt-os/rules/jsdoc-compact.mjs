/**
 * ESLint rule to enforce compact JSDoc comments (no empty lines)
 */
export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce compact JSDoc comments without empty lines',
      category: 'Stylistic Issues',
      recommended: true
    },
    messages: {
      noEmptyLines: 'JSDoc comments should not contain empty lines'
    },
    fixable: 'whitespace',
    schema: []
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    
    return {
      Program() {
        const comments = sourceCode.getAllComments();
        
        for (const comment of comments) {
          if (comment.type === 'Block' && comment.value.startsWith('*')) {
            const lines = comment.value.split('\n');
            
            for (let i = 1; i < lines.length - 1; i++) {
              const line = lines[i].trim();
              
              // Check if line is empty or only contains asterisk
              if (line === '*' || line === '') {
                // Check if next line is also essentially empty
                const nextLine = lines[i + 1] && lines[i + 1].trim();
                const prevLine = lines[i - 1] && lines[i - 1].trim();
                
                // Report if surrounded by content (not at start/end of params)
                if (prevLine && prevLine !== '*' && nextLine && nextLine !== '*') {
                  context.report({
                    node: comment,
                    messageId: 'noEmptyLines',
                    loc: {
                      start: {
                        line: comment.loc.start.line + i + 1,
                        column: 0
                      },
                      end: {
                        line: comment.loc.start.line + i + 1,
                        column: lines[i].length
                      }
                    },
                    fix(fixer) {
                      // Remove the empty line
                      const newComment = lines.filter((_, index) => index !== i).join('\n');
                      return fixer.replaceText(comment, `/*${newComment}*/`);
                    }
                  });
                }
              }
            }
          }
        }
      }
    };
  }
};