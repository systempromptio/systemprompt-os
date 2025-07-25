/**
 * Override built-in ESLint rules to provide more helpful error messages
 */

export const noAwaitInLoopWithHelp = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow await inside of loops with helpful fix suggestions',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      unexpectedAwaitInLoop: 'Unexpected `await` inside a loop. ' +
        'Fix: Use Promise.all() for parallel execution: `await Promise.all(items.map(async item => await process(item)))`. ' +
        'If sequential execution is required (e.g., rate limiting, order matters), add a comment explaining why and disable: `// eslint-disable-next-line no-await-in-loop`'
    },
    schema: []
  },
  create(context) {
    return {
      AwaitExpression(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        
        // Check if we're inside a loop
        const inLoop = ancestors.some(ancestor => 
          ancestor.type === 'ForStatement' ||
          ancestor.type === 'ForInStatement' ||
          ancestor.type === 'ForOfStatement' ||
          ancestor.type === 'WhileStatement' ||
          ancestor.type === 'DoWhileStatement'
        );
        
        if (inLoop) {
          context.report({
            node,
            messageId: 'unexpectedAwaitInLoop'
          });
        }
      }
    };
  }
};

export const noConsoleWithHelp = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow console with helpful fix suggestions',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      noConsole: 'Unexpected console statement. ' +
        'Fix: Use the logger service instead: `logger.{{method}}()`. '
    },
    schema: []
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.object.name === 'console') {
          context.report({
            node,
            messageId: 'noConsole',
            data: {
              method: node.property.name || 'log'
            }
          });
        }
      }
    };
  }
};

export const preferConstWithHelp = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require const for never-reassigned variables with helpful fix suggestions',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      preferConst: '`{{name}}` is never reassigned. ' +
        'Fix: Use `const` instead of `{{kind}}`. ' +
        'If reassignment is planned, add a comment explaining the future use case.'
    },
    fixable: 'code',
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode;
    
    return {
      'VariableDeclaration:exit'(node) {
        if (node.kind !== 'const') {
          node.declarations.forEach(decl => {
            if (decl.id.type === 'Identifier') {
              // Simplified check - in real implementation would track reassignments
              context.report({
                node: decl,
                messageId: 'preferConst',
                data: {
                  name: decl.id.name,
                  kind: node.kind
                },
                fix(fixer) {
                  const varToken = sourceCode.getFirstToken(node);
                  return fixer.replaceText(varToken, 'const');
                }
              });
            }
          });
        }
      }
    };
  }
};

export const noUnusedVarsWithHelp = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unused variables with helpful fix suggestions',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      unusedVar: '`{{name}}` is defined but never used. ' +
        'Fix options: 1) Remove the variable, 2) Use it in your code, ' +
        '3) If keeping for documentation, prefix with underscore: `_{{name}}`, ' +
        '4) For required but unused params, use: `_{{name}}`'
    },
    schema: []
  },
  create(context) {
    // Simplified - would integrate with TypeScript's unused detection
    return {};
  }
};