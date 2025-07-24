/**
 * ESLint rule to disallow JSDoc comments inside interfaces and types
 * Enforces that documentation should be on the interface/type itself, not on individual properties
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow JSDoc comments inside interfaces and type definitions. Documentation should be on the interface/type declaration itself.',
      category: 'Stylistic Issues',
      recommended: true
    },
    messages: {
      noJSDocInInterface: 'JSDoc comments are not allowed inside interfaces. Document the interface itself with a comprehensive JSDoc comment instead.',
      noJSDocInType: 'JSDoc comments are not allowed inside type definitions. Document the type itself with a comprehensive JSDoc comment instead.'
    },
    fixable: 'code',
    schema: []
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    
    /**
     * Check if a node has a JSDoc comment
     * @param {object} node - AST node
     * @returns {object|null} JSDoc comment if found
     */
    function getJSDocComment(node) {
      const comments = sourceCode.getCommentsBefore(node);
      return comments.find(comment => 
        comment.type === 'Block' && comment.value.startsWith('*')
      ) || null;
    }
    
    /**
     * Remove JSDoc comment for a node
     * @param {object} fixer - ESLint fixer
     * @param {object} comment - Comment to remove
     * @returns {object} Fix object
     */
    function removeJSDoc(fixer, comment) {
      // Get the range including any whitespace before the comment
      const start = comment.range[0];
      const end = comment.range[1];
      
      // Check if there's a newline after the comment
      const textAfter = sourceCode.text.slice(end, end + 2);
      const includeNewline = textAfter.startsWith('\n') || textAfter.startsWith('\r\n');
      
      return fixer.removeRange([start, includeNewline ? end + 1 : end]);
    }
    
    return {
      // Check properties inside interfaces
      TSPropertySignature(node) {
        const jsdoc = getJSDocComment(node);
        if (jsdoc) {
          context.report({
            node: jsdoc,
            messageId: 'noJSDocInInterface',
            fix(fixer) {
              return removeJSDoc(fixer, jsdoc);
            }
          });
        }
      },
      
      // Check properties inside type literals
      TSTypeLiteral(node) {
        // Check all members of the type literal
        node.members.forEach(member => {
          if (member.type === 'TSPropertySignature') {
            const jsdoc = getJSDocComment(member);
            if (jsdoc) {
              context.report({
                node: jsdoc,
                messageId: 'noJSDocInType',
                fix(fixer) {
                  return removeJSDoc(fixer, jsdoc);
                }
              });
            }
          }
        });
      },
      
      // Check method signatures in interfaces
      TSMethodSignature(node) {
        const jsdoc = getJSDocComment(node);
        if (jsdoc) {
          context.report({
            node: jsdoc,
            messageId: 'noJSDocInInterface',
            fix(fixer) {
              return removeJSDoc(fixer, jsdoc);
            }
          });
        }
      },
      
      // Check index signatures in interfaces
      TSIndexSignature(node) {
        const jsdoc = getJSDocComment(node);
        if (jsdoc) {
          context.report({
            node: jsdoc,
            messageId: 'noJSDocInInterface',
            fix(fixer) {
              return removeJSDoc(fixer, jsdoc);
            }
          });
        }
      }
    };
  }
};